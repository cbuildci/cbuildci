'use strict';

const util = require('../../../../common/util');
const cacheUtil = require('../../../../common/cache');
const schema = require('../../../../common/schema');
const aws = require('../../../util/aws');
const github = require('../../../util/github');
const { validateRepositoryEvent } = require('../util');
const { startExecution } = require('../../../util/startExecution');

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
        ? await cacheUtil.getCachedValue(
            ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE],
            `userToken:${exports.parseGitHubUrl(ctx.ciApp.githubApiUrl).hostname}/${ghEvent.installation.id}`,
            (cached) => !exports.isTokenExpired(cached.expires_at),
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

    await startExecution(
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
            type: 'pull_request',
            action: ghEvent.action,
            pull_request: {
                id: ghEvent.pull_request.id,
                number: ghEvent.pull_request.number,
                head: {
                    ref: ghEvent.pull_request.head.ref,
                    sha: ghEvent.pull_request.head.sha,
                },
                base: {
                    ref: ghEvent.pull_request.base.ref,
                    sha: ghEvent.pull_request.base.sha,
                },
            },
            sender: {
                id: ghEvent.sender.id,
                login: ghEvent.sender.login,
                type: ghEvent.sender.type,
            },
        },
        isForGitHubApp ? ghEvent.installation.id : null,
        ghEvent.pull_request.head.sha,
    );
};

function validatePullRequestEvent(ctx, ghEvent) {
    validateRepositoryEvent(ctx, ghEvent);

    if (!ghEvent.pull_request) {
        ctx.throw(400, 'Missing pull_request property');
    }

    if (!ghEvent.pull_request.head) {
        ctx.throw(400, 'Missing pull_request.head property');
    }

    if (typeof ghEvent.pull_request.id !== 'number') {
        ctx.throw(400, 'Missing or invalid pull_request.id property');
    }

    if (typeof ghEvent.pull_request.number !== 'number') {
        ctx.throw(400, 'Missing or invalid pull_request.number property');
    }

    if (typeof ghEvent.pull_request.head.ref !== 'string') {
        ctx.throw(400, 'Missing or non-string pull_request.head.ref');
    }

    if (typeof ghEvent.pull_request.head.sha !== 'string' || !util.isValidSha(ghEvent.pull_request.head.sha)) {
        ctx.throw(400, 'Missing or invalid pull_request.head.sha');
    }

    if (!ghEvent.pull_request.base) {
        ctx.throw(400, 'Missing pull_request.base property');
    }

    if (typeof ghEvent.pull_request.base.ref !== 'string') {
        ctx.throw(400, 'Missing or non-string pull_request.base.ref');
    }

    if (typeof ghEvent.pull_request.base.sha !== 'string' || !util.isValidSha(ghEvent.pull_request.base.sha)) {
        ctx.throw(400, 'Invalid or missing pull_request.base.sha');
    }

    if (!ghEvent.sender) {
        ctx.throw(400, 'Missing or invalid sender');
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
