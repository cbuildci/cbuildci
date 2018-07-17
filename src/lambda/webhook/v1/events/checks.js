'use strict';

const util = require('../../../../common/util');
const schema = require('../../../../common/schema');
const aws = require('../../../util/aws');
const github = require('../../../util/github');
const webhookUtil = require('../util');

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
        const [, repoId, executionId] = ghEvent.check_run.external_id.match(/^(.+)\/execution\/(.+)$/);

        const execution = await aws.getExecution(
            ctx.ciApp.tableExecutionsName,
            repoId,
            executionId,
        );

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
                stop: {
                    user: ghEvent.sender.login,
                    requestTime: Date.now(),
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
            ? await github.getInstallationAccessToken(
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
                ctx.ciApp[webhookUtil.installationTokenCache],
            )
            : {
                token: await aws.decryptString(repoConfig.encryptedOAuthToken),
                expires_at: null,
            };

        await webhookUtil.startExecution(
            ctx,
            token,
            tokenExpiration,
            repoConfig,
            ghEvent.repository.owner.id,
            ghEvent.repository.id,
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
            ctx.throw(400, 'Missing requested_action.identifier property');
        }
    }

    if (gitHubEventType === 'check_suite') {
        if (!ghEvent.check_suite) {
            ctx.throw(400, 'Missing check_suite property');
        }

        if (typeof ghEvent.check_suite.head_sha !== 'string') {
            ctx.throw(400, 'Missing or invalid check_suite.head_sha property');
        }
    }

    if (gitHubEventType === 'check_run') {
        if (!ghEvent.check_run) {
            ctx.throw(400, 'Missing check_run property');
        }

        if (typeof ghEvent.check_run.head_sha !== 'string') {
            ctx.throw(400, 'Missing or invalid check_run.head_sha property');
        }

        if (typeof ghEvent.check_run.external_id !== 'string') {
            ctx.throw(400, 'Missing or invalid check_run.external_id property');
        }

        // Extract the repo and execution IDs.
        const externalIdMatch = ghEvent.check_run.external_id.match(/^(.+)\/execution\/(.+)$/);

        if (!externalIdMatch) {
            ctx.throw(400, 'Invalid external_id');
        }

        if (!util.isValidRepoId(externalIdMatch[1])) {
            ctx.throw(400, 'Invalid repo ID in external_id');
        }

        if (!util.isValidExecutionId(externalIdMatch[2])) {
            ctx.throw(400, 'Invalid exectuion ID in external_id');
        }
    }

    if (!ghEvent.sender) {
        ctx.throw(400, 'Missing sender property');
    }

    if (typeof ghEvent.sender.login !== 'string') {
        ctx.throw(400, 'Missing or invalid sender.login property');
    }
}
