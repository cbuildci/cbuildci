'use strict';

const fs = require('fs');
const yauzl = require('yauzl');
const archiver = require('archiver');
const crypto = require('crypto');
const util = require('../../common/util');
const CIApp = require('../CIApp');
const aws = require('../util/aws');
const github = require('../util/github');
const url = require('url');

const ciApp = CIApp.create(process.env);

const STATUS_IN_PROGRESS = 'IN_PROGRESS';
const STATUS_WAITING_FOR_DEPENDENCY = 'WAITING_FOR_DEPENDENCY';
const STATUS_BUILD_NOTFOUND = 'BUILD_NOTFOUND';
const STATUS_SUCCEEDED = 'SUCCEEDED';
const STATUS_DEPENDENCY_FAILED = 'DEPENDENCY_FAILED';
const STATUS_START_CODEBUILD_FAILED = 'START_CODEBUILD_FAILED';
const STATUS_STARTING = 'STARTING';
const STATUS_FAILED = 'FAILED';
const STATUS_FAULT = 'FAULT';
const STATUS_STOPPED = 'STOPPED';
const STATUS_TIMED_OUT = 'TIMED_OUT';
const STATUS_SKIPPED = 'SKIPPED';

const statusToText = {
    [STATUS_IN_PROGRESS]: 'In Progress',
    [STATUS_WAITING_FOR_DEPENDENCY]: 'Waiting for Dependency',
    [STATUS_BUILD_NOTFOUND]: 'Build Not Found',
    [STATUS_SUCCEEDED]: 'Succeeded',
    [STATUS_DEPENDENCY_FAILED]: 'Dependency Failed',
    [STATUS_START_CODEBUILD_FAILED]: 'Failed to Start CodeBuild',
    [STATUS_STARTING]: 'Starting CodeBuild',
    [STATUS_FAILED]: 'Failed',
    [STATUS_FAULT]: 'Fault',
    [STATUS_STOPPED]: 'Stopped',
    [STATUS_TIMED_OUT]: 'Timed Out',
    [STATUS_SKIPPED]: 'Skipped',
};

const statusToEmoji = {
    [STATUS_IN_PROGRESS]: ':arrow_forward:',
    [STATUS_WAITING_FOR_DEPENDENCY]: ':zzz:',
    [STATUS_BUILD_NOTFOUND]: ':boom:',
    [STATUS_SUCCEEDED]: ':+1:', // +1 or white_check_mark
    [STATUS_DEPENDENCY_FAILED]: ':x:',
    [STATUS_START_CODEBUILD_FAILED]: ':boom:',
    [STATUS_STARTING]: ':arrow_forward:',
    [STATUS_FAILED]: ':x:',
    [STATUS_FAULT]: ':boom:',
    [STATUS_STOPPED]: ':no_entry_sign:',
    [STATUS_TIMED_OUT]: ':alarm_clock:',
    [STATUS_SKIPPED]: ':white_circle:',
};

exports.handler = (event, context, cb) => {
    const traceId = `lambda:${context.logGroupName}:${context.logStreamName}:${context.awsRequestId}`;

    executionHandler(event, ciApp, traceId)
        .then((result) => {
            if (!result) {
                throw new Error('Missing state');
            }

            if (typeof result.isRunning !== 'boolean') {
                throw new Error('Invalid state');
            }

            cb(null, result);
        })
        .catch((err) => cb(err));
};

/**
 * @param {StateInput} state
 * @param {CIApp} ciApp
 * @param {string} traceId
 * @returns {StateInput}
 */
