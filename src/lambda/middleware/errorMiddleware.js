'use strict';

const statuses = require('statuses');

module.exports = () => async (ctx, next) => {
    try {
        await next();
    }
    catch (err) {
        if (err.status !== 404 && !err.expose) {
            ctx.logError(err.stack || err.toString());
        }

        ctx.status = err.status || 500;
        const body = {};

        if (err.expose) {
            for (const key of ['name', 'code', 'message'].concat(Object.keys(err))) {
                try {
                    if (key !== 'stack' && err[key] !== undefined) {
                        body[key] = err[key];
                    }
                }
                catch (err) {
                    body[key] = `Error reading property -- ${err.stack || err.toString()}`;
                }
            }
        }
        else {
            body.message = statuses[ctx.status] || 'Error';
        }

        ctx.body = body;
    }
};
