'use strict';

const url = require('url');
const qs = require('querystring');
const crypto = require('crypto');
const koaRouter = require('koa-router');
const typeis = require('type-is');
const { cacheAsyncResult } = require('../../../common/util');
const aws = require('../../util/aws');
const github = require('../../util/github');
const { request } = require('../../util/request');

const getGithubAppClientSecret = Symbol('getGithubAppClientSecret');

module.exports = koaRouter()
    .use(async (ctx, next) => {
        // Add helper to fetch and cache the GitHub App client secret.
        if (!ctx.ciApp[getGithubAppClientSecret]) {
            ctx.ciApp[getGithubAppClientSecret] = cacheAsyncResult(async () => {
                return await aws.getSSMParam(
                    ctx.ciApp.githubAppClientSecretParamName,
                );
            }, { expirationMs: 300000 });
        }

        await next();
    })
    .get('/logout', async (ctx) => {
        ctx.session = null;
        ctx.body = {
            message: 'Logged out',
        };
    })
    .get('/redirect', async (ctx) => {
        if (ctx.session.githubUser) {

            // Redirect to the specified URL, if provided.
            if (ctx.query.returnTo) {
                ctx.redirect(ctx.query.returnTo);
                return;
            }

            ctx.throw(400, 'User session already active');
        }

        ctx.session.state = crypto.randomBytes(32).toString('hex');

        let callbackQuery = {};
        if (ctx.query.returnTo) {
            callbackQuery.returnTo = ctx.query.returnTo;
        }

        const parsedGithubUrl = github.parseGitHubUrl(ctx.ciApp.githubUrl);
        parsedGithubUrl.pathname = `${parsedGithubUrl.pathname}/login/oauth/authorize`;
        parsedGithubUrl.query = {
            client_id: ctx.ciApp.githubAppClientId,
            redirect_uri: `${ctx.ciApp.baseUrl}/api/v1/auth/callback?${qs.stringify(callbackQuery)}`,
            state: ctx.session.state,
        };

        ctx.redirect(url.format(parsedGithubUrl));
    })
    .get('/callback', async (ctx) => {
        if (!ctx.query.code || !ctx.query.state) {
            ctx.throw(400, 'Must have "code" and "state" in the query string');
        }

        if (ctx.session.githubUser) {
            ctx.throw(400, 'User session already active');
        }

        if (!ctx.session.state || ctx.session.state !== ctx.query.state) {
            ctx.throw(400, 'Invalid state for session', {
                authRedirectUrl: `${ctx.ciApp.baseUrl}/api/v1/auth/redirect`,
            });
        }

        // Get the access token for the authenticated user.
        const tokenResponse = await request(
            'POST',
            `${ctx.ciApp.githubUrl}/login/oauth/access_token`,
            qs.stringify({
                client_id: ctx.ciApp.githubAppClientId,
                client_secret: await ctx.ciApp[getGithubAppClientSecret](),
                code: ctx.query.code,
                redirect_uri: `${ctx.ciApp.baseUrl}/api/v1/auth/callback`,
                state: ctx.query.state,
            }),
        );

        if (tokenResponse.statusCode !== 200) {
            ctx.logError(`Invalid response status for GitHub auth callback: ${tokenResponse.statusCode}\n${JSON.stringify(tokenResponse.data, null, 2)}`);
            ctx.throw(500, 'Invalid response from GitHub (status code)', { statusCode: tokenResponse.status });
        }
        else if (!typeis.is(tokenResponse.headers['content-type'], 'application/x-www-form-urlencoded')) {
            ctx.logError(`Invalid content-type for GitHub auth callback: ${tokenResponse.headers['content-type']}\n${JSON.stringify(tokenResponse.data, null, 2)}`);
            ctx.throw(500, 'Invalid response from GitHub (content-type)', { contentType: tokenResponse.headers['content-type'] });
        }
        else if (!tokenResponse.data || !tokenResponse.data.access_token || !tokenResponse.data.token_type) {
            ctx.logError(`Invalid payload data for GitHub auth callback\n${JSON.stringify(tokenResponse.data, null, 2)}`);
            ctx.throw(500, 'Invalid response from GitHub (payload)');
        }
        else {
            const userResponse = await github.getUser(
                ctx.ciApp.githubApiUrl,
                tokenResponse.data.access_token,
            );

            if (userResponse.statusCode !== 200) {
                ctx.logError(`Failed to get authenticated user data\n[${userResponse.statusCode}] ${JSON.stringify(userResponse.data, null, 2)}`);
                ctx.throw(500, 'Failed to retrieve authenticated user metadata from GitHub');
            }
            else {
                if (userResponse.data.type !== 'User') {
                    ctx.logError(`Invalid authenticated user "type" for user "${userResponse.data.login}": ${userResponse.data.type}`);
                    ctx.throw(500, 'Invalid authenticated user type from GitHub', { login: userResponse.data.login, type: userResponse.data.type });
                }

                ctx.session.githubUser = {
                    id: userResponse.data.id,
                    node_id: userResponse.data.node_id,
                    avatar_url: userResponse.data.avatar_url,
                    login: userResponse.data.login,
                    site_admin: userResponse.data.site_admin,
                    name: userResponse.data.name,
                    email: userResponse.data.email,
                    two_factor_authentication: userResponse.data.two_factor_authentication,
                };

                ctx.session.encryptedGithubAuthToken = await aws.encryptString(
                    ctx.ciApp.secretsKMSArn,
                    tokenResponse.data.access_token,
                );
            }

            let redirectQuery = {};
            if (ctx.query.returnTo) {
                redirectQuery.returnTo = ctx.query.returnTo;
            }

            ctx.redirect(`${ctx.ciApp.baseUrl}/api/v1/auth/success?${qs.stringify(redirectQuery)}`);
        }
    })
    .get('/success', async (ctx) => {
        if (!ctx.session.githubUser) {
            ctx.throw(403, 'Login Required', {
                authRedirectUrl: `${ctx.ciApp.baseUrl}/api/v1/auth/redirect`,
            });
        }

        // Redirect to the specified URL, if provided.
        if (ctx.query.returnTo) {
            ctx.redirect(ctx.query.returnTo);
            return;
        }

        const userResponse = await github.getUser(
            ctx.ciApp.githubApiUrl,
            (await aws.decryptString(ctx.session.encryptedGithubAuthToken)).toString('utf8'),
        );

        ctx.body = {
            user: ctx.session.githubUser,
            check: userResponse.statusCode === 200
                ? userResponse.data.login
                : userResponse,
        };
    });
