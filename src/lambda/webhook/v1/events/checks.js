'use strict';

const util = require('../../../../common/util');
const cacheUtil = require('../../../../common/cache');
const schema = require('../../../../common/schema');
const aws = require('../../../util/aws');
const github = require('../../../util/github');
const webhookUtil = require('../util');
const { startExecution } = require('../../../util/startExecution');

/**
 * @param {object} ctx
 * @param {string} gitHubEventType
 * @param {object} ghEvent
 * @param {RepoConfig} repoConfig
 */
module.exports = async function handleCheckEvent(ctx, gitHubEventType, ghEvent, repoConfig) {
    const isForGitHubApp = ctx.params.repoId === 'app';

    validateCheckEvent(ctx, gitHubEventType, ghEvent);

    if (gitHubEventType === 'check_run' && ghEvent.action === 'requested_action' && ghEvent.requested_action.identifier === 'stop') {
        const { owner, repo, commit, executionNum } = util.parseLongExecutionId(ghEvent.check_run.external_id);

        const execution = await aws.getExecution(
            ctx.ciApp.tableExecutionsName,
            util.buildRepoId(owner, repo),
            util.buildExecutionId(commit, executionNum),
        );

        if (!execution.state || !execution.state.isRunning || execution.state.errorInfo) {
            ctx.logInfo('Aborting as execution is not running');
            ctx.throw(400, 'Execution is not running');
        }

        if (execution.meta.stop) {
            ctx.logInfo('Aborting as already stopping');
            ctx.throw(400, 'Execution is already stopping');
        }

        await aws.updateExecution(
            ctx.ciApp.tableExecutionsName,
            execution.repoId,
            execution.executionId,
            {
                meta: {
                    stop: {
                        user: ghEvent.sender.login,
                        requestTime: new Date().toISOString(),
                    },
                },
            },
        );

        ctx.body = {
            message: 'Requested Stop',
        };
    }
    else if ((gitHubEventType === 'check_suite' || gitHubEventType === 'check_run') && ghEvent.action === 'rerequested'
        || gitHubEventType === 'check_run' && ghEvent.action === 'requested_action' && ghEvent.requested_action.identifier === 'rerun') {

        const eventRepoId = util.buildRepoId(
            ghEvent.repository.owner.login,
            ghEvent.repository.name,
        );

        // Load repo config if not yet loaded.
        if (!repoConfig) {
            ctx.logInfo(`Getting repo config for ${eventRepoId}...`);

            const fetchedConfig = await aws.getRepoConfig(
                ctx.ciApp.tableConfigName,
                eventRepoId,
            );

            if (!fetchedConfig) {
                const message = `Skipping event: No repo config for ${eventRepoId}`;
                ctx.logInfo(message);
                ctx.body = {
                    message,
                };
                return;
            }

            repoConfig = schema.validateRepoConfig({
                ...ctx.ciApp.globalRepoConfigDefaults,
                ...fetchedConfig,
            });
        }

        // Get the token to access GitHub.
        ctx.logInfo(
            isForGitHubApp
                ? `Getting access token for installation ${ghEvent.installation.id}...`
                : 'Decrypting OAuth token...'
        );
        const {
            token,
            expires_at: tokenExpiration,
        } = isForGitHubApp
            ? await cacheUtil.getCachedValue(
                ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE],
                `userToken:${github.parseGitHubUrl(ctx.ciApp.githubApiUrl).hostname}/${ghEvent.installation.id}`,
                (cached) => !github.isTokenExpired(cached.expires_at),
                () => github.getInstallationAccessToken(
                    ctx.ciApp.githubAppId,
                    ctx.ciApp.githubApiUrl,
                    async () => {
                        ctx.logInfo('Getting GitHub App private key from SSM...');
                        return Buffer.from(
                            await aws.getSSMParam(ctx.ciApp.githubAppPrivateKeyParamName),
                            'base64',
                        );
                    },
                    ghEvent.installation.id,
                ),
            )
            : {
                token: await aws.decryptString(repoConfig.encryptedOAuthToken),
                expires_at: null,
            };

        ctx.body = await startExecution(
            ctx.ciApp,
            ctx.throw,
            ctx.req.traceId,
            token,
            tokenExpiration,
            repoConfig,
            {
                id: ghEvent.repository.owner.id,
                login: ghEvent.repository.owner.login,
                type: ghEvent.repository.owner.type,
            },
            {
                id: ghEvent.repository.id,
                name: ghEvent.repository.name,
            },
            {
                type: gitHubEventType,
                action: ghEvent.action,
                sender: {
                    id: ghEvent.sender.id,
                    login: ghEvent.sender.login,
                    type: ghEvent.sender.type,
                },
                check_run: ghEvent.check_run && {
                    id: ghEvent.check_run.id,
                },
                requested_action: ghEvent.requested_action && {
                    identifier: ghEvent.requested_action.identifier,
                },
                pull_requests: ghEvent[gitHubEventType].pull_requests.map((pullRequest) => ({
                    id: pullRequest.id,
                    number: pullRequest.number,
                    head: {
                        ref: pullRequest.head.ref,
                        sha: pullRequest.head.sha,
                    },
                    base: {
                        ref: pullRequest.base.ref,
                        sha: pullRequest.base.sha,
                    },
                })),
            },
            isForGitHubApp ? ghEvent.installation.id : null,
            ghEvent[gitHubEventType].head_sha,
        );
    }
    else if (ghEvent.action === 'rerequested') {
        ctx.throw(400, `Unsupported check run action identifier: ${ghEvent.requested_action.identifier}`);
    }
    else {
        ctx.throw(400, `Unsupported check run action: ${ghEvent.action}`);
    }
};

