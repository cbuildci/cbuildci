'use strict';

const schema = require('../../../src/common/schema');

describe('schema', () => {

    it('should have expected exports', () => {
        expect(Object.keys(schema).sort()).toEqual([
            'validateRepoConfig',
            'validateBuildsYml',
            'validateBuildParams',
            'checkBuildDependencies',
        ].sort());
    });

    describe('validateRepoConfig', () => {

        it('should throw error if "id" is missing or invalid', () => {
            expect(() => schema.validateRepoConfig({})).toThrowError('id must have a value');

            expect(() => schema.validateRepoConfig({
                id: null,
            })).toThrowError('id must have a value');

            expect(() => schema.validateRepoConfig({
                id: '',
            })).toThrowError('id must have a value');

            expect(() => schema.validateRepoConfig({
                id: 'foobar',
            })).toThrowError('id must be a valid repo ID');
        });

        it('should throw error if "codeBuildProjectArns" is missing or invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
            })).toThrowError('codeBuildProjectArns must have a value');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: '',
            })).toThrowError('codeBuildProjectArns must have a value');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: [],
            })).toThrowError('codeBuildProjectArns must not have a length less than 1');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['foobar'],
            })).toThrowError(
                'codeBuildProjectArns.0 must match the pattern /^arn:aws:codebuild:[^:]+:[^:]+:project\\/.+$/'
            );
        });

        it('should only require "id" and "codeBuildProjectArn" and have expected defaults for other props', () => {
            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
            })).not.toThrowError();

            expect(schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
            })).toEqual({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                // encryptedOAuthToken: undefined,
                // encryptedWebhookSecret: undefined,
                buildDefaults: {},
                // waitSeconds: undefined,
            });
        });

        it('should throw error if encryptedWebhookSecret is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedWebhookSecret: '',
            })).toThrowError('encryptedWebhookSecret must have a length of at least 1');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedWebhookSecret: 'fb',
            })).not.toThrowError();
        });

        it('should throw error if encryptedOAuthToken is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedOAuthToken: '',
            })).toThrowError('encryptedOAuthToken must have a length of at least 1');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedOAuthToken: 'fb',
            })).not.toThrowError();
        });

        it('should throw error if waitSeconds is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: '',
            })).toThrowError('waitSeconds must be a number');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: 9,
            })).toThrowError('waitSeconds must not be less than 10');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: 10.1,
            })).toThrowError('waitSeconds must be an integer');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: 121,
            })).toThrowError('waitSeconds must not be greater than 120');
        });

        it('should throw error if buildDefaults is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                buildDefaults: [],
            })).toThrowError('buildDefaults must be an object');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                buildDefaults: false,
            })).toThrowError('buildDefaults must be an object');

            expect(() => schema.validateRepoConfig({
                id: 'repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                buildDefaults: {},
            })).not.toThrowError();
        });
    });

    describe('validateBuildsYml', () => {
        it('should throw error if "version" is missing or invalid', () => {
            expect(() => schema.validateBuildsYml({})).toThrowError('version must have a value');

            expect(() => schema.validateBuildsYml({
                version: null,
            })).toThrowError('version must have a value');

            expect(() => schema.validateBuildsYml({
                version: '',
            })).toThrowError('version must have a value');

            expect(() => schema.validateBuildsYml({
                version: 'foobar',
            })).toThrowError('version must be a number');

            expect(() => schema.validateBuildsYml({
                version: 0,
            })).toThrowError('version must be one of the following values: 1');
        });

        it('should throw error if "builds" is missing or invalid', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
            })).toThrowError('builds must have a value');

            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: null,
            })).toThrowError('builds must have a value');

            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: 'foobar',
            })).toThrowError('builds must be an object');

            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: {},
            })).toThrowError('builds must have at least 1 property');
        });

        it('should only require "version" and "builds" and have expected defaults for other props', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: {
                    foobar: {},
                },
            })).not.toThrowError();

            expect(schema.validateBuildsYml({
                version: 1,
                builds: {
                    foobar: {},
                },
            })).toEqual({
                version: 1,
                checksName: 'CBuildCI',
                defaults: {},
                builds: {
                    foobar: {},
                },
            });
        });

        it('should throw error if "checksName" is invalid', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: 500,
                builds: {
                    foobar: {},
                },
            })).toThrowError('checksName must be a string');

            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: '',
                builds: {
                    foobar: {},
                },
            })).toThrowError('checksName must have a value');

            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: 'fo',
                builds: {
                    foobar: {},
                },
            })).toThrowError('checksName must have a length of at least 3');

            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: 'foo',
                builds: {
                    foobar: {},
                },
            })).not.toThrowError();
        });

        it('should throw error if "defaults" is invalid', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
                defaults: 'foobar',
                builds: {
                    foobar: {},
                },
            })).toThrowError('defaults must be an object');

            expect(() => schema.validateBuildsYml({
                version: 1,
                defaults: {},
                builds: {
                    foobar: {},
                },
            })).not.toThrowError();
        });
    });

    describe('validateBuildParams', () => {
        it('should throw error if "image" is missing or invalid', () => {
            expect(() => schema.validateBuildParams({})).toThrowError('codeBuildProjectArn must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: null,
            })).toThrowError('codeBuildProjectArn must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: '',
            })).toThrowError('codeBuildProjectArn must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'foobar',
            })).toThrowError(
                'codeBuildProjectArn must match the pattern /^arn:aws:codebuild:[^:]+:[^:]+:project\\/.+$/'
            );
        });

        it('should throw error if "image" is missing or invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
            })).toThrowError('image must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: null,
            })).toThrowError('image must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: '',
            })).toThrowError('image must have a value');
        });

        it('should throw error if "sourceS3Bucket" is missing or invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
            })).toThrowError('sourceS3Bucket must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: null,
            })).toThrowError('sourceS3Bucket must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: '',
            })).toThrowError('sourceS3Bucket must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: '',
            })).toThrowError('sourceS3Bucket must have a value');
        });

        it('should only require "image" and "sourceS3Bucket" and have expected defaults for other props', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
            })).not.toThrowError();

            expect(schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
            })).toEqual({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                // commitStatus: undefined,
                buildspec: 'buildspec.yml',
                computeType: 'BUILD_GENERAL1_SMALL',
                environmentType: 'LINUX_CONTAINER',
                privilegedMode: false,
                timeoutInMinutes: 5,
                stopIfNotBranchHead: false,
                dependsOn: [],
                environmentVariables: [],
                // branches: undefined,
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: '',
                noArtifacts: false,
                // artifactS3Bucket: undefined,
                artifactS3KeyPrefix: '',
                useCache: false,
                // cacheS3Bucket: undefined,
                cacheS3KeyPrefix: '',
            });
        });

        it('should throw error if "commitStatus" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                commitStatus: 'fo',
            })).toThrowError('commitStatus must have a length of at least 3');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                commitStatus: 'foo',
            })).not.toThrowError();
        });

        it('should throw error if "buildspec" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: null,
            })).toThrowError('buildspec must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: '',
            })).toThrowError('buildspec must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: true,
            })).toThrowError('buildspec must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: 'f',
            })).not.toThrowError();
        });

        it('should throw error if "computeType" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: null,
            })).toThrowError('computeType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: '',
            })).toThrowError('computeType must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: true,
            })).toThrowError('computeType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: 'f',
            })).not.toThrowError();
        });

        it('should throw error if "environmentType" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: null,
            })).toThrowError('environmentType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: '',
            })).toThrowError('environmentType must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: true,
            })).toThrowError('environmentType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: 'f',
            })).not.toThrowError();
        });

        it('should throw error if "privilegedMode" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: null,
            })).toThrowError('privilegedMode must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: '',
            })).toThrowError('privilegedMode must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: 'foobar',
            })).toThrowError('privilegedMode must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: true,
            })).not.toThrowError();
        });

        it('should throw error if "timeoutInMinutes" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: null,
            })).toThrowError('timeoutInMinutes must be a number');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: '',
            })).toThrowError('timeoutInMinutes must be a number');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 'foobar',
            })).toThrowError('timeoutInMinutes must be a number');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 4,
            })).toThrowError('timeoutInMinutes must not be less than 5');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 481,
            })).toThrowError('timeoutInMinutes must not be greater than 480');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 5,
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 480,
            })).not.toThrowError();
        });

        it('should throw error if "stopIfNotBranchHead" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: null,
            })).toThrowError('stopIfNotBranchHead must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: '',
            })).toThrowError('stopIfNotBranchHead must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: 'foobar',
            })).toThrowError('stopIfNotBranchHead must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: true,
            })).not.toThrowError();
        });

        it('should throw error if "dependsOn" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: null,
            })).toThrowError('dependsOn must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: {},
            })).toThrowError('dependsOn must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: 'foobar',
            })).toThrowError('dependsOn must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [],
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [null],
            })).toThrowError('dependsOn.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [''],
            })).toThrowError('dependsOn.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [false],
            })).toThrowError('dependsOn.0 must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: ['foobar', 'barfoo'],
            })).not.toThrowError();
        });

        it('should throw error if "environmentVariables" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: null,
            })).toThrowError('environmentVariables must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: 'foobar',
            })).toThrowError('environmentVariables must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: false,
            })).toThrowError('environmentVariables must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [],
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    null,
                ],
            })).toThrowError('environmentVariables.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    'foobar',
                ],
            })).toThrowError('environmentVariables.0 must be an object');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {},
                ],
            })).toThrowError('environmentVariables.0.name must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: false,
                    },
                ],
            })).toThrowError('environmentVariables.0.name must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                    },
                ],
            })).toThrowError('environmentVariables.0.value must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                        value: false,
                    },
                ],
            })).toThrowError('environmentVariables.0.value must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                        value: 'barfoo',
                    },
                ],
            })).not.toThrowError();

            // Cleans unsupported props.
            expect(schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                        value: 'barfoo',
                        foo: 'bar',
                    },
                ],
            }).environmentVariables).toEqual([
                    {
                        name: 'foobar',
                        value: 'barfoo',
                    },
                ]);

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                        value: 'barfoo',
                    },
                    {},
                ],
            })).toThrowError('environmentVariables.1.name must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                        value: 'barfoo',
                    },
                    {
                        name: 'foobar',
                        value: 'barfoo',
                    },
                ],
            })).not.toThrowError();
        });

        it('should throw error if "branches" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: null,
            })).toThrowError('branches must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: {},
            })).toThrowError('branches must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: 'foobar',
            })).toThrowError('branches must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [],
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [null],
            })).toThrowError('branches.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [''],
            })).toThrowError('branches.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [false],
            })).toThrowError('branches.0 must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: ['/+/'],
            })).toThrowError('branches.0 is an invalid pattern');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: ['foobar', 'bar*foo', '/.+/'],
            })).not.toThrowError();
        });

        it('should throw error if "sourceS3KeyPrefix" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: '/',
            })).toThrowError('sourceS3KeyPrefix must not start with "/"');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: null,
            })).toThrowError('sourceS3KeyPrefix must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: false,
            })).toThrowError('sourceS3KeyPrefix must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: '',
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: 'foobar',
            })).not.toThrowError();
        });

        it('should throw error if "noArtifacts" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                noArtifacts: null,
            })).toThrowError('noArtifacts must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                noArtifacts: '',
            })).toThrowError('noArtifacts must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                noArtifacts: 'foobar',
            })).toThrowError('noArtifacts must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                noArtifacts: true,
            })).not.toThrowError();
        });

        it('should throw error if "artifactS3Bucket" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3Bucket: '',
            })).toThrowError('artifactS3Bucket must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3Bucket: 'foobar',
            })).not.toThrowError();
        });

        it('should throw error if "artifactS3KeyPrefix" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: '/',
            })).toThrowError('artifactS3KeyPrefix must not start with "/"');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: null,
            })).toThrowError('artifactS3KeyPrefix must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: false,
            })).toThrowError('artifactS3KeyPrefix must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: '',
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: 'foobar',
            })).not.toThrowError();
        });

        it('should throw error if "useCache" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                useCache: null,
            })).toThrowError('useCache must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                useCache: '',
            })).toThrowError('useCache must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                useCache: 'foobar',
            })).toThrowError('useCache must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                useCache: true,
            })).not.toThrowError();
        });

        it('should throw error if "cacheS3Bucket" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3Bucket: '',
            })).toThrowError('cacheS3Bucket must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3Bucket: 'foobar',
            })).not.toThrowError();
        });

        it('should throw error if "cacheS3KeyPrefix" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3KeyPrefix: '/',
            })).toThrowError('cacheS3KeyPrefix must not start with "/"');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3KeyPrefix: null,
            })).toThrowError('cacheS3KeyPrefix must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3KeyPrefix: false,
            })).toThrowError('cacheS3KeyPrefix must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3KeyPrefix: '',
            })).not.toThrowError();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                cacheS3KeyPrefix: 'foobar',
            })).not.toThrowError();
        });
    });

    describe('checkBuildDependencies', () => {
        // TODO: May want some more complex examples to test.

        function validateBuilds(builds) {
            return Object.entries(builds)
                .reduce((ret, [key, value]) => {
                    ret[key] = schema.validateBuildParams(value);
                    return ret;
                }, {});
        }

        it('it should not throw error if there are no cyclic dependencies', () => {
            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                    },
                    second: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                    third: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'second',
                        ],
                    },
                    fourth: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'third',
                        ],
                    },
                }),
            )).not.toThrowError();

            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    fourth: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'third',
                        ],
                    },
                    third: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'second',
                        ],
                    },
                    second: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                    },
                }),
            )).not.toThrowError();

            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                    },
                    second: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                    third: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                            'second',
                        ],
                    },
                    fourth: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'third',
                        ],
                    },
                }),
            )).not.toThrowError();
        });

        it('it should catch cyclic dependencies', () => {
            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                }),
            )).toThrowError('Build "first" cannot have a dependency to itself');

            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'second',
                        ],
                    },
                }),
            )).toThrowError('Build "first" depends on "second" which does not exist');

            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'second',
                        ],
                    },
                    second: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                }),
            )).toThrowError('Builds "second" and "first" have a circular dependency');

            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'third',
                        ],
                    },
                    second: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                    third: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'second',
                        ],
                    },
                }),
            )).toThrowError('Builds "third" and "second" have a circular dependency');

            expect(() => schema.checkBuildDependencies(
                validateBuilds({
                    third: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'second',
                        ],
                    },
                    second: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'first',
                        ],
                    },
                    first: {
                        codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                        image: 'foobar',
                        sourceS3Bucket: 'srcbucket',
                        dependsOn: [
                            'third',
                        ],
                    },
                }),
            )).toThrowError('Builds "first" and "third" have a circular dependency');
        });
    });
});
