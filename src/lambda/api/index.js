'use strict';

const Koa = require('koa');
const koaRouter = require('koa-router');
const serverless = require('serverless-http');
const errorMiddleware = require('../middleware/errorMiddleware');
const sessionMiddleware = require('../middleware/sessionMiddleware');
const CIApp = require('../CIApp');
const aws = require('../util/aws');
const { cacheAsyncResult } = require('../../common/util');

// CIApp contains logging and config.
const ciApp = CIApp.create(process.env);

// Set up Koa app for CBuildCI.
const koaApp = new Koa();
ciApp.initKoa(koaApp);

koaApp.use(async (ctx, next) => {
    const start = Date.now();
    try {
        await next();
    }
    catch (err) {
        throw err;
    }
    finally {
        console.log(`Request took ${Date.now() - start}ms`);
    }
});

koaApp.use(errorMiddleware());
koaApp.use(sessionMiddleware(koaApp, ciApp));

koaApp.use(
    koaRouter()
        .use('/api/v1', require('./v1/index').routes())
        .routes()
);

koaApp.use(async (ctx) => {
    ctx.throw(404);
});

// Get session secrets from SSM and cache for 5 minutes.
const getSessionSecrets = cacheAsyncResult(async () => {
    return (await aws.getSSMParam(ciApp.sessionSecretsParamName)).split(',');
}, { expirationMs: 300000 });

// Wrap the Koa callback in a lambda adapter.
const handler = ((koaCallback) => serverless((req, res) => {
    getSessionSecrets(
        ciApp.sessionSecretsParamName,
    )
        .then((keys) => {
            koaApp.keys = keys;

            // Call the Koa callback.
            process.nextTick(() => {
                koaCallback(req, res);
            });
        }, (err) => {
            ciApp.logError(`Failed to load session secrets: ${err.stack}`);
            res.statusCode = 500;
            res.json({
                message: 'Failed to load session secrets',
            });
        })
        .catch((err) => {
            process.nextTick(() => {
                throw err;
            });
        });
}))(koaApp.callback());

// TODO: Remove
if (process.env.DEBUG_KOA_LISTEN) {
    koaApp.keys = ['1234567890'];
    koaApp.listen(8899);
}

exports.koaApp = koaApp;
exports.handler = handler;
