'use strict';

const koaRouter = require('koa-router');
const util = require('../../../common/util');
const aws = require('../../util/aws');
const github = require('../../util/github');

async function getExecution(token, ctx) {
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

async function verifyRepoAccess(token, ctx, execution = null) {
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

    if (execution) {
        // Verify the repo id matches the one in the execution,
        // just in case a user/repo was deleted and then recreated.
        if (repositoryResponse.data.id !== execution.meta.githubRepo.id) {
            ctx.logWarn(`Repository ${util.buildRepoId(owner, repo)} mismatched id in execution: ${repositoryResponse.data.id} !== ${execution.meta.githubRepo.id}`);
            ctx.throw(500, 'The internal ID for the repository does not match (was the repo deleted and recreated?)');
        }
    }

    if (!repositoryResponse.data.permissions.push) {
        ctx.logWarn(`User "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id}) does not have write access to repo ${repoId}`);
        ctx.throw(404, 'Repository or execution not found');
    }
}

module.exports = koaRouter({
    prefix: '/:owner/:repo',
})
    .get('/commit/:commit/exec/:executionNum', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        let executionAccessKey = ctx.headers['x-execution-access-key'];

        // Verify the encrypted access key, if provided.
        if (executionAccessKey) {
            try {
                // Decrypt and parse the access key.
                const {
                    sessionInternalIdentifier,
                    expirationTime,
                    accessTo,
                } = JSON.parse((await aws.decryptString(executionAccessKey)).toString('utf8'));

                // Reset the access key if isn't valid or has expired.
                if (sessionInternalIdentifier !== ctx.session.internalIdentifier
                    || expirationTime < Date.now()
                    || accessTo !== ctx.url) {
                    executionAccessKey = null;
                }
            }
            catch (err) {
                executionAccessKey = null;
                ctx.logError(`Invalid execution access key for user "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id}): [${err.name}] ${err.message}`);
            }
        }

        // Create a temporary access key, if one was not provided and the execution has not completed.
        // This allows us to reduce the number of requests to GitHub when the UI is continually fetching execution data.
        if (!executionAccessKey && execution.status !== 'COMPLETED') {
            await verifyRepoAccess(token, ctx, execution);
            executionAccessKey = await aws.encryptString(
                ctx.ciApp.secretsKMSArn,
                JSON.stringify({
                    sessionInternalIdentifier: ctx.session.internalIdentifier,
                    expirationTime: Date.now() + 300000, // 5 minutes
                    accessTo: ctx.url,
                }),
            );
        }

        ctx.body = {
            // Destruct the IDs into their parts.
            ...util.parseRepoId(execution.repoId),
            ...util.parseExecutionId(execution.executionId),

            // Include the access key, if it was set.
            executionAccessKey,

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
        };
    })

    .get('/commit/:commit/exec/:executionNum/stop', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        if (!execution.state || !execution.state.isRunning || execution.state.errorInfo) {
            ctx.throw(400, 'Execution is not running');
        }

        if (execution.meta.stop) {
            ctx.throw(400, 'Execution is already stopping');
        }

        await aws.updateExecution(
            ctx.ciApp.tableExecutionsName,
            execution.repoId,
            execution.executionId,
            {
                meta: {
                    stop: {
                        user: ctx.session.githubUser.login,
                        requestTime: Date.now(),
                    },
                },
            },
        );

        ctx.body = {
            message: 'success',
        };
    })

    .get('/commit/:commit/exec/:executionNum/build/:buildKey', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        const build = execution.state && execution.state.builds
            && execution.state.builds[ctx.params.buildKey];

        if (!build) {
            ctx.throw(404, 'Build not found for execution');
        }

        const buildStatus = build.codeBuild && (
            await aws.getBatchBuildStatus(
                [aws.parseArn(build.codeBuild.arn).buildId],
            )
        )[0];

        let latestLogs = null;
        if (buildStatus && buildStatus.logs) {
            try {
                latestLogs = await aws.getLogEvents(
                    buildStatus.logs.groupName,
                    buildStatus.logs.streamName,
                    {
                        limit: 20,
                    },
                );
            }
            catch (err) {
                ctx.logError(`Failed to get logs: ${err.message}`);
            }
        }

        ctx.body = {
            build,
            status: buildStatus ? {
                id: buildStatus.id,
                arn: buildStatus.arn,
                startTime: buildStatus.startTime,
                endTime: buildStatus.endTime,
                currentPhase: buildStatus.currentPhase,
                buildStatus: buildStatus.buildStatus,
                projectName: buildStatus.projectName,
                buildComplete: buildStatus.buildComplete,
                logs: buildStatus.logs,
                phases: buildStatus.phases,
            } : null,
            latestLogs,
        };
    })

    .get('/commit/:commit/exec/:executionNum/build/:buildKey/logs', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        const build = execution.state && execution.state.builds
            && execution.state.builds[ctx.params.buildKey];

        if (!build) {
            ctx.throw(404, 'Build not found for execution');
        }

        const codeBuildStatus = build.codeBuild && (
            await aws.getBatchBuildStatus(
                [aws.parseArn(build.codeBuild.arn).buildId],
            )
        )[0];

        if (!codeBuildStatus) {
            ctx.throw(404, 'Build has not yet started');
        }

        const logResponse = await aws.getLogEvents(
            build.logs.groupName,
            build.logs.streamName,
            {
                nextToken: typeof ctx.query.nextToken === 'string'
                    ? ctx.query.nextToken
                    : undefined,
                limit: typeof ctx.query.limit === 'string'
                    ? Math.max(10, Math.min(100, parseInt(ctx.query.limit || 0) || 50))
                    : 50,
            },
        );

        ctx.body = {
            events: logResponse.events,
            nextForwardToken: logResponse.nextForwardToken,
            nextBackwardToken: logResponse.nextBackwardToken,
        };
    });