async function executionHandler(state, ciApp, traceId) {
    let installationAccessToken = null;

    if (!state) {
        throw new Error('Missing state');
    }

    if (state.runTask === 'RunError' || state.runTask === 'RunEnd') {
        let title;
        let conclusion;
        let checkRunConclusion;

        if (state.runTask === 'RunError') {
            ciApp.logError(`Execution error: \n${JSON.stringify(state.errorInfo, null, 2)}`);
            title = 'Internal System Error';
            conclusion = 'ERROR';
            checkRunConclusion = 'failure';
        }
        else if (state.runTask === 'RunEnd') {
            ciApp.logInfo('Execution completed');

            if (state.stopRequested) {
                title = 'Stopped by User';
                conclusion = 'STOPPED';
                checkRunConclusion = 'cancelled';
            }
            else {
                let failure = 0;
                let success = 0;
                let neutral = 0;

                for (const buildState of Object.values(state.builds)) {
                    if (buildState.status === STATUS_SUCCEEDED) {
                        success++;
                    }
                    else if (buildState.status === STATUS_SKIPPED) {
                        neutral++;
                    }
                    else {
                        failure++;
                    }
                }

                if (failure) {
                    conclusion = 'FAILED';
                    checkRunConclusion = 'failure';
                    title = `${failure} build${failure === 1 ? '' : 's'} failed`;
                }
                else if (success) {
                    conclusion = 'SUCCEEDED';
                    checkRunConclusion = 'success';
                    title = `${success} build${success === 1 ? '' : 's'} succeeded`;
                }
                else {
                    conclusion = 'NEUTRAL';
                    checkRunConclusion = 'neutral';
                    title = `${neutral} build${neutral === 1 ? '' : 's'} skipped`;
                }
            }
        }

        ciApp.logInfo('Updating execution table item...');
        await aws.updateExecution(
            ciApp.tableExecutionsName,
            state.repoId,
            state.executionId,
            {
                status: 'COMPLETED',
                conclusion,
                state,
            },
        );

        if (state.checksRunId) {
            installationAccessToken = installationAccessToken || await getToken(state);

            ciApp.logInfo(`Updating check run "${state.checksName}"...`);
            const response = await github.updateCheckRun(
                ciApp.githubApiUrl,
                installationAccessToken,
                state.owner,
                state.repo,
                state.checksRunId,
                state.checksName,
                {
                    status: 'completed',
                    conclusion: checkRunConclusion,
                    completed_at: Date.now(),
                    output: {
                        title,
                        summary: getExecutionSummary(state),
                    },
                    actions: [
                        {
                            label: 'Re-Run',
                            description: 'Re-run the builds.',
                            identifier: 'rerun',
                        },
                    ],
                },
            );

            if (response.statusCode !== 200 && response.statusCode !== 201) {
                ciApp.logError(`Failed to create check run:\n[${response.statusCode}] ${JSON.stringify(response.data, null, 2)}`);
            }
        }

        ciApp.logInfo('Releasing lock...');
        try {
            // Release the lock.
            const lockId = util.buildLockId(
                state.owner,
                state.repo,
                state.commitSHA,
            );
            await aws.releaseLock(
                ciApp.tableLocksName,
                lockId,
                state.traceId,
            );
        }
        catch (err) {
            ciApp.logError(`Failed to release lock: ${err.stack}`);
        }

        return state;
    }

    if (state.runTask !== 'RunMain') {
        throw new Error(`Unexpected runTask: ${JSON.stringify(state.runTask)}`);
    }

    // Update lock to avoid timeout.
    const lockId = util.buildLockId(
        state.owner,
        state.repo,
        state.commitSHA,
    );
    await aws.updateLock(
        ciApp.tableLocksName,
        lockId,
        state.traceId,
    );

    // Build a lookup of in-progress builds keyed by CodeBuild Arn.
    const buildArnToStateMap = Object.values(state.builds)
        .reduce((ret, buildState) => {
            if (buildState.codeBuild && buildState.codeBuild.buildStatus === STATUS_IN_PROGRESS) {
                ret[buildState.codeBuild.arn] = buildState;
            }
            return ret;
        }, {});

    // Check status of running builds.
    const runningBuildArns = Object.keys(buildArnToStateMap);
    if (runningBuildArns.length) {
        // Get the current status of the CodeBuild builds.
        const endedBuilds = [];
        const codeBuildStatuses = await aws.getBatchBuildStatus(
            runningBuildArns.map((arn) => aws.parseArn(arn).buildId),
        );

        // Check for builds that should exist but their statuses weren't returned.
        const missingBuildArns = new Set(runningBuildArns);
        for (const codeBuildStatus of codeBuildStatuses) {
            missingBuildArns.delete(codeBuildStatus.arn);

            const buildState = buildArnToStateMap[codeBuildStatus.arn];
            buildState.codeBuild = getCodeBuildProps(codeBuildStatus);
            buildState.status = buildState.codeBuild.buildStatus;

            // Collect builds that are no longer running.
            if (codeBuildStatus.buildStatus !== STATUS_IN_PROGRESS) {
                endedBuilds.push(buildState);
            }
        }

        // Mark any builds that were not found as failed.
        if (missingBuildArns.length) {
            for (const buildArn of missingBuildArns) {
                const buildState = buildArnToStateMap[buildArn];
                buildState.status = STATUS_BUILD_NOTFOUND;
                endedBuilds.push(buildState);
            }
        }

        // Push status updates to GitHub.
        if (endedBuilds.length) {
            for (const buildState of endedBuilds) {
                await pushCommitStatus(buildState);
            }
        }
    }

    // Start builds.
    for (const [buildKey, buildState] of Object.entries(state.builds)) {
        if (state.stopRequested) {
            break;
        }

        // Check builds that have yet to start.
        if (!buildState.status || buildState.status === STATUS_WAITING_FOR_DEPENDENCY) {
            let canRun = true;
            let failedDeps = false;
            buildState.waitingForDeps = [];

            // Check any dependencies of the build.
            for (const depBuildKey of buildState.buildParams.dependsOn) {
                const depBuildState = state.builds[depBuildKey];

                // Don't start if a dependency hasn't completed yet.
                if (!depBuildState.status
                    || depBuildState.status === STATUS_IN_PROGRESS
                    || depBuildState.status === STATUS_WAITING_FOR_DEPENDENCY) {
                    canRun = false;
                    buildState.waitingForDeps.push(depBuildKey);
                }

                // Fail if dependency failed.
                else if (depBuildState.status !== STATUS_SUCCEEDED) {
                    canRun = false;
                    failedDeps = true;
                }
            }

            if (failedDeps) {
                buildState.status = STATUS_DEPENDENCY_FAILED;
                await pushCommitStatus(buildState);
            }
            else if (canRun) {
                ciApp.logInfo(`Starting build "${buildKey}"...`);

                try {
                    await startBuild(buildState);
                }
                catch (err) {
                    ciApp.logError(`Failed to start build "${buildKey}": [${err.name}] ${err.message}`);

                    // Push a failed status for the build.
                    buildState.status = STATUS_START_CODEBUILD_FAILED;
                    await pushCommitStatus(buildState);
                }
            }
            else {
                ciApp.logInfo(`Build "${buildKey}" waiting on deps: ${buildState.waitingForDeps.map((v) => JSON.stringify(v)).join(',')}`);

                // Mark the build as waiting on deps and push its status.
                if (!buildState.status) {
                    buildState.status = STATUS_WAITING_FOR_DEPENDENCY;
                    await pushCommitStatus(buildState);
                }
            }
        }
    }

    // Keep running if there are builds that have yet to complete.
    // TODO: Handling skipped builds?
    state.isRunning = Object.values(state.builds)
        .some((buildState) => !state.stopRequested && !buildState.status || buildState.status === STATUS_IN_PROGRESS);

    if (!state.isRunning) {
        ciApp.logInfo('All builds for execution complete');
    }

    ciApp.logInfo('Updating execution table item...');
    const execution = await aws.updateExecution(
        ciApp.tableExecutionsName,
        state.repoId,
        state.executionId,
        {
            state,
        },
    );

    // Stop builds if the API has requested this execution to stop.
    if (state.isRunning && execution.meta.stop) {
        ciApp.logInfo('Execution stop requested...');

        // state.isRunning = false;
        state.stopRequested = true;

        for (const [buildKey, buildState] of Object.entries(state.builds)) {
            if (buildState.codeBuild && buildState.codeBuild.buildStatus === STATUS_IN_PROGRESS) {
                try {
                    ciApp.logInfo(`Stopping build "${buildKey}"...`);
                    await aws.stopCodeBuild(
                        aws.parseArn(buildState.codeBuild.arn).buildId,
                    );
                }
                catch (err) {
                    ciApp.logError(`Failed to stop build "${buildKey}" for execution "${state.executionId}": ${err.stack}`);
                }
            }
        }
    }

    if (state.checksRunId) {
        installationAccessToken = installationAccessToken || await getToken(state);

        const actions = [];

        if (!state.stopRequested) {
            actions.push({
                label: 'Stop',
                description: 'Stop the builds.',
                identifier: 'stop',
            });
        }

        ciApp.logInfo(`Updating check run "${state.checksName}"...`);
        const response = await github.updateCheckRun(
            ciApp.githubApiUrl,
            installationAccessToken,
            state.owner,
            state.repo,
            state.checksRunId,
            state.checksName,
            {
                status: 'in_progress',
                output: {
                    title: state.stopRequested ? 'Stopping...' : 'Running builds...',
                    summary: getExecutionSummary(state),
                },
                actions,
            },
        );

        if (response.statusCode !== 200 && response.statusCode !== 201) {
            ciApp.logError(`Failed to create check run:\n[${response.statusCode}] ${JSON.stringify(response.data, null, 2)}`);
        }
    }

    return state;

    async function startBuild(buildState) {
        buildState.status = STATUS_STARTING;
        await pushCommitStatus(buildState);

        const sourceS3KeyPrefix = buildState.buildParams.sourceS3KeyPrefix
            .replace('{GitHubDomain}', url.parse(ciApp.githubUrl).host)
            .replace('{GitHubUser}', state.owner)
            .replace('{GitHubRepo}', state.repo);

        const artifactS3KeyPrefix = !buildState.buildParams.noArtifacts && buildState.buildParams.artifactS3KeyPrefix
            .replace('{GitHubDomain}', url.parse(ciApp.githubUrl).host)
            .replace('{GitHubUser}', state.owner)
            .replace('{GitHubRepo}', state.repo);

        const sourceS3Key = `${sourceS3KeyPrefix}source_${state.commitSHA}.zip`;
        const sourceUploadedId = `${buildState.buildParams.sourceS3Bucket}/${sourceS3Key}`;

        // Check if we still need to upload the source to the S3 bucket location for the build.
        // If builds specify the same S3 location then only one of them will need to do this.
        if (!state.sourcesUploaded.includes(sourceUploadedId)) {
            installationAccessToken = installationAccessToken || await getToken(state);

            // Download the source from GitHub.
            ciApp.logInfo(`Downloading zipball from ${ciApp.githubApiUrl}...`);
            const randChars = crypto.randomBytes(8).toString('hex');
            const tmpRawFileName = `/tmp/source_${randChars}_raw.zip`;
            const tmpFileName = `/tmp/source_${randChars}.zip`;

            const archiveResponse = await github.downloadArchive(
                ciApp.githubApiUrl,
                installationAccessToken,
                state.owner,
                state.repo,
                state.commitSHA,
                'zipball',
                fs.createWriteStream(tmpRawFileName)
            );

            // Fail if the archive has the wrong content type.
            if (archiveResponse.headers['content-type'] !== 'application/zip') {
                throw new Error(`Incorrect Content-Type for archive: ${archiveResponse.headers['content-type']}`);
            }

            ciApp.logInfo('Preparing downloaded source for CodeBuild...');
            await prepareGitHubSource(
                tmpRawFileName,
                tmpFileName,
            );

            // Upload the archive to S3.
            ciApp.logInfo('Uploading the archive to S3...');
            await aws.putS3Object({
                Bucket: buildState.buildParams.sourceS3Bucket,
                Key: sourceS3Key,
                Body: fs.createReadStream(tmpFileName),
            });

            // Clean up the local temp files.
            await Promise.all([
                new Promise((resolve) => {
                    fs.unlink(tmpRawFileName, resolve);
                }),
                new Promise((resolve) => {
                    fs.unlink(tmpFileName, resolve);
                }),
            ]);

            // Mark the S3 location so we don't upload it again.
            state.sourcesUploaded.push(sourceUploadedId);
        }

        ciApp.logInfo('Starting build...');
        const buildResponse = await aws.startCodeBuild({
            // Parse the buildId from the CodeBuild project ARN.
            projectName: aws.parseArn(buildState.buildParams.codeBuildProjectArn).buildId,

            // Basic overrides.
            computeTypeOverride: buildState.buildParams.computeType,
            environmentTypeOverride: buildState.buildParams.environmentType,
            imageOverride: buildState.buildParams.image,
            privilegedModeOverride: buildState.buildParams.privilegedMode,
            timeoutInMinutesOverride: buildState.buildParams.timeoutInMinutes,

            // Include core env vars and add in any specified in the build params.
            environmentVariablesOverride: [
                { name: 'CBUILDCI_COMMIT_SHA', value: state.commitSHA },
                { name: 'CBUILDCI_TRACE_ID', value: traceId },
                { name: 'CBUILDCI_SOURCE_S3_BUCKET', value: buildState.buildParams.sourceS3Bucket },
                { name: 'CBUILDCI_SOURCE_S3_KEY_PREFIX', value: sourceS3KeyPrefix },
                { name: 'CBUILDCI_ARTIFACT_S3_BUCKET', value: buildState.buildParams.noArtifacts ? null : buildState.buildParams.artifactS3Bucket },
                { name: 'CBUILDCI_ARTIFACT_S3_KEY_PREFIX', value: buildState.buildParams.noArtifacts ? null : artifactS3KeyPrefix },
                // TODO: Include data for other started/completed builds so this build can use their resources.
            ]
                .concat(buildState.buildParams.environmentVariables)
                .filter((v) => v.value),

            sourceTypeOverride: 'S3',
            sourceLocationOverride: `arn:aws:s3:::${buildState.buildParams.sourceS3Bucket}/${sourceS3Key}`,

            artifactsOverride: buildState.buildParams.noArtifacts ? {
                type: 'NO_ARTIFACTS',
            } : {
                type: 'S3',
                location: buildState.buildParams.artifactS3Bucket,
                path: artifactS3KeyPrefix,
                name: 'artifacts',
                namespaceType: 'BUILD_ID',
                packaging: 'NONE',
            },
        });

        buildState.status = buildResponse.build.buildStatus;
        buildState.codeBuild = getCodeBuildProps(buildResponse.build);
        ciApp.logInfo(`Started build: ${buildResponse.build.arn}`);

        await pushCommitStatus(buildState);
    }

    async function pushCommitStatus(buildState) {
        const statusContext = buildState.buildParams.commitStatus;
        if (!statusContext) {
            return;
        }

        ciApp.logInfo(`Pushing "${buildState.status}" commit status (as "${statusContext}") for "${buildState.buildKey}"`);

        installationAccessToken = installationAccessToken || await getToken(state);

        let commitState = 'failure';
        if (!buildState.status
            || buildState.status === STATUS_WAITING_FOR_DEPENDENCY
            || buildState.status === STATUS_STARTING
            || buildState.status === STATUS_IN_PROGRESS) {
            commitState = 'pending';
        }
        else if (buildState.status === STATUS_SUCCEEDED) {
            commitState = 'success';
        }

        let description = `Failed: ${buildState.status}`;
        if (buildState.status === STATUS_WAITING_FOR_DEPENDENCY) {
            description = 'Waiting for dependency...';
        }
        else if (buildState.status === STATUS_DEPENDENCY_FAILED) {
            description = 'Dependency failed';
        }
        else if (buildState.status === STATUS_STARTING) {
            description = 'Starting...';
        }
        else if (buildState.status === STATUS_IN_PROGRESS) {
            description = 'Running...';
        }
        else if (buildState.status === STATUS_SUCCEEDED) {
            description = 'Successful';
        }
        else if (buildState.status === STATUS_FAILED) {
            description = 'Failed';
        }
        else if (buildState.status === STATUS_TIMED_OUT) {
            description = 'Timed Out';
        }

        const { commit, executionNum } = util.parseExecutionId(state.executionId);
        const targetUrl = `${ciApp.baseUrl}/api/v1/repo/${state.repoId}/commit/${commit}/exec/${executionNum}/build/${buildState.buildKey}`;

        await github.pushCommitStatus(
            ciApp.githubApiUrl,
            installationAccessToken,
            state.owner,
            state.repo,
            state.commitSHA,
            commitState,
            statusContext,
            description,
            targetUrl,
        );
    }
}

