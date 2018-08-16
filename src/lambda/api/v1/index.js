'use strict';

const koaRouter = require('koa-router');

module.exports = koaRouter()

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

    .use('/user', require('./user').routes())

    // Routes that require a login session.
    .use('/repo', require('./repo').routes());
