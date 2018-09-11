'use strict';

const url = require('url');

class CIApp {
    constructor({
        lockTimeoutSeconds,
        maxSessionMinutes,
        buildsYmlFile,
        baseUrl,
        tableConfigName,
        tableLocksName,
        tableSessionsName,
        tableExecutionsName,
        stateMachineArn,
        secretsKMSArn,
        githubUrl,
        githubApiUrl,
        githubAppId,
        githubAppClientId,
        githubAppClientSecretParamName,
        githubAppHMACSecretParamName,
        githubAppPrivateKeyParamName,
        githubUseChecks,
        sessionSecretsParamName,
        githubNoBuildLabels,
        globalBuildDefaults,
        globalRepoConfigDefaults,
    }) {
        this.sessionCookieKey = 'cbuildci:sess';
        this.maxSessionMinutes = maxSessionMinutes;
        this.lockTimeoutSeconds = lockTimeoutSeconds;
        this.buildsYmlFile = buildsYmlFile;
        this.baseUrl = baseUrl;
        this.tableConfigName = tableConfigName;
        this.tableLocksName = tableLocksName;
        this.tableSessionsName = tableSessionsName;
        this.tableExecutionsName = tableExecutionsName;
        this.stateMachineArn = stateMachineArn;
        this.secretsKMSArn = secretsKMSArn;
        this.githubUrl = githubUrl;
        this.githubHost = url.parse(githubUrl).host;
        this.githubApiUrl = githubApiUrl;
        this.githubAppId = githubAppId;
        this.githubAppClientId = githubAppClientId;
        this.githubAppClientSecretParamName = githubAppClientSecretParamName;
        this.githubAppHMACSecretParamName = githubAppHMACSecretParamName;
        this.githubAppPrivateKeyParamName = githubAppPrivateKeyParamName;
        this.githubUseChecks = githubUseChecks;
        this.sessionSecretsParamName = sessionSecretsParamName;
        this.githubNoBuildLabels = githubNoBuildLabels;
        this.globalBuildDefaults = globalBuildDefaults;
        this.globalRepoConfigDefaults = globalRepoConfigDefaults;
    }

    /**
     * Log message at log level TRACE.
     *
     * @param {string} msg
     */
    logTrace(msg) {
        // eslint-disable-next-line no-console
        console.log(msg);
    }

    /**
     * Log message at log level DEBUG.
     *
     * @param {string} msg
     */
    logDebug(msg) {
        // eslint-disable-next-line no-console
        console.log(msg);
    }

    /**
     * Log message at log level INFO.
     *
     * @param {string} msg
     */
    logInfo(msg) {
        // eslint-disable-next-line no-console
        console.log(msg);
    }

    /**
     * Log message at log level WARN.
     *
     * @param {string} msg
     */
    logWarn(msg) {
        // eslint-disable-next-line no-console
        console.log(msg);
    }

    /**
     * Log message at log level ERROR.
     *
     * @param {string} msg
     */
    logError(msg) {
        // eslint-disable-next-line no-console
        console.log(msg);
    }

    initKoa(koaApp) {
        koaApp.context.ciApp = this;
        koaApp.context.logInfo = this.logInfo.bind(this);
        koaApp.context.logWarn = this.logWarn.bind(this);
        koaApp.context.logTrace = this.logTrace.bind(this);
        koaApp.context.logDebug = this.logDebug.bind(this);
        koaApp.context.logError = this.logError.bind(this);

        koaApp.on('error', (err) => {
            if (err && err.status !== '404' && err.status !== 404 && !err.expose) {
                this.logError(err.stack || err.message);
            }
        });
    }
}

CIApp.create = (env) => {
    return new CIApp({
        lockTimeoutSeconds: env.LOCK_TIMEOUT_SECONDS,
        maxSessionMinutes: env.MAX_SESSION_MINUTES,
        buildsYmlFile: env.BUILDS_YML_FILE,
        baseUrl: env.BASE_URL.replace(/\/$/, ''),
        tableConfigName: env.TABLE_CONFIG_NAME,
        tableLocksName: env.TABLE_LOCKS_NAME,
        tableSessionsName: env.TABLE_SESSIONS_NAME,
        tableExecutionsName: env.TABLE_EXECUTIONS_NAME,
        stateMachineArn: env.STATE_MACHINE_ARN,
        secretsKMSArn: env.SECRETS_KMS_ARN,

        githubUrl: env.GH_URL.replace(/\/$/, ''),
        githubApiUrl: env.GH_API_URL.replace(/\/$/, ''),
        githubAppId: env.GH_APP_ID,
        githubAppClientId: env.GH_APP_CLIENT_ID,
        githubAppClientSecretParamName: env.GH_APP_CLIENT_SECRET_PARAM_NAME,
        githubAppHMACSecretParamName: env.GH_APP_HMAC_SECRET_PARAM_NAME,
        githubAppPrivateKeyParamName: env.GH_APP_PRIVATE_KEY_PARAM_NAME,
        sessionSecretsParamName: env.SESSION_SECRETS_PARAM_NAME,
        githubNoBuildLabels: (
            env.GH_NO_BUILD_LABELS
            || 'no build,no_build,no-build'
        ).toLowerCase().split(/\s*,\s*/g).filter(Boolean),
        githubUseChecks: env.GITHUB_USE_CHECKS === 'true',

        globalRepoConfigDefaults: {
            waitSeconds: env.STATE_MACHINE_WAIT_SECONDS_DEFAULT,
        },

        globalBuildDefaults: {
            sourceS3Bucket: env.SOURCE_S3_BUCKET_DEFAULT,
            sourceS3KeyPrefix: env.SOURCE_S3_KEY_PREFIX_DEFAULT,
            artifactS3Bucket: env.ARTIFACT_S3_BUCKET_DEFAULT,
            artifactS3KeyPrefix: env.ARTIFACT_S3_KEY_PREFIX_DEFAULT,
            cacheS3Bucket: env.CACHE_S3_BUCKET_DEFAULT,
            cacheS3KeyPrefix: env.CACHE_S3_KEY_PREFIX_DEFAULT,
        },
    });
};

module.exports = CIApp;
