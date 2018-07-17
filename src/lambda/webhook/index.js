'use strict';

const Koa = require('koa');
const koaRouter = require('koa-router');
const serverless = require('serverless-http');
const errorMiddleware = require('../middleware/errorMiddleware');
const CIApp = require('../CIApp');

// CIApp contains logging and config.
const ciApp = CIApp.create(process.env);

// Set up Koa app for CBuildCI.
const koaApp = new Koa();
ciApp.initKoa(koaApp);

koaApp.use(errorMiddleware());

koaApp.use(
    koaRouter()
        .use('/webhook/v1', require('./v1/index').routes())
        .routes(),
);

koaApp.use(async (ctx) => {
    ctx.throw(404);
});

// Wrap the Koa callback in a lambda adapter.
const handler = serverless(koaApp, {
    request(request, event, context) {
        request.traceId = `lambda:${context.logGroupName}:${context.logStreamName}:${context.awsRequestId}`;
    },
});

// TODO: Remove
if (process.env.DEBUG_KOA_LISTEN) {
    koaApp.listen(8899);
}

exports.koaApp = koaApp;
exports.handler = handler;
