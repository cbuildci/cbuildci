'use strict';

const koaRouter = require('koa-router');

module.exports = koaRouter()

    // ===================================================
    // APIs that do NOT require login
    // ===================================================

    .get('/', async (ctx) => {
        ctx.body = {
            app: {
                baseUrl: ctx.ciApp.baseUrl,
                githubUrl: ctx.ciApp.githubUrl,
                githubHost: ctx.ciApp.githubHost,
                githubNoBuildLabels: ctx.ciApp.githubNoBuildLabels,
            },
            endpoints: {
                searchByRepoUrl: `${ctx.ciApp.baseUrl}/api/v1/repo/{owner}/{repo}`,
                searchByCommitUrl: `${ctx.ciApp.baseUrl}/api/v1/repo/{owner}/{repo}/commit/{commit}`,
                getExecutionUrl: `${ctx.ciApp.baseUrl}/api/v1/repo/{owner}/{repo}/commit/{commit}/exec/{executionNum}`,
                executionActionUrl: `${ctx.ciApp.baseUrl}/api/v1/repo/{owner}/{repo}/commit/{commit}/exec/{executionNum}/action/{actionRequested}`,
                getExecutionBuildLogsUrl: `${ctx.ciApp.baseUrl}/api/v1/repo/{owner}/{repo}/commit/{commit}/exec/{executionNum}/build/{buildKey}/logs?limit={limit}&nextToken={nextToken}`,
                authRedirectUrl: `${ctx.ciApp.baseUrl}/api/v1/auth/redirect?returnTo={url}`,
                logoutUrl: `${ctx.ciApp.baseUrl}/api/v1/auth/logout?redirect={url}`,
            },
            user: ctx.session && ctx.session.githubUser ? {
                id: ctx.session.githubUser.id,
                node_id: ctx.session.githubUser.node_id,
                avatar_url: ctx.session.githubUser.avatar_url,
                login: ctx.session.githubUser.login,
                name: ctx.session.githubUser.name,
                email: ctx.session.githubUser.email,
            } : null,
        };
    })

    // Auth routes are used to manage the login session.
    .use('/auth', require('./auth').routes())

    // Require login session for other routes.
    .use(async (ctx, next) => {
        if (!ctx.session.githubUser) {
            ctx.throw(403, 'Login Required', {
                authRedirectUrl: `${ctx.ciApp.baseUrl}/api/v1/auth/redirect`,
            });
        }
        else {
            await next();
        }
    })

    // ===================================================
    // APIs that DO require login
    // ===================================================

    // Routes that require a login session.
    .use('/repo', require('./repo').routes());
