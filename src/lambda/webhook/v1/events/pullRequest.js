'use strict';

const util = require('../../../../common/util');
const schema = require('../../../../common/schema');
const aws = require('../../../util/aws');
const github = require('../../../util/github');
const webhookUtil = require('../util');

/**
 * @param {object} ctx
 * @param {object} ghEvent
 * @param {RepoConfig} repoConfig
 */
module.exports = async function handlePullRequestEvent(ctx, ghEvent, repoConfig) {
    const isForGitHubApp = ctx.params.repoId === 'app';

    validatePullRequestEvent(ctx, ghEvent);

    if (ghEvent.pull_request.state !== 'open') {
        const message = `Skipping event: Pull request not "open": ${ghEvent.pull_request.state}`;
        ctx.logInfo(message);
        ctx.body = {
            message,
        };
        return;
    }

    if (ghEvent.action !== 'synchronize' && ghEvent.action !== 'opened' && ghEvent.action !== 'unlabeled') {
        const message = `Skipping event: Unsupported pull request action: ${ghEvent.action}`;
        ctx.logInfo(message);
        ctx.body = {
            message,
        };
        return;
    }

    if (ghEvent.action === 'unlabeled' && util.hasLabel(ctx.ciApp.githubNoBuildLabels, ghEvent.label.name)) {
        const message = 'Skipping event: "unlabeled" action isn\'t for a label that prevents builds';
        ctx.logInfo(message);
        ctx.body = {
            message,
        };
        return;
    }

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

    if (ghEvent.action !== 'unlabeled') {
        ctx.logInfo('Checking for label that prevents builds...');
        const issue = await github.getIssue(
            ctx.ciApp.githubApiUrl,
            token,
            ghEvent.repository.owner.login,
            ghEvent.repository.name,
            ghEvent.pull_request.id,
        );

        if (issue.labels && issue.labels.some((label) => util.hasLabel(ctx.ciApp.githubNoBuildLabels, label.name))) {
            const message = 'Skip: Has label that prevents builds';
            ctx.logInfo(message);
            ctx.body = {
                message,
            };
            return;
        }
    }

    await webhookUtil.startExecution(
        ctx,
        token,
        tokenExpiration,
        repoConfig,
        ghEvent.repository.owner.id,
        ghEvent.repository.id,
        isForGitHubApp ? ghEvent.installation.id : null,
        ghEvent.pull_request.head.sha,
    );
};

function validatePullRequestEvent(ctx, ghEvent) {
    webhookUtil.validateRepositoryEvent(ctx, ghEvent);

    if (!ghEvent.pull_request) {
        ctx.throw(400, 'Missing pull_request property');
    }

    if (!ghEvent.pull_request.head) {
        ctx.throw(400, 'Missing pull_request.head property');
    }

    if (typeof ghEvent.pull_request.head.sha !== 'string' || !ghEvent.pull_request.head.sha.match(/^[0-9a-f]{40}$/)) {
        ctx.throw(400, 'Invalid or missing pull_request.head.sha');
    }
}