function getExecutionSummary(state) {
    const buildsTable = [
        '| Build | Status | Phase | Duration |',
        '| ----- | ------ | ----- | -------- |',
    ]
        .concat(
            Object.values(state.builds)
                .sort((buildA, buildB) => {
                    if (buildA.buildKey < buildB.buildKey) {
                        return -1;
                    }
                    else if (buildA.buildKey > buildB.buildKey) {
                        return 1;
                    }
                    else {
                        return 0;
                    }
                })
                .map(({ buildKey, status, codeBuild }) => {
                    const icon = statusToEmoji[status] || '';
                    const { commit, executionNum } = util.parseExecutionId(state.executionId);
                    const link = `${ciApp.baseUrl}/api/v1/repo/${state.repoId}/commit/${commit}/exec/${executionNum}/build/${buildKey}`;
                    const currentPhase = codeBuild && codeBuild.currentPhase;
                    const duration = codeBuild && codeBuild.startTime && codeBuild.endTime
                        ? `${Math.round((util.toEpochTime(codeBuild.endTime) - util.toEpochTime(codeBuild.startTime)) / 1000)}s`
                        : '-';
                    return `| [${buildKey}](${link}) | ${icon} ${statusToText[status] || status || '-'} | ${currentPhase || '-'} | ${duration} |`;
                })
        )
        .join('\n');

    const parts = [
        `_Details last refreshed at ${new Date().toISOString()}${state.isRunning ? ` (Updates every ${state.waitSeconds} seconds)` : ''}_`,
        '',
    ];

    parts.push(buildsTable);

    return parts.join('\n');
}

