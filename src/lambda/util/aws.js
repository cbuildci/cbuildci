'use strict';

const AWSXRay = require('aws-xray-sdk');
const AWS = AWSXRay.captureAWS(require('aws-sdk'));
const util = require('../../common/util');

const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

exports.putS3Object = async function putS3Object(params, serviceParams = {}) {
    const s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        region: AWS_REGION,
        ...serviceParams,
    });

    return await s3.putObject(params).promise();
};

exports.startCodeBuild = async function startCodeBuild(params, serviceParams = {}) {
    const codebuild = new AWS.CodeBuild({
        apiVersion: '2016-10-06',
        region: AWS_REGION,
        ...serviceParams,
    });

    return await codebuild.startBuild(params).promise();
};

exports.stopCodeBuild = async function stopCodeBuild(id, serviceParams = {}) {
    const codebuild = new AWS.CodeBuild({
        apiVersion: '2016-10-06',
        region: AWS_REGION,
        ...serviceParams,
    });

    return await codebuild.stopBuild({
        id,
    }).promise();
};

exports.getBuildStatus = async function getBuildStatus(buildId, serviceParams = {}) {
    const codebuild = new AWS.CodeBuild({
        apiVersion: '2016-10-06',
        region: AWS_REGION,
        ...serviceParams,
    });

    const data = await codebuild.batchGetBuilds({
        ids: [buildId],
    }).promise();

    return data.builds.length
        ? data.builds[0].buildStatus
        : null;
};

exports.getBatchBuildStatus = async function getBatchBuildStatus(buildIds, serviceParams = {}) {
    const codebuild = new AWS.CodeBuild({
        apiVersion: '2016-10-06',
        region: AWS_REGION,
        ...serviceParams,
    });

    const data = await codebuild.batchGetBuilds({
        ids: buildIds,
    }).promise();

    return data.builds;
};

exports.startStepFunctionExecution = async function startStepFunctionExecution(params, serviceParams = {}) {
    const stepFunctions = new AWS.StepFunctions({
        apiVersion: '2016-11-23',
        region: AWS_REGION,
        ...serviceParams,
    });

    return await stepFunctions.startExecution(params).promise();
};

exports.getLogEvents = async function getLogEvents(
    logGroupName,
    logStreamName,
    { limit = 10000, startFromHead = false, nextToken } = {},
    serviceParams = {},
) {
    const logs = new AWS.CloudWatchLogs({
        apiVersion: '2014-03-28',
        region: AWS_REGION,
        ...serviceParams,
    });

    return await logs.getLogEvents({
        logGroupName,
        logStreamName,
        limit,
        startFromHead,
        nextToken,
    }).promise();
};

exports.getSSMParam = async function getSSMParam(name, serviceParams = {}) {
    const ssm = new AWS.SSM({
        apiVersion: '2014-11-06',
        region: AWS_REGION,
        ...serviceParams,
    });

    const response = await ssm.getParameter({
        Name: name,
        WithDecryption: true,
    }).promise();

    return response && response.Parameter.Value;
};

exports.getTableItemByKey = async function getTableItemByKey(tableName, key, serviceParams = {}) {
    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.get({
        TableName: tableName,
        Key: key,
    }).promise();

    return response && response.Item
        ? response.Item
        : null;
};

exports.queryTable = async function queryTable(
    tableName,
    conditionExpression,
    expressionAttributeNames,
    expressionAttributeValues,
    { limit, reverse = false, indexName = null } = {},
    serviceParams = {},
) {
    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const params = {
        TableName: tableName,
        KeyConditionExpression: conditionExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ScanIndexForward: !reverse,
        Limit: limit,
    };

    if (indexName != null) {
        params.IndexName = indexName;
    }

    const response = await documentClient.query(params).promise();

    return {
        items: response.Items,
        count: response.Count,
        lastEvaluatedKey: response.LastEvaluatedKey,
    };
};

exports.getRepoConfig = async function getRepoConfig(tableName, id, serviceParams = {}) {
    return exports.getTableItemByKey(
        tableName,
        { id },
        serviceParams,
    );
};

exports.getSession = async function getSession(tableName, id, serviceParams = {}) {
    return exports.getTableItemByKey(
        tableName,
        { id },
        serviceParams,
    );
};

exports.setSession = async function setSession(tableName, id, sessionData, serviceParams = {}) {
    let UpdateExpression = 'SET #ut = :time, #ct = if_not_exists(#ct, :time), #sd = :sd, #t = :ttl';
    const ExpressionAttributeNames = {
        '#ct': 'createTime',
        '#ut': 'updateTime',
        '#sd': 'sessionData',
        '#t': 'ttlTime',
    };
    const ExpressionAttributeValues = {
        ':time': Date.now(),
        ':ttl': Math.floor(Date.now() / 1000) + 172800, // TTL in 48 hours
        ':sd': sessionData,
    };

    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.update({
        TableName: tableName,
        Key: {
            id,
        },
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }).promise();

    return response.Attributes;
};

