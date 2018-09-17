'use strict';

const yaml = require('js-yaml');
const { VError } = require('../../common/v');
const util = require('../../common/util');
const schema = require('../../common/schema');
const aws = require('./aws');
const github = require('./github');

exports.startExecution = async function startExecution(
    ciApp,
    throwError,
    traceId,
    token,
    tokenExpiration,
    repoConfig,
    githubOwner,
    githubRepo,
    event,
    installationId,
    commitSHA
) {
    const isForGitHubApp = installationId != null;
    const { owner, repo } = util.parseRepoId(repoConfig.id);

    // Download the repo's CBuildCI yaml file from the commit.
    ciApp.logInfo(`Getting ${ciApp.buildsYmlFile} for commit ${commitSHA}...`);
    let ymlContent;
    try {
        ymlContent = await github.getFileContent(
            ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            ciApp.buildsYmlFile,
            {
                maxSize: 65536,
            }
        );
    }
    catch (err) {
        // TODO
        // ciApp.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        // await github.pushCommitStatus(
        //     ciApp.githubApiUrl,
        //     token,
        //     owner,
        //     repo,
        //     commitSHA,
        //     'failure',
        //     statusContext,
        //     `${ciApp.buildsYmlFile} is missing: ${err.message}`,
        // );

        throwError(400, `${ciApp.buildsYmlFile} is missing: ${err.message}`);
    }

    // Parse the repo's CBuildCI yaml file.
    let ymlConfig = null;
    try {
        ymlConfig = yaml.safeLoad(ymlContent);

        ciApp.logInfo(`Parsing ${ciApp.buildsYmlFile}...`);
        ymlConfig = schema.validateBuildsYml(ymlConfig);
    }
    catch (err) {
        const statusContext = ymlConfig && (ymlConfig.statusContext || ymlConfig.checksName) || 'CBuildCI';
        const errorMessageType = err instanceof VError
            ? 'has invalid properties'
            : ymlConfig
                ? 'error'
                : 'is invalid YAML';

        ciApp.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        await github.pushCommitStatus(
            ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            'failure',
            statusContext,
            `${ciApp.buildsYmlFile} ${errorMessageType}: ${err.message}`,
        );

        throwError(400, `${ciApp.buildsYmlFile} is invalid: ${err.message}`);
    }

    // Fetch the metadata for the commit from GitHub.
    ciApp.logInfo(`Getting metadata for commit ${commitSHA}...`);
    const commitResponse = await github.getCommit(
        ciApp.githubApiUrl,
        token,
        owner,
        repo,
        commitSHA,
    );

    // Fail if the metadata could not be fetched.
    if (commitResponse.statusCode !== 200) {
        ciApp.logError(`Failed to get commit metadata:\n[${commitResponse.statusCode}] ${JSON.stringify(commitResponse.data, null, 2)}`);
        throwError(500, 'Failed to get commit metadata');
    }

    // Compose the builds from the global defaults and
    // the defaults in the repo's CBuildCI yaml file,
    // and then validate the result.
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
                waitingForDeps: [],
                buildParams: schema.validateBuildParams({
                    ...ciApp.globalBuildDefaults,
                    ...repoConfig.buildDefaults || {},
                    ...ymlConfig.defaults || {},
                    ...ymlBuild,
                }),
            };

            // Fail if a build references a CodeBuild project ARN that is not in the whitelist.
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

        ciApp.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        await github.pushCommitStatus(
            ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            'failure',
            statusContext,
            `${ciApp.buildsYmlFile} ${errorMessageType}: ${err.message}`,
        );

        throwError(400, `${ciApp.buildsYmlFile} is invalid: ${err.message}`);
    }

    // Check for cyclic dependencies.
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

        ciApp.logInfo(`Pushing "failure" commit status (as "${statusContext}")...`);
        await github.pushCommitStatus(
            ciApp.githubApiUrl,
            token,
            owner,
            repo,
            commitSHA,
            'failure',
            statusContext,
            `${ciApp.buildsYmlFile}: ${err.message}`,
        );

        throwError(400, `${ciApp.buildsYmlFile}: ${err.message}`);
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
        traceId,
        checksName: ymlConfig.checksName,
        checksRunId: null,
        encryptedOAuthToken: isForGitHubApp
            ? await aws.encryptString(
                ciApp.secretsKMSArn,
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

    // Obtain a lock on executions for the commit.
    ciApp.logInfo(`Attempting to secure lock for "${lockId}"...`);
    try {
        const prevLock = await aws.attemptLock(
            ciApp.tableLocksName,
            lockId,
            state.traceId,
            {},
            ciApp.lockTimeoutSeconds,
        );

        if (prevLock) {
            ciApp.logInfo(`WARNING: Overwrote lock that was not cleaned up:\n${JSON.stringify(prevLock, null, 2)}`);
        }
    }
    catch (err) {
        if (err.code === 'ConditionalCheckFailedException') {
            ciApp.logInfo(`Lock already exists for "${lockId}"`);
            throwError(400, `Failed since a lock already exists that has been last updated within ${ciApp.lockTimeoutSeconds} seconds`);
        }
        else {
            err.status = 500;
            throw err;
        }
    }

    // Determine the next execution ID for the commit.
    ciApp.logInfo(`Determining next execution ID for commit "${commitSHA}" for "${state.repoId}"...`);
    state.executionId = await aws.getNextExecutionId(
        ciApp.tableExecutionsName,
        state.repoId,
        commitSHA,
    );

    // Verify the execution ID is valid. This is just to be safe and
    // also to prevent more than 9999 executions for one commit.
    if (!util.isValidExecutionId(state.executionId)) {
        throwError(500, `Invalid executionId: ${state.executionId}`);
    }

    let author;
    let committer;

    if (commitResponse.data.author) {
        author = {
            id: commitResponse.data.author.id,
            login: commitResponse.data.author.login,
            type: commitResponse.data.author.type,
        };
    }

    if (commitResponse.data.commit.author) {
        author = {
            ...author || {},
            name: commitResponse.data.commit.author.name,
            email: commitResponse.data.commit.author.email,
        };
    }

    if (commitResponse.data.committer) {
        committer = {
            id: commitResponse.data.committer.id,
            login: commitResponse.data.committer.login,
            type: commitResponse.data.committer.type,
        };
    }

    if (commitResponse.data.commit.committer) {
        committer = {
            ...committer || {},
            name: commitResponse.data.commit.committer.name,
            email: commitResponse.data.commit.committer.email,
        };
    }

    // Create the execution record in the database.
    ciApp.logInfo(`Creating execution table item "${state.executionId}" for "${state.repoId}"...`);
    await aws.createExecution(
        ciApp.tableExecutionsName,
        state.repoId,
        state.executionId,
        {
            installationId: state.installationId,
            webhookTraceId: state.traceId,
            githubOwner,
            githubRepo,
            event,
            commit: {
                author,
                committer,
                message: clipCommitMessage(commitResponse.data.commit.message),
                stats: {
                    additions: commitResponse.data.stats.additions,
                    deletions: commitResponse.data.stats.deletions,
                    total: commitResponse.data.stats.total,
                },
            },
        },
        state,
    );

    // Create a GitHub "Checks Run" for the commit, if supported.
    if (isForGitHubApp && ciApp.githubUseChecks) {
        ciApp.logInfo(`Creating check run "${state.checksName}"...`);
        const { commit, executionNum } = util.parseExecutionId(state.executionId);
        const response = await github.createCheckRun(
            ciApp.githubApiUrl,
            token,
            owner,
            repo,
            state.checksName,
            commitSHA,
            {
                details_url: `${ciApp.baseUrl}/app/repo/${state.repoId}/commit/${commit}/exec/${executionNum}`,
                external_id: `${state.repoId}/${state.executionId}`,
                status: 'queued',
                started_at: Date.now(),
                actions: [
                    {
                        label: 'Stop',
                        description: 'Stop the builds.',
                        identifier: 'stop',
                    },
                ],
            },
        );

        if (response.statusCode !== 200 && response.statusCode !== 201) {
            ciApp.logError(`Failed to create check run:\n[${response.statusCode}] ${JSON.stringify(response.data, null, 2)}`);
        }
        else {
            state.checksRunId = response.data.id;
        }
    }

    // Start a AWS step function that will orchestrate this execution of builds.
    const execResult = await aws.startStepFunctionExecution({
        stateMachineArn: ciApp.stateMachineArn,
        input: JSON.stringify(state),
    });

    ciApp.logInfo(`State machine executed ARN:${execResult.executionArn}`);

    // Add the step function ARN to the execution record in the database.
    await aws.updateExecution(
        ciApp.tableExecutionsName,
        state.repoId,
        state.executionId,
        {
            status: 'IN_PROGRESS',
            meta: {
                executionArn: execResult.executionArn,
            },
        },
    );

    // TODO: Should we push pending status to GitHub now for all builds that will run?
    // This may not be important if we can use the GitHub "Checks" feature. Then we can just use one status for all builds.

    return {
        message: 'Started exection',
        lockId,
        executionArn: execResult.executionArn,
        executionId: state.executionId,
        traceId: state.traceId,
    };
};

function clipCommitMessage(message) {
    if (typeof message !== 'string') {
        return '';
    }

    // Remove any leading whitespace.
    message = message.replace(/^\s+/, '');

    const newlineIndex = message.indexOf('\n');
    return message.substr(0, Math.min(101, newlineIndex >= 0 ? newlineIndex : 101));
}
