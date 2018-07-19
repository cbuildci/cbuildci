'use strict';

const koaRouter = require('koa-router');
const util = require('../../../common/util');
const aws = require('../../util/aws');
const github = require('../../util/github');

async function getExecution(token, ctx) {
    const repoId = util.buildRepoId(
        ctx.params.owner,
        ctx.params.repo,
    );

    const executionId = util.buildExecutionId(
        ctx.params.commit,
        ctx.params.executionNum,
    );

    const execution = await aws.getExecution(
        ctx.ciApp.tableExecutionsName,
        repoId,
        executionId,
    );

    // TODO: Verify owner and repo ID.

    if (!execution) {
        ctx.logWarn(`Execution "${executionId}" not found for repo "${repoId}" for user "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id})`);
        ctx.throw(404, 'Repository or execution not found');
    }

    const repositoryResponse = await github.getRepository(
        ctx.ciApp.githubApiUrl,
        token,
        ctx.params.owner,
        ctx.params.repo,
    );

    if (repositoryResponse.statusCode !== 200) {
        ctx.logWarn(`Repository ${repoId} not found for user "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id})`);
        ctx.throw(404, 'Repository or execution not found');
    }

    if (!repositoryResponse.data.permissions.push) {
        ctx.logWarn(`User "${ctx.session.githubUser.login}" (${ctx.session.githubUser.id}) does not have write access to repo ${repoId}`);
        ctx.throw(404, 'Repository or execution not found');
    }

    return execution;
}

module.exports = koaRouter({
    prefix: '/:owner/:repo',
})
    .get('/commit/:commit/exec/:executionNum', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        ctx.body = {
            ...util.parseRepoId(execution.repoId),
            ...util.parseExecutionId(execution.executionId),
            repoId: execution.repoId,
            executionId: execution.executionId,
            createTime: execution.createTime,
            updateTime: execution.updateTime,
            conclusion: execution.conclusion,
            conclusionTime: execution.conclusionTime,
            meta: execution.meta,
            state: execution.state && {
                isRunning: execution.state.isRunning,
                errorInfo: execution.state.errorInfo,
                commitSHA: execution.state.commitSHA,
                builds: execution.state.builds,
            },
        };
    })

    .get('/commit/:commit/exec/:executionNum/stop', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        if (!execution.state || !execution.state.isRunning || execution.state.errorInfo) {
            ctx.throw(400, 'Execution is not running');
        }

        if (execution.meta.stop) {
            ctx.throw(400, 'Execution is already stopping');
        }

        await aws.updateExecution(
            ctx.ciApp.tableExecutionsName,
            execution.repoId,
            execution.executionId,
            {
                meta: {
                    stop: {
                        user: ctx.session.githubUser.login,
                        requestTime: Date.now(),
                    },
                },
            },
        );

        ctx.body = {
            message: 'success',
        };
    })

    .get('/commit/:commit/exec/:executionNum/build/:buildKey', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        const build = execution.state && execution.state.builds
            && execution.state.builds[ctx.params.buildKey];

        if (!build) {
            ctx.throw(404, 'Build not found for execution');
        }

        const buildStatus = build.codeBuild && (
            await aws.getBatchBuildStatus(
                [aws.parseArn(build.codeBuild.arn).buildId],
            )
        )[0];

        let latestLogs = null;
        if (buildStatus && buildStatus.logs) {
            try {
                latestLogs = await aws.getLogEvents(
                    buildStatus.logs.groupName,
                    buildStatus.logs.streamName,
                    {
                        limit: 20,
                    },
                );
            }
            catch (err) {
                ctx.logError(`Failed to get logs: ${err.message}`);
            }
        }

        ctx.body = {
            build,
            status: buildStatus ? {
                id: buildStatus.id,
                arn: buildStatus.arn,
                startTime: buildStatus.startTime,
                endTime: buildStatus.endTime,
                currentPhase: buildStatus.currentPhase,
                buildStatus: buildStatus.buildStatus,
                projectName: buildStatus.projectName,
                buildComplete: buildStatus.buildComplete,
                logs: buildStatus.logs,
                phases: buildStatus.phases,
            } : null,
            latestLogs,
        };
    })

    .get('/commit/:commit/exec/:executionNum/build/:buildKey/logs', async (ctx) => {
        const token = (
            await aws.decryptString(ctx.session.encryptedGithubAuthToken)
        ).toString('utf8');

        const execution = await getExecution(token, ctx);

        const build = execution.state && execution.state.builds
            && execution.state.builds[ctx.params.buildKey];

        if (!build) {
            ctx.throw(404, 'Build not found for execution');
        }

        const codeBuildStatus = build.codeBuild && (
            await aws.getBatchBuildStatus(
                [aws.parseArn(build.codeBuild.arn).buildId],
            )
        )[0];

        if (!codeBuildStatus) {
            ctx.throw(404, 'Build has not yet started');
        }

        const logResponse = await aws.getLogEvents(
            build.logs.groupName,
            build.logs.streamName,
            {
                nextToken: typeof ctx.query.nextToken === 'string'
                    ? ctx.query.nextToken
                    : undefined,
                limit: typeof ctx.query.limit === 'string'
                    ? Math.max(10, Math.min(100, parseInt(ctx.query.limit || 0) || 50))
                    : 50,
            },
        );

        ctx.body = {
            events: logResponse.events,
            nextForwardToken: logResponse.nextForwardToken,
            nextBackwardToken: logResponse.nextBackwardToken,
        };
    });