exports.destroySession = async function destroySession(tableName, id, serviceParams = {}) {
    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.delete({
        TableName: tableName,
        Key: {
            id,
        },
        ReturnValues: 'ALL_OLD',
    }).promise();

    return response.Attributes;
};

exports.getLock = async function getLock(tableName, id, serviceParams = {}) {
    return exports.getTableItemByKey(
        tableName,
        { id },
        serviceParams,
    );
};

exports.attemptLock = async function attemptLock(
    tableName,
    id,
    traceId,
    meta,
    timeoutSeconds,
    serviceParams = {},
) {
    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.put({
        TableName: tableName,
        Item: {
            id,
            traceId,
            created: Date.now(),
            lastUpdate: Date.now(),
            meta,
        },
        ConditionExpression: 'attribute_not_exists(lastUpdate) OR lastUpdate < :time',
        ExpressionAttributeValues: {
            ':time': Date.now() - timeoutSeconds * 1000,
        },
        ReturnValues: 'ALL_OLD',
    }).promise();

    return response.Attributes;
};

exports.updateLock = async function updateLock(
    tableName,
    id,
    traceId,
    meta = null,
    serviceParams = {},
) {
    let UpdateExpression = 'SET #lu = :time';
    const ExpressionAttributeNames = {
        '#lu': 'lastUpdate',
    };
    const ExpressionAttributeValues = {
        ':time': Date.now(),
        ':trace': traceId,
    };

    if (meta) {
        const keys = Object.keys(meta);
        for (let i = 0; i < keys.length; i++) {
            UpdateExpression += `, meta.#n${i} = :v${i}`;
            ExpressionAttributeNames[`#n${i}`] = keys[i];
            ExpressionAttributeValues[`:v${i}`] = meta[keys[i]];
        }
    }

    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.update({
        TableName: tableName,
        Key: {
            id,
        },
        UpdateExpression,
        ConditionExpression: 'attribute_exists(traceId) AND traceId = :trace',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_OLD',
    }).promise();

    return response.Attributes;
};

exports.releaseLock = async function releaseLock(
    tableName,
    id,
    traceId,
    serviceParams = {},
) {
    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    await documentClient.delete({
        TableName: tableName,
        Key: {
            id,
        },
        ConditionExpression: 'traceId = :trace',
        ExpressionAttributeValues: {
            ':trace': traceId,
        },
    }).promise();
};

exports.getNextExecutionId = async function getNextExecutionId(
    tableName,
    repoId,
    commit,
    serviceParams = {},
) {
    const records = await exports.queryTable(
        tableName,
        '#id = :id and begins_with(#cs, :cs)',
        {
            '#id': 'repoId',
            '#cs': 'executionId',
        },
        {
            ':id': repoId,
            ':cs': `${commit}/`,
        },
        {
            limit: 1,
            reverse: true,
            indexName: 'search-repoId-executionId-index',
        },
        serviceParams,
    );

    return util.buildExecutionId(
        commit,
        records.items.length
            ? 1 + util.parseExecutionId(records.items[0].executionId).executionNum
            : 1
    );
};

exports.getExecutionsForCommit = async function getExecutionsForCommit(
    tableName,
    repoId,
    commit,
    { limit = 10, reverse = true },
    serviceParams = {},
) {
    return await exports.queryTable(
        tableName,
        '#id = :id and begins_with(#cs, :cs)',
        {
            '#id': 'repoId',
            '#cs': 'executionId',
        },
        {
            ':id': repoId,
            ':cs': `${commit}/`,
        },
        {
            limit,
            reverse,
            indexName: 'search-repoId-executionId-index',
        },
        serviceParams,
    );
};

exports.getExecutionsForRepo = async function getExecutionsForRepo(
    tableName,
    repoId,
    { limit = 50, reverse = true },
    serviceParams = {},
) {
    return await exports.queryTable(
        tableName,
        '#id = :id',
        {
            '#id': 'repoId',
        },
        {
            ':id': repoId,
        },
        {
            limit,
            reverse,
            indexName: 'search-repoId-createTime-index',
        },
        serviceParams,
    );
};

exports.getExecution = async function getExecution(tableName, repoId, executionId, serviceParams = {}) {
    return exports.getTableItemByKey(
        tableName,
        {
            repoId,
            executionId,
        },
        serviceParams,
    );
};

exports.createExecution = async function createExecution(
    tableName,
    repoId,
    executionId,
    meta = {},
    state = {},
    serviceParams = {},
) {
    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.put({
        TableName: tableName,
        Item: {
            repoId,
            executionId,
            status: 'QUEUED',
            createTime: new Date().toISOString(),
            updateTime: new Date().toISOString(),
            conclusion: null,
            conclusionTime: null,
            meta,
            state,
        },
        ConditionExpression: 'attribute_not_exists(executionId)',
    }).promise();

    return response.Attributes;
};

