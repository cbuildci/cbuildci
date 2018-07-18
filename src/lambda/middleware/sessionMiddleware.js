'use strict';

const url = require('url');
const koaSession = require('koa-session');
const aws = require('../util/aws');

module.exports = function createSessionMiddleware(koaApp, ciApp, opts = {}) {
    const { hostname, pathname } = url.parse(ciApp.baseUrl);

    return koaSession({
        maxAge: ciApp.maxSessionMinutes * 60000,
        domain: hostname,
        path: pathname || '/',
        ...opts,
        secure: true,
        overwrite: true,
        signed: true,
        renew: true,
        key: ciApp.sessionCookieKey,
        store: {
            async get(key) {
                const response = await aws.getSession(
                    ciApp.tableSessionsName,
                    key,
                );

                return response && response.sessionData;
            },
            async set(key, sessionData) {
                await aws.setSession(
                    ciApp.tableSessionsName,
                    key,
                    sessionData,
                );
            },
            async destroy(key) {
                await aws.destroySession(
                    ciApp.tableSessionsName,
                    key,
                );
            },
        },
    }, koaApp);
};
