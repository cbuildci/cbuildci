'use strict';

const koaRouter = require('koa-router');

module.exports = koaRouter()

    // ===================================================
    // APIs that do NOT require login
    // ===================================================

    // Auth routes are used to manage the login session.
    .use('/auth', require('./auth').routes())

    // Basic application config and user info.
    .use('/state', require('./state').routes())

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