exports.updateExecution = async function updateExecution(
    tableName,
    repoId,
    executionId,
    {
        status = null,
        conclusion = null,
        meta = null,
        state = null,
    } = {},
    serviceParams = {},
) {
    let UpdateExpression = 'SET #updateTime = :updateTime';
    const ExpressionAttributeNames = {
        '#updateTime': 'updateTime',
    };
    const ExpressionAttributeValues = {
        ':updateTime': new Date().toISOString(),
    };

    if (status) {
        UpdateExpression += ', #status = :status';
        ExpressionAttributeNames['#status'] = 'status';
        ExpressionAttributeValues[':status'] = status;
    }

    if (conclusion) {
        UpdateExpression += ', #conclusion = :conclusion, #conclusionTime = :conclusionTime';
        ExpressionAttributeNames['#conclusion'] = 'conclusion';
        ExpressionAttributeValues[':conclusion'] = conclusion;
        ExpressionAttributeNames['#conclusionTime'] = 'conclusionTime';
        ExpressionAttributeValues[':conclusionTime'] = new Date().toISOString();
    }

    if (state) {
        UpdateExpression += ', #state = :state';
        ExpressionAttributeNames['#state'] = 'state';
        ExpressionAttributeValues[':state'] = state;
    }

    if (meta) {
        const keys = Object.keys(meta);
        for (let i = 0; i < keys.length; i++) {
            UpdateExpression += `, meta.#meta${i} = :meta${i}`;
            ExpressionAttributeNames[`#meta${i}`] = keys[i];
            ExpressionAttributeValues[`:meta${i}`] = meta[keys[i]];
        }
    }

    const dynamoDB = new AWS.DynamoDB({
        apiVersion: '2012-08-10',
        region: AWS_REGION,
        ...serviceParams,
    });

    const documentClient = new AWS.DynamoDB.DocumentClient({
        service: dynamoDB,
    });

    const response = await documentClient.update({
        TableName: tableName,
        Key: {
            repoId,
            executionId,
        },
        UpdateExpression,
        ConditionExpression: 'attribute_exists(executionId)',
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    }).promise();

    return response.Attributes;
};

exports.encryptString = async function encryptString(keyId, plaintext, serviceParams = {}) {
    const kms = new AWS.KMS({
        apiVersion: '2014-11-01',
        region: AWS_REGION,
        ...serviceParams,
    });

    const response = await kms.encrypt({
        KeyId: keyId,
        Plaintext: plaintext,
    }).promise();

    return Buffer.isBuffer(response.CiphertextBlob)
        ? response.CiphertextBlob.toString('base64')
        : response.CiphertextBlob;
};

exports.decryptString = async function decryptString(encryptedString, serviceParams = {}) {
    const kms = new AWS.KMS({
        apiVersion: '2014-11-01',
        region: AWS_REGION,
        ...serviceParams,
    });

    const response = await kms.decrypt({
        CiphertextBlob: Buffer.isBuffer(encryptedString)
            ? encryptedString
            : Buffer.from(encryptedString, 'base64'),
    }).promise();

    return response.Plaintext;
};

exports.parseArn = function parseArn(arn) {
    if (typeof arn !== 'string') {
        throw new Error('arn must be a string');
    }

    let match;
    if (match = arn.match(/^arn:aws:codebuild:([^:]+):([^:]+):build\/(.+:.+)$/)) {
        return {
            type: 'codebuild-build',
            region: match[1],
            accountId: match[2],
            buildId: match[3],
        };
    }
    else if (match = arn.match(/^arn:aws:codebuild:([^:]+):([^:]+):project\/(.+)$/)) {
        return {
            type: 'codebuild-project',
            region: match[1],
            accountId: match[2],
            buildId: match[3],
        };
    }
    else if (match = arn.match(/^arn:aws:s3:::([^/]+)(?:\/(.+))?$/)) {
        return {
            type: 's3',
            bucketName: match[1],
            keyName: match[2] || null,
        };
    }
    else if (match = arn.match(/^arn:aws:lambda:([^:]+):([^:]+):function:([^:]+)(?::([^:]+))?$/)) {
        return {
            type: 'lambda-function',
            region: match[1],
            accountId: match[2],
            functionName: match[3],
            version: match[4] || null,
        };
    }
    else if (match = arn.match(/^arn:aws:kms:([^:]+):([^:]+):key\/(.+)$/)) {
        return {
            type: 'kms',
            region: match[1],
            accountId: match[2],
            keyId: match[3],
        };
    }
    else if (match = arn.match(/^arn:aws:ssm:([^:]+):([^:]+):parameter\/(.+)$/)) {
        return {
            type: 'ssm-parameter',
            region: match[1],
            accountId: match[2],
            parameterName: match[3],
        };
    }
    else {
        throw new Error(`arn is invalid or not supported: ${arn}`);
    }
};
