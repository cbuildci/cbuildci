'use strict';

const uuid = require('uuid');
const yaml = require('js-yaml');
const { VError } = require('../../../common/v');
const util = require('../../../common/util');
const schema = require('../../../common/schema');
const aws = require('../../util/aws');
const github = require('../../util/github');

exports.installationTokenCache = Symbol('installationTokenCache');
exports.installationTokenCacheLastPrune = Symbol('installationTokenCacheLastPrune');

/**
 * Validate that an event contains repository metadata.
 *
 * @param {object} ctx
 * @param {object} ghEvent
 */
exports.validateRepositoryEvent = function validateRepositoryEvent(ctx, ghEvent) {
    if (!ghEvent.repository) {
        ctx.throw(400, 'Missing "repository" property');
    }

    if (typeof ghEvent.repository.id !== 'number') {
        ctx.throw(400, 'Missing or invalid "repository.id" property');
    }

    if (typeof ghEvent.repository.name !== 'string') {
        ctx.throw(400, 'Missing or invalid "repository.name" property');
    }

    if (!ghEvent.repository.owner) {
        ctx.throw(400, 'Missing "repository.owner" property');
    }

    if (typeof ghEvent.repository.owner.id !== 'number') {
        ctx.throw(400, 'Missing or invalid "repository.owner.id" property');
    }

    if (typeof ghEvent.repository.owner.login !== 'string') {
        ctx.throw(400, 'Missing or invalid "repository.owner.login" property');
    }

    if (typeof ghEvent.repository.owner.type !== 'string') {
        ctx.throw(400, 'Missing or invalid "repository.owner.type" property');
    }
};

