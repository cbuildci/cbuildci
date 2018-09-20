'use strict';

const koaRouter = require('koa-router');
const schema = require('../../../common/schema');
const { INSTALLATION_TOKEN_CACHE } = require('../../../common/cache');
const util = require('../../../common/util');
const aws = require('../../util/aws');
const github = require('../../util/github');
const { startExecution } = require('../../util/startExecution');

async function getExecution(ctx) {
    const repoId = util.buildRepoId(
        ctx.params.owner,
        ctx.params.repo,
    );

    const executionId = util.buildExecutionId(
        ctx.params.commit,
        ctx.params.executionNum,
    );

    const execution = await aws.getExecution(
        ctx.ciApp.tableExecutionsName,
        repoId,
        executionId,
    );

    if (!execution) {
        ctx.logWarn(`Execution "${executionId}" not found for repo "${repoId}" for user "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id})`);
        ctx.throw(404, 'Repository or execution not found');
    }

    return execution;
}

async function verifyRepoAccess(token, ctx, githubRepoId = null) {
    const { owner, repo } = ctx.params;

    const repositoryResponse = await github.getRepository(
        ctx.ciApp.githubApiUrl,
        token,
        owner,
        repo,
    );

    if (repositoryResponse.statusCode !== 200) {
        ctx.logWarn(`Repository ${util.buildRepoId(owner, repo)} not found for user "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id})`);
        ctx.throw(404, 'Repository or execution not found');
    }

    if (githubRepoId) {
        // Verify the repo id matches the one in the execution,
        // just in case a user/repo was deleted and then recreated.
        if (repositoryResponse.data.id !== githubRepoId) {
            ctx.logWarn(`Repository ${util.buildRepoId(owner, repo)} mismatched id in execution: ${repositoryResponse.data.id} !== ${githubRepoId}`);
            ctx.throw(500, 'The internal ID for the repository does not match (was the repo deleted and recreated?)');
        }
    }

    if (!repositoryResponse.data.permissions.push) {
        ctx.logWarn(`User "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id}) does not have write access to repo ${util.buildRepoId(owner, repo)}`);
        ctx.throw(404, 'Repository or execution not found');
    }

    return repositoryResponse.data;
}

/**
 * Helper for using signed access keys to more quickly access data related to repos.
 *
 * @param {object} ctx
 * @param {string} headerName - HTTP header name for access key
 * @param {function} getGithubAuthToken - Function that returns the Github OAuth token fro the logged in user. Can return a Promise.
 * @param {boolean} createAccessKey - Whether or not to create the access key if it does not exist.
 * @param {number} [executionGithubRepoId] - GitHub's numerical ID for the repo. If provided, used to verify that it is the exact repo and not just one with the same name.
 * @returns {Promise<string>}
 */
async function verifyRepoAccessByKey(ctx, headerName, getGithubAuthToken, createAccessKey, executionGithubRepoId) {
    let accessKey = ctx.headers[headerName] || null;

    // Verify the encrypted access key, if provided.
    if (accessKey) {
        try {
            // Decrypt and parse the access key.
            const {
                sessionInternalIdentifier,
                expirationTime,
                accessTo,
            } = JSON.parse((await aws.decryptString(accessKey)).toString('utf8'));

            // Reset the access key if isn't valid or has expired.
            if (sessionInternalIdentifier !== ctx.session.internalIdentifier
                || expirationTime < Date.now()
                || accessTo !== ctx.url) {
                accessKey = null;
            }
        }
        catch (err) {
            accessKey = null;
            ctx.logError(`Invalid execution access key for user "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id}): [${err.name}] ${err.message}`);
        }
    }

    // Create a temporary access key, if one was not provided and the execution has not completed.
    // This allows us to reduce the number of requests to GitHub when the UI is continually fetching execution data.
    if (!accessKey && createAccessKey) {
        await verifyRepoAccess(await getGithubAuthToken(), ctx, executionGithubRepoId);
        accessKey = await aws.encryptString(
            ctx.ciApp.secretsKMSArn,
            JSON.stringify({
                sessionInternalIdentifier: ctx.session.internalIdentifier,
                expirationTime: Date.now() + 300000, // 5 minutes
                accessTo: ctx.url,
            }),
        );
    }

    return accessKey;
}