function validateCheckEvent(ctx, gitHubEventType, ghEvent) {
    webhookUtil.validateRepositoryEvent(ctx, ghEvent);

    if (!ghEvent.action) {
        ctx.throw(400, 'Missing action property');
    }

    if (ghEvent.action === 'requested_action') {
        if (!ghEvent.requested_action) {
            ctx.throw(400, 'Missing requested_action property');
        }

        if (typeof ghEvent.requested_action.identifier !== 'string') {
            ctx.throw(400, 'Missing or non-string requested_action.identifier property');
        }
    }

    if (gitHubEventType === 'check_suite') {
        if (!ghEvent.check_suite) {
            ctx.throw(400, 'Missing check_suite property');
        }

        if (typeof ghEvent.check_suite.head_sha !== 'string') {
            ctx.throw(400, 'Missing or non-string check_suite.head_sha property');
        }
    }

    if (gitHubEventType === 'check_run') {
        if (!ghEvent.check_run) {
            ctx.throw(400, 'Missing check_run property');
        }

        if (typeof ghEvent.check_run.id !== 'number') {
            ctx.throw(400, 'Missing or non-number check_run.id property');
        }

        if (typeof ghEvent.check_run.head_sha !== 'string') {
            ctx.throw(400, 'Missing or non-string check_run.head_sha property');
        }

        if (typeof ghEvent.check_run.external_id !== 'string') {
            ctx.throw(400, 'Missing or non-string check_run.external_id property');
        }

        if (!util.parseLongExecutionId(ghEvent.check_run.external_id)) {
            ctx.throw(400, 'Invalid format for check_run.external_id property');
        }
    }

    const baseEventObject = ghEvent[gitHubEventType];

    if (!Array.isArray(baseEventObject.pull_requests)) {
        ctx.throw(400, `Missing or invalid ${gitHubEventType}.pull_requests property`);
    }

    baseEventObject.pull_requests.forEach((pullRequest, i) => {
        if (typeof pullRequest.id !== 'number') {
            ctx.throw(400, `Missing or non-number ${gitHubEventType}.pull_requests.${i}.id property`);
        }

        if (typeof pullRequest.number !== 'number') {
            ctx.throw(400, `Missing or non-number pull_request.${i}.number property`);
        }

        if (typeof pullRequest.head.ref !== 'string') {
            ctx.throw(400, `Missing or non-string ${gitHubEventType}.pull_requests.${i}.head.ref`);
        }

        if (typeof pullRequest.head.sha !== 'string' || !util.isValidSha(pullRequest.head.sha)) {
            ctx.throw(400, `Missing or invalid ${gitHubEventType}.pull_requests.${i}.head.sha`);
        }

        if (!pullRequest.base) {
            ctx.throw(400, `Missing ${gitHubEventType}.pull_requests.${i}.base property`);
        }

        if (typeof pullRequest.base.ref !== 'string') {
            ctx.throw(400, `Missing or non-string ${gitHubEventType}.pull_requests.${i}.base.ref`);
        }

        if (typeof pullRequest.base.sha !== 'string' || !util.isValidSha(pullRequest.base.sha)) {
            ctx.throw(400, `Missing or invalid ${gitHubEventType}.pull_requests.${i}.base.sha`);
        }
    });

    if (!ghEvent.sender) {
        ctx.throw(400, 'Missing sender property');
    }

    if (typeof ghEvent.sender.id !== 'number') {
        ctx.throw(400, 'Missing or non-number sender.id property');
    }

    if (typeof ghEvent.sender.login !== 'string') {
        ctx.throw(400, 'Missing or non-string sender.login property');
    }

    if (typeof ghEvent.sender.type !== 'string') {
        ctx.throw(400, 'Missing or non-string sender.type property');
    }
}
