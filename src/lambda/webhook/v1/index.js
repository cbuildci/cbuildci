'use strict';

const bodyParser = require('koa-bodyparser');
const koaRouter = require('koa-router');
const crypto = require('crypto');
const util = require('../../../common/util');
const cacheUtil = require('../../../common/cache');
const schema = require('../../../common/schema');
const aws = require('../../util/aws');
const github = require('../../util/github');
const { validateRepositoryEvent } = require('./util');

const handlePullRequestEvent = require('./events/pullRequest');
const handleCheckEvent = require('./events/checks');

module.exports = koaRouter()
    .use(bodyParser({
        enableTypes: ['json'],
        jsonLimit: '64kb',
        onerror: (err, ctx) => {
            ctx.throw(err.status || 400, `Invalid JSON body -- ${err.message}`);
        },
    }))
    .use(async (ctx) => {
        // Init cache GitHub app installation access tokens, if missing.
        if (!ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE]) {
            ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE] = {};
            ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE_LAST_PRUNE] = Date.now();
        }

        // Prune expired tokens from the cache.
        else if (ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE_LAST_PRUNE] + 300000 < Date.now()) {
            cacheUtil.pruneCache(
                ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE],
                (cached, key) => !key.startsWith('userToken:') || !github.isTokenExpired(cached.expires_at, 0),
            );
            ctx.ciApp[cacheUtil.INSTALLATION_TOKEN_CACHE_LAST_PRUNE] = Date.now();
        }
    })
    .post('/:repoId', async (ctx) => {
        await webhookRoute(ctx);
    });

async function webhookRoute(ctx) {
    if (!ctx.is('application/json')) {
        ctx.throw(400, '"Content-Type" must be application/json');
    }

    const ghEvent = ctx.request.body;

    // Verify the request body is an object.
    if (!ghEvent || typeof ghEvent !== 'object') {
        ctx.throw(400, 'Invalid event payload');
    }

    const repoId = ctx.params.repoId;
    const isForGitHubApp = repoId === 'app';

    // Validate the config ID, if not "app".
    if (!isForGitHubApp && !util.isValidRepoId(repoId)) {
        ctx.throw(400, `Webhook identifier is invalid: ${repoId}`);
    }

    // Require the HMAC signature header.
    if (typeof ctx.headers['x-hub-signature'] !== 'string') {
        ctx.throw(400, 'Missing HMAC signature header');
    }
    else if (!ctx.headers['x-hub-signature'].match(/^sha1=[a-f0-9]{40}$/i)) {
        ctx.throw(400, 'Invalid HMAC signature header');
    }

    let repoConfig = null;

    if (!isForGitHubApp) {
        ctx.logInfo(`Getting repo config for ${repoId}...`);

        const fetchedConfig = await aws.getRepoConfig(
            ctx.ciApp.tableConfigName,
            repoId,
        );

        if (!fetchedConfig) {
            const message = `Skipping event: No repo config for ${repoId}`;
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

    // Get the secret used to validate the HMAC signature.
    let webhookSecret = null;
    if (isForGitHubApp) {
        ctx.logInfo('Getting GitHub App webhook secret from SSM...');
        webhookSecret = await aws.getSSMParam(ctx.ciApp.githubAppHMACSecretParamName);
    }
    else if (!repoConfig.encryptedWebhookSecret) {
        ctx.throw(400, 'Repo config must have encryptedWebhookSecret property to use repository webhooks');
    }
    else if (!repoConfig.encryptedOAuthToken) {
        ctx.throw(400, 'Repo config must have encryptedOAuthToken property to use repository webhooks');
    }
    else {
        ctx.logInfo('Decrypting webhook secret...');
        webhookSecret = await aws.decryptString(repoConfig.encryptedWebhookSecret);
    }

    const calculatedHMACSignature =
        'sha1=' + crypto.createHmac('sha1', webhookSecret)
            .update(ctx.request.rawBody)
            .digest('hex');

    ctx.logInfo('Verifying GitHub App HMAC signature...');
    if (ctx.headers['x-hub-signature'] !== calculatedHMACSignature) {
        ctx.throw(400, 'Invalid HMAC signature');
    }

    if (isForGitHubApp) {
        if (!ghEvent.installation || typeof ghEvent.installation.id !== 'number') {
            ctx.throw(400, 'Missing installation ID for GitHub App check_run event');
        }
    }
    else {
        // Verify the event contains repository metadata.
        validateRepositoryEvent(ctx, ghEvent);

        const eventRepoId = util.buildRepoId(
            ghEvent.repository.owner.login,
            ghEvent.repository.name,
        );

        // Verify that the owner/repo for the pull request event matches the repo config.
        // This can be a mismatch if the wrong URL is used for GitHub webhooks.
        if (repoConfig.id !== eventRepoId) {
            ctx.throw(400, `Webhook identifier is "${eventRepoId}" but repo config identifier is "${repoConfig.id}"`);
        }
    }

    const gitHubEventType = ctx.headers['x-github-event'];

    if (gitHubEventType === 'pull_request') {
        ctx.logInfo(`Processing ${gitHubEventType} GitHub event...`);
        await handlePullRequestEvent(
            ctx,
            ghEvent,
            repoConfig,
        );
    }
    else if (gitHubEventType === 'check_suite' || gitHubEventType === 'check_run') {
        ctx.logInfo(`Processing ${gitHubEventType} GitHub event...`);
        await handleCheckEvent(
            ctx,
            gitHubEventType,
            ghEvent,
            repoConfig,
        );
    }
    else {
        ctx.throw(400, `Unsupported GitHub event type: ${gitHubEventType}`);
    }
}