module.exports = koaRouter({
    prefix: '/:owner/:repo',
})
    .get('/', async (ctx) => {
        await verifyRepoAccess(
            (await aws.decryptString(ctx.session.encryptedGithubAuthToken)).toString('utf8'),
            ctx,
        );

        const { owner, repo } = ctx.params;

        const results = await aws.getExecutionsForRepo(
            ctx.ciApp.tableExecutionsName,
            util.buildRepoId(owner, repo),
            {
                limit: typeof ctx.query.limit === 'string' && ctx.query.limit.match(/^\d+$/)
                    ? Math.max(10, Math.min(100, parseInt(ctx.query.limit || 0) || 50))
                    : 50,
            }
        );

        ctx.body = {
            executions: results.items.map((execution) => ({
                ...util.parseRepoId(execution.repoId),
                ...util.parseExecutionId(execution.executionId),

                ...execution,
            })),
            lastEvaluatedKey: results.lastEvaluatedKey,
        };
    })

    .get('/commit/:commit', async (ctx) => {
        await verifyRepoAccess(
            (await aws.decryptString(ctx.session.encryptedGithubAuthToken)).toString('utf8'),
            ctx,
        );

        const { owner, repo, commit } = ctx.params;

        const {
            items,
            lastEvaluatedKey,
        } = await aws.getExecutionsForCommit(
            ctx.ciApp.tableExecutionsName,
            util.buildRepoId(owner, repo),
            commit,
        );

        ctx.body = {
            executions: items.map((execution) => ({
                // Destruct the IDs into their parts.
                ...util.parseRepoId(execution.repoId),
                ...util.parseExecutionId(execution.executionId),

                ...execution,
            })),
            lastEvaluatedKey,
        };
    })

    .get('/commit/:commit/exec/:executionNum', async (ctx) => {
        const execution = await getExecution(ctx);

        const accessKey = await verifyRepoAccessByKey(
            ctx,
            'x-execution-access-key',
            async () => (
                await aws.decryptString(ctx.session.encryptedGithubAuthToken)
            ).toString('utf8'),
            execution.status !== 'COMPLETED',
            execution.meta.githubRepo.id,
        );

        ctx.body = {
            // Destruct the IDs into their parts.
            ...util.parseRepoId(execution.repoId),
            ...util.parseExecutionId(execution.executionId),

            repoId: execution.repoId,
            executionId: execution.executionId,
            status: execution.status,
            createTime: execution.createTime,
            updateTime: execution.updateTime,
            conclusion: execution.conclusion,
            conclusionTime: execution.conclusionTime,
            meta: execution.meta,
            state: execution.state && {
                isRunning: execution.state.isRunning,
                errorInfo: execution.state.errorInfo,
                commitSHA: execution.state.commitSHA,
                builds: execution.state.builds,
            },

            // Include the access key (may be null).
            accessKey,
        };
    })

    .post('/commit/:commit/exec/:executionNum/action/stop', async (ctx) => {
        await verifyRepoAccess(
            (await aws.decryptString(ctx.session.encryptedGithubAuthToken)).toString('utf8'),
            ctx,
        );

        const execution = await getExecution(ctx);

        if (execution.meta.stop) {
            ctx.throw(400, 'Execution stop has already been requested');
        }

        // Check that the "stop" action is valid.
        if (!execution.meta.actions.includes('stop')) {
            ctx.throw(400, 'Execution does not allow "stop" action');
        }

        await aws.updateExecution(
            ctx.ciApp.tableExecutionsName,
            execution.repoId,
            execution.executionId,
            {
                meta: {
                    stop: {
                        user: ctx.session.githubUser.login,
                        requestTime: new Date().toISOString(),
                    },
                },
            },
        );

        ctx.body = {
            message: 'success',
        };
    })

    .post('/commit/:commit/exec/:executionNum/action/rerun', async (ctx) => {
        const execution = await getExecution(ctx);

        const repository = await verifyRepoAccess(
            (await aws.decryptString(ctx.session.encryptedGithubAuthToken)).toString('utf8'),
            ctx,
            execution.meta.githubRepo.id,
        );

        if (!execution.meta.actions.includes('rerun')) {
            ctx.throw(400, 'Execution does not allow "rerun" action');
        }

        const { owner, repo, commit } = ctx.params;

        const repoId = util.buildRepoId(
            owner,
            repo,
        );

        ctx.logInfo(`Getting installation for ${repoId}...`);
        let repoInstallation;
        try {
            repoInstallation = await github.getRepositoryInstallation(
                ctx.ciApp.githubAppId,
                ctx.ciApp.githubApiUrl,
                async () => {
                    // TODO: Should cache the GitHub App private key.
                    ctx.logInfo('Getting GitHub App private key from SSM...');
                    return Buffer.from(
                        await aws.getSSMParam(ctx.ciApp.githubAppPrivateKeyParamName),
                        'base64',
                    );
                },
                owner,
                repo,
            );
        }
        catch (err) {
            ctx.logError(`Failed to get installation for ${repoId} -- ${err.message}`);

            if (err.statusCode === 404) {
                ctx.throw(404, `No repo or repo config for ${repoId}`);
            }
            else {
                ctx.throw(500, `Failed to get determine GitHub App installation for ${repoId}`);
            }
        }

        // Load repo config.
        ctx.logInfo(`Getting repo config for ${repoId}...`);

        const fetchedConfig = await aws.getRepoConfig(
            ctx.ciApp.tableConfigName,
            repoId,
        );

        if (!fetchedConfig) {
            ctx.throw(404, `No repo or repo config for ${repoId}`);
        }

        const repoConfig = schema.validateRepoConfig({
            ...ctx.ciApp.globalRepoConfigDefaults,
            ...fetchedConfig,
        });

        // Get the token to access GitHub.
        ctx.logInfo(`Getting access token for installation ${repoInstallation.id}...`);
        const {
            token,
            expires_at: tokenExpiration,
        } = await github.getInstallationAccessToken(
            ctx.ciApp.githubAppId,
            ctx.ciApp.githubApiUrl,
            async () => {
                ctx.logInfo('Getting GitHub App private key from SSM...');
                return Buffer.from(
                    await aws.getSSMParam(ctx.ciApp.githubAppPrivateKeyParamName),
                    'base64',
                );
            },
            repoInstallation.id,
            ctx.ciApp[INSTALLATION_TOKEN_CACHE],
        );

        const startResponse = await startExecution(
            ctx.ciApp,
            ctx.throw,
            ctx.req.traceId,
            token,
            tokenExpiration,
            repoConfig,
            {
                id: repository.owner.id,
                login: repository.owner.login,
                type: repository.owner.type,
            },
            {
                id: repository.id,
                name: repository.name,
            },
            {
                type: 'rerun',
                sender: {
                    id: ctx.session.githubUser.id,
                    login: ctx.session.githubUser.login,
                    type: 'User',
                },
            },
            repoInstallation.id,
            commit,
        );

        ctx.body = {
            ...util.parseRepoId(repoConfig.id),
            ...util.parseExecutionId(startResponse.executionId),
        };
    })

    .get('/commit/:commit/exec/:executionNum/build/:buildKey/logs', async (ctx) => {
        const execution = await getExecution(ctx);

        const accessKey = await verifyRepoAccessByKey(
            ctx,
            'x-execution-logs-access-key',
            async () => (
                await aws.decryptString(ctx.session.encryptedGithubAuthToken)
            ).toString('utf8'),
            true,
            execution.meta.githubRepo.id,
        );

        const build = execution.state && execution.state.builds
            && execution.state.builds[ctx.params.buildKey];

        if (!build) {
            ctx.throw(404, 'Build not found for execution');
        }

        if (!build.codeBuild) {
            ctx.throw(404, 'Build has not yet started');
        }

        if (!build.codeBuild.logs || !build.codeBuild.logs.streamName) {
            ctx.throw(404, 'Build does not yet have logs');
        }

        const logResponse = await aws.getLogEvents(
            build.codeBuild.logs.groupName,
            build.codeBuild.logs.streamName,
            {
                nextToken: typeof ctx.query.nextToken === 'string'
                    ? ctx.query.nextToken
                    : undefined,
                limit: typeof ctx.query.limit === 'string' && ctx.query.limit.match(/^\d+$/)
                    ? Math.max(10, Math.min(100, parseInt(ctx.query.limit || 0) || 50))
                    : 50,
            },
        );

        ctx.body = {
            events: logResponse.events,
            nextForwardToken: logResponse.nextForwardToken,
            nextBackwardToken: logResponse.nextBackwardToken,
            accessKey,
        };
    });