function getCodeBuildProps(build) {
    return {
        id: build.id,
        arn: build.arn,
        startTime: util.toISODateString(build.startTime),
        endTime: util.toISODateString(build.endTime),
        currentPhase: build.currentPhase,
        buildStatus: build.buildStatus,
        buildComplete: build.buildComplete,
        logs: build.logs,
        phases: build.phases && build.phases.map((phase) => ({
            phaseType: phase.phaseType,
            phaseStatus: phase.phaseStatus,
            startTime: util.toISODateString(phase.startTime),
            endTime: util.toISODateString(phase.endTime),
            durationInSeconds: phase.durationInSeconds,
            contexts: phase.contexts && phase.contexts
                .filter((context) => context.statusCode)
                .map((context) => ({
                    statusCode: context.statusCode,
                    message: context.message,
                })),
        })),
    };
}

async function prepareGitHubSource(inFileName, outFileName) {
    return new Promise((resolve, reject) => {
        const catchAndReject = (fn) => {
            return function catchAndReject(...args) {
                try {
                    return fn.apply(this, args);
                }
                catch (err) {
                    reject(err);
                }
            };
        };

        yauzl.open(inFileName, { lazyEntries: true }, catchAndReject((err, inZip) => {
            if (err) {
                reject(err);
            }
            else {
                const outZip = archiver('zip', {
                    zlib: { level: 3 },
                });

                // Catch archiver warnings.
                outZip.on('warning', (err) => {
                    if (err.code === 'ENOENT') {
                        // TODO: log warning?
                    }
                    else {
                        reject(err);
                    }
                });

                // Catch archiver errors.
                outZip.on('error', (err) => {
                    reject(err);
                });

                const outStream = fs.createWriteStream(outFileName);

                // Catch stream errors.
                outStream.on('error', (err) => {
                    reject(err);
                });

                // Resolve once the output stream closes.
                outStream.on('close', () => {
                    resolve();
                });

                // pipe archive data to the file
                outZip.pipe(outStream);

                inZip.on('end', () => {
                    outZip.finalize();
                });

                inZip.on('entry', catchAndReject((entry) => {
                    // All included files should be in a top-level directory.
                    const fileNameMatch = entry.fileName.match(/^[^/]+\/(.+)$/);

                    // Skip this entry if it doesn't match.
                    if (!fileNameMatch) {
                        inZip.readEntry();
                    }

                    // Skip directory entries.
                    else if (entry.fileName.endsWith('/')) {
                        inZip.readEntry();
                    }

                    else {
                        inZip.openReadStream(entry, catchAndReject((err, readStream) => {
                            if (err) {
                                reject(err);
                            }
                            else {
                                readStream.on('end', catchAndReject(() => {
                                    // Read the next file after the stream finishes.
                                    inZip.readEntry();
                                }));

                                outZip.append(readStream, {
                                    name: fileNameMatch[1],
                                });
                            }
                        }));
                    }
                }));

                // Start reading entries.
                inZip.readEntry();
            }
        }));
    });
}

async function getToken(state) {
    if (state.installationId != null) {
        if (!github.isTokenExpired(state.oAuthTokenExpiration)) {
            ciApp.logInfo('Decrypting existing installation OAuth token...');
            return await aws.decryptString(state.encryptedOAuthToken);
        }

        ciApp.logInfo(`Getting access token for installation ${state.installationId}...`);

        const { token, expires_at } = await github.getInstallationAccessToken(
            ciApp.githubAppId,
            ciApp.githubApiUrl,
            async () => {
                ciApp.logInfo('Getting GitHub App private key from SSM...');
                return Buffer.from(
                    await aws.getSSMParam(ciApp.githubAppPrivateKeyParamName),
                    'base64',
                );
            },
            state.installationId,
        );

        // Encrypt and store the token in the state so it can be reused.
        ciApp.logInfo('Encrypting installation access token...');
        state.encryptedOAuthToken = await aws.encryptString(
            ciApp.secretsKMSArn,
            token,
        );
        state.oAuthTokenExpiration = expires_at;

        return token;
    }
    else {
        ciApp.logInfo('Decrypting OAuth token...');
        return await aws.decryptString(state.encryptedOAuthToken);
    }
}