exports.startExecution = async function startExecution(
    ctx,
    token,
    tokenExpiration,
    repoConfig,
    githubOwner,
    githubRepo,
    initiator,
    installationId,
    commitSHA
) {
    const isForGitHubApp = installationId != null;
    const { owner, repo } = util.parseRepoId(repoConfig.id);

    ctx.logInfo(`Getting ${ctx.ciApp.buildsYmlFile} for commit ${commitSHA}...`);
    const ymlContent = await github.getFileContent(
        ctx.ciApp.githubApiUrl,
        token,
        owner,
        repo,
        commitSHA,
        ctx.ciApp.buildsYmlFile,
        {
            maxSize: 65536,
        }
    );

    // Parse the repo builds YAML file.
    let ymlConfig = null;
    try {
        ymlConfig = yaml.safeLoad(ymlContent);

        ctx.logInfo(`Parsing ${ctx.ciApp.buildsYmlFile}...`);
        ymlConfig = schema.validateBuildsYml(ymlConfig);
    }
    catch (err) {
        const statusContext = ymlConfig && (ymlConfig.statusContext || ymlConfig.checksName) || 'CBuildCI';
        const errorMessageType = err instanceof VError
            ? 'has invalid properties'
            : ymlConfig
                ? 'error'
                : 'is invalid YAML';

        ctx.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        await github.pushCommitStatus(
            ctx.ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            'failure',
            statusContext,
            `${ctx.ciApp.buildsYmlFile} ${errorMessageType}: ${err.message}`,
        );

        ctx.throw(400, `${ctx.ciApp.buildsYmlFile} is invalid: ${err.message}`);
    }

    const builds = {};
    try {
        for (const [buildKey, ymlBuild] of Object.entries(ymlConfig.builds)) {
            /**
             * @typedef {object} BuildState
             * @property {string} buildKey
             * @property {string|null} status
             * @property {object|null} codeBuild
             * @property {BuildParams} buildParams
             */
            builds[buildKey] = {
                buildKey,
                status: null,
                codeBuild: null,
                buildParams: schema.validateBuildParams({
                    ...ctx.ciApp.globalBuildDefaults,
                    ...repoConfig.buildDefaults || {},
                    ...ymlConfig.defaults || {},
                    ...ymlBuild,
                }),
            };

            const codeBuildProjectArn = builds[buildKey].buildParams.codeBuildProjectArn;
            if (!repoConfig.codeBuildProjectArns.includes(codeBuildProjectArn)) {
                throw new Error(`"${codeBuildProjectArn}" is not a whitelisted CodeBuild project arn for ${repoConfig.id}`);
            }
        }
    }
    catch (err) {
        const statusContext = ymlConfig.statusContext || ymlConfig.checksName || 'CBuildCI';
        const errorMessageType = err instanceof VError
            ? 'has invalid properties'
            : 'error';

        ctx.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        await github.pushCommitStatus(
            ctx.ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            'failure',
            statusContext,
            `${ctx.ciApp.buildsYmlFile} ${errorMessageType}: ${err.message}`,
        );

        ctx.throw(400, `${ctx.ciApp.buildsYmlFile} is invalid: ${err.message}`);
    }

    try {
        schema.checkBuildDependencies(
            Object.entries(builds).reduce((ret, [buildKey, buildState]) => {
                ret[buildKey] = buildState.buildParams;
                return ret;
            }, {}),
        );
    }
    catch (err) {
        const statusContext = ymlConfig.statusContext || ymlConfig.checksName || 'CBuildCI';

        ctx.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        await github.pushCommitStatus(
            ctx.ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            'failure',
            statusContext,
            `${ctx.ciApp.buildsYmlFile}: ${err.message}`,
        );

        ctx.throw(400, `${ctx.ciApp.buildsYmlFile}: ${err.message}`);
    }

    // TODO: Trim builds that would never run (e.g. the "branches" filter doesn't match).
    // What happens to builds that aren't filtered out, but dependOn a build that is filtered out?
    // Just skip them or report as failed? Maybe allow a flag in YML to decide?

    /**
     * @typedef {object} StateInput
     * @property {boolean} isRunning
     * @property {boolean} stopRequested
     * @property {number} waitSeconds
     * @property {string} runTask
     * @property {string} errorInfo
     * @property {string} repoId
     * @property {number|null} installationId
     * @property {string} executionId
     * @property {string} checksName
     * @property {number|null} checksRunId
     * @property {string|null} encryptedOAuthToken
     * @property {string|null} oAuthTokenExpiration
     * @property {string[]} sourcesUploaded
     * @property {BuildState[]} builds
     * @property {string} commitSHA
     * @property {string} owner
     * @property {string} repo
     */
    const state = {
        isRunning: true,
        stopRequested: false,
        runTask: 'RunMain',
        waitSeconds: repoConfig.waitSeconds,
        errorInfo: null,
        repoId: repoConfig.id,
        installationId,
        executionId: '',
        traceId: ctx.req.traceId,
        checksName: ymlConfig.checksName,
        checksRunId: null,
        encryptedOAuthToken: isForGitHubApp
            ? await aws.encryptString(
                ctx.ciApp.secretsKMSArn,
                token,
            )
            : repoConfig.encryptedOAuthToken,
        oAuthTokenExpiration: tokenExpiration,
        sourcesUploaded: [],
        builds,
        commitSHA,
        owner,
        repo,
    };

    const lockId = util.buildLockId(
        owner,
        repo,
        commitSHA,
    );

    ctx.logInfo(`Attempting to secure lock for "${lockId}"...`);
    try {
        const prevLock = await aws.attemptLock(
            ctx.ciApp.tableLocksName,
            lockId,
            state.traceId,
            {},
            ctx.ciApp.lockTimeoutSeconds,
        );

        if (prevLock) {
            ctx.logInfo(`WARNING: Overwrote lock that was not cleaned up:\n${JSON.stringify(prevLock, null, 2)}`);
        }
    }
    catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
            ctx.throw(400, `Failed since a lock already exists that has been last updated within ${ctx.ciApp.lockTimeoutSeconds} seconds`);
        }
        else {
            err.status = 500;
            throw err;
        }
    }

    ctx.logInfo(`Determining next execution ID for commit "${commitSHA}" for "${state.repoId}"...`);
    state.executionId = await aws.getNextExecutionId(
        ctx.ciApp.tableExecutionsName,
        state.repoId,
        commitSHA,
    );

    // Verify the execution ID is valid. This is just to be safe and
    // also to prevent more than 9999 executions for one commit.
    if (!util.isValidExecutionId(state.executionId)) {
        ctx.throw(500, `Invalid executionId: ${state.executionId}`);
    }

    ctx.logInfo(`Creating execution table item "${state.executionId}" for "${state.repoId}"...`);
    await aws.createExecution(
        ctx.ciApp.tableExecutionsName,
        state.repoId,
        state.executionId,
        {
            installationId: state.installationId,
            githubOwner,
            githubRepo,
            initiator,
            webhookTraceId: state.traceId,
        },
        state,
    );

    if (isForGitHubApp && ctx.ciApp.githubUseChecks) {
        ctx.logInfo(`Creating check run "${state.checksName}"...`);
        const response = await github.createCheckRun(
            ctx.ciApp.githubApiUrl,
            token,
            owner,
            repo,
            state.checksName,
            commitSHA,
            {
                details_url: `${ctx.ciApp.baseUrl}/app/repo/${state.repoId}/execution/${state.executionId}`,
                external_id: `${state.repoId}/${state.executionId}`,
                status: 'queued',
                started_at: Date.now(),
                actions: [
                    {
                        label: 'Stop',
                        description: `Will stop build within ${state.waitSeconds} seconds.`,
                        identifier: 'stop',
                    },
                ],
            },
        );

        if (response.statusCode !== 200 && response.statusCode !== 201) {
            ctx.logError(`Failed to create check run:\n[${response.statusCode}] ${JSON.stringify(response.data, null, 2)}`);
        }
        else {
            state.checksRunId = response.data.id;
        }
    }

    const execResult = await aws.startStepFunctionExecution({
        stateMachineArn: ctx.ciApp.stateMachineArn,
        input: JSON.stringify(state),
    });

    ctx.logInfo(`State machine executed ARN:${execResult.executionArn}`);

    await aws.updateExecution(
        ctx.ciApp.tableExecutionsName,
        state.repoId,
        state.executionId,
        {
            executionArn: execResult.executionArn,
        },
    );

    // TODO: Should we push pending status to GitHub now for all builds that will run?
    // This may not be important if we can use the GitHub "Checks" feature. Then we can just use one status for all builds.

    ctx.body = {
        message: 'Started exection',
        lockId,
        executionArn: execResult.executionArn,
        executionId: state.executionId,
        traceId: state.traceId,
    };
};
