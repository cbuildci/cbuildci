'use strict';

const koaRouter = require('koa-router');

module.exports = koaRouter()
    .get('/', async (ctx) => {
        ctx.body = {
            id: ctx.session.githubUser.id,
            node_id: ctx.session.githubUser.node_id,
            avatar_url: ctx.session.githubUser.avatar_url,
            login: ctx.session.githubUser.login,
            name: ctx.session.githubUser.name,
            email: ctx.session.githubUser.email,
        };
    });
