'use strict';

const chai = require('chai');
const expect = chai.expect;

const schema = require('../../../src/common/schema');

describe('schema', () => {

    it('should have expected exports', () => {
        expect(Object.keys(schema).sort()).to.deep.equal([
            'validateRepoConfig',
            'validateBuildsYml',
            'validateBuildParams',
            'checkBuildDependencies',
        ].sort());
    });

    describe('validateRepoConfig', () => {

        it('should throw error if "id" is missing or invalid', () => {
            expect(() => schema.validateRepoConfig({}))
                .to.throw('id must have a value');

            expect(() => schema.validateRepoConfig({
                id: null,
            }))
                .to.throw('id must have a value');

            expect(() => schema.validateRepoConfig({
                id: '',
            }))
                .to.throw('id must have a value');

            expect(() => schema.validateRepoConfig({
                id: 'foobar',
            }))
                .to.throw('id must be a valid repo ID');
        });

        it('should throw error if "codeBuildProjectArns" is missing or invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
            }))
                .to.throw('codeBuildProjectArns must have a value');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: '',
            }))
                .to.throw('codeBuildProjectArns must have a value');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: [],
            }))
                .to.throw('codeBuildProjectArns must not have a length less than 1');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['foobar'],
            }))
                .to.throw('codeBuildProjectArns.0 must match the pattern /^arn:aws:codebuild:[^:]+:[^:]+:project\\/.+$/');
        });

        it('should only require "id" and "codeBuildProjectArn" and have expected defaults for other props', () => {
            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
            }))
                .to.not.throw();

            expect(schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
            })).to.deep.equal({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                // encryptedOAuthToken: undefined,
                // encryptedWebhookSecret: undefined,
                buildDefaults: {},
                // waitSeconds: undefined,
            });
        });

        it('should throw error if encryptedWebhookSecret is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedWebhookSecret: '',
            }))
                .to.throw('encryptedWebhookSecret must have a length of at least 1');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedWebhookSecret: 'fb',
            }))
                .to.not.throw();
        });

        it('should throw error if encryptedOAuthToken is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedOAuthToken: '',
            }))
                .to.throw('encryptedOAuthToken must have a length of at least 1');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                encryptedOAuthToken: 'fb',
            }))
                .to.not.throw();
        });

        it('should throw error if waitSeconds is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: '',
            }))
                .to.throw('waitSeconds must be a number');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: 9,
            }))
                .to.throw('waitSeconds must not be less than 10');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: 10.1,
            }))
                .to.throw('waitSeconds must be an integer');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                waitSeconds: 121,
            }))
                .to.throw('waitSeconds must not be greater than 120');
        });

        it('should throw error if buildDefaults is invalid', () => {
            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                buildDefaults: [],
            }))
                .to.throw('buildDefaults must be an object');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                buildDefaults: false,
            }))
                .to.throw('buildDefaults must be an object');

            expect(() => schema.validateRepoConfig({
                id: 'host/repo/user',
                codeBuildProjectArns: ['arn:aws:codebuild:us-east-1:123456789012:project/foobar'],
                buildDefaults: {},
            }))
                .to.not.throw();
        });
    });

    describe('validateBuildsYml', () => {
        it('should throw error if "version" is missing or invalid', () => {
            expect(() => schema.validateBuildsYml({}))
                .to.throw('version must have a value');

            expect(() => schema.validateBuildsYml({
                version: null,
            }))
                .to.throw('version must have a value');

            expect(() => schema.validateBuildsYml({
                version: '',
            }))
                .to.throw('version must have a value');

            expect(() => schema.validateBuildsYml({
                version: 'foobar',
            }))
                .to.throw('version must be a number');

            expect(() => schema.validateBuildsYml({
                version: 0,
            }))
                .to.throw('version must be one of the following values: 1');
        });

        it('should throw error if "builds" is missing or invalid', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
            }))
                .to.throw('builds must have a value');

            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: null,
            }))
                .to.throw('builds must have a value');

            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: 'foobar',
            }))
                .to.throw('builds must be an object');

            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: {},
            }))
                .to.throw('builds must have at least 1 property');
        });

        it('should only require "version" and "builds" and have expected defaults for other props', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
                builds: {
                    foobar: {},
                },
            }))
                .to.not.throw();

            expect(schema.validateBuildsYml({
                version: 1,
                builds: {
                    foobar: {},
                },
            })).to.deep.equal({
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
            }))
                .to.throw('checksName must be a string');

            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: '',
                builds: {
                    foobar: {},
                },
            }))
                .to.throw('checksName must have a value');

            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: 'fo',
                builds: {
                    foobar: {},
                },
            }))
                .to.throw('checksName must have a length of at least 3');

            expect(() => schema.validateBuildsYml({
                version: 1,
                checksName: 'foo',
                builds: {
                    foobar: {},
                },
            }))
                .to.not.throw();
        });

        it('should throw error if "defaults" is invalid', () => {
            expect(() => schema.validateBuildsYml({
                version: 1,
                defaults: 'foobar',
                builds: {
                    foobar: {},
                },
            }))
                .to.throw('defaults must be an object');

            expect(() => schema.validateBuildsYml({
                version: 1,
                defaults: {},
                builds: {
                    foobar: {},
                },
            }))
                .to.not.throw();
        });
    });

    describe('validateBuildParams', () => {
        it('should throw error if "image" is missing or invalid', () => {
            expect(() => schema.validateBuildParams({}))
                .to.throw('codeBuildProjectArn must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: null,
            }))
                .to.throw('codeBuildProjectArn must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: '',
            }))
                .to.throw('codeBuildProjectArn must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'foobar',
            }))
                .to.throw('codeBuildProjectArn must match the pattern /^arn:aws:codebuild:[^:]+:[^:]+:project\\/.+$/');
        });

        it('should throw error if "image" is missing or invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
            }))
                .to.throw('image must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: null,
            }))
                .to.throw('image must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: '',
            }))
                .to.throw('image must have a value');
        });

        it('should throw error if "sourceS3Bucket" is missing or invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
            }))
                .to.throw('sourceS3Bucket must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: null,
            }))
                .to.throw('sourceS3Bucket must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: '',
            }))
                .to.throw('sourceS3Bucket must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: '',
            }))
                .to.throw('sourceS3Bucket must have a value');
        });

        it('should only require "image" and "sourceS3Bucket" and have expected defaults for other props', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
            }))
                .to.not.throw();

            expect(schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
            })).to.deep.equal({
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
                // artifactS3Bucket: undefined,
                artifactS3KeyPrefix: '',
            });
        });

        it('should throw error if "commitStatus" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                commitStatus: 'fo',
            }))
                .to.throw('commitStatus must have a length of at least 3');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                commitStatus: 'foo',
            }))
                .to.not.throw();
        });

        it('should throw error if "buildspec" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: null,
            }))
                .to.throw('buildspec must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: '',
            }))
                .to.throw('buildspec must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: true,
            }))
                .to.throw('buildspec must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                buildspec: 'f',
            }))
                .to.not.throw();
        });

        it('should throw error if "computeType" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: null,
            }))
                .to.throw('computeType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: '',
            }))
                .to.throw('computeType must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: true,
            }))
                .to.throw('computeType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                computeType: 'f',
            }))
                .to.not.throw();
        });

        it('should throw error if "environmentType" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: null,
            }))
                .to.throw('environmentType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: '',
            }))
                .to.throw('environmentType must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: true,
            }))
                .to.throw('environmentType must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentType: 'f',
            }))
                .to.not.throw();
        });

        it('should throw error if "privilegedMode" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: null,
            }))
                .to.throw('privilegedMode must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: '',
            }))
                .to.throw('privilegedMode must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: 'foobar',
            }))
                .to.throw('privilegedMode must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                privilegedMode: true,
            }))
                .to.not.throw();
        });

        it('should throw error if "timeoutInMinutes" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: null,
            }))
                .to.throw('timeoutInMinutes must be a number');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: '',
            }))
                .to.throw('timeoutInMinutes must be a number');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 'foobar',
            }))
                .to.throw('timeoutInMinutes must be a number');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 4,
            }))
                .to.throw('timeoutInMinutes must not be less than 5');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 481,
            }))
                .to.throw('timeoutInMinutes must not be greater than 480');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 5,
            }))
                .to.not.throw();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                timeoutInMinutes: 480,
            }))
                .to.not.throw();
        });

        it('should throw error if "stopIfNotBranchHead" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: null,
            }))
                .to.throw('stopIfNotBranchHead must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: '',
            }))
                .to.throw('stopIfNotBranchHead must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: 'foobar',
            }))
                .to.throw('stopIfNotBranchHead must be a boolean');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                stopIfNotBranchHead: true,
            }))
                .to.not.throw();
        });

        it('should throw error if "dependsOn" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: null,
            }))
                .to.throw('dependsOn must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: {},
            }))
                .to.throw('dependsOn must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: 'foobar',
            }))
                .to.throw('dependsOn must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [],
            }))
                .to.not.throw();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [null],
            }))
                .to.throw('dependsOn.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [''],
            }))
                .to.throw('dependsOn.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: [false],
            }))
                .to.throw('dependsOn.0 must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                dependsOn: ['foobar', 'barfoo'],
            }))
                .to.not.throw();
        });

        it('should throw error if "environmentVariables" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: null,
            }))
                .to.throw('environmentVariables must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: 'foobar',
            }))
                .to.throw('environmentVariables must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: false,
            }))
                .to.throw('environmentVariables must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [],
            }))
                .to.not.throw();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    null,
                ],
            }))
                .to.throw('environmentVariables.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    'foobar',
                ],
            }))
                .to.throw('environmentVariables.0 must be an object');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {},
                ],
            }))
                .to.throw('environmentVariables.0.name must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: false,
                    },
                ],
            }))
                .to.throw('environmentVariables.0.name must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                environmentVariables: [
                    {
                        name: 'foobar',
                    },
                ],
            }))
                .to.throw('environmentVariables.0.value must have a value');

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
            }))
                .to.throw('environmentVariables.0.value must be a string');

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
            }))
                .to.not.throw();

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
            }).environmentVariables)
                .to.deep.equal([
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
            }))
                .to.throw('environmentVariables.1.name must have a value');

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
            }))
                .to.not.throw();
        });

        it('should throw error if "branches" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: null,
            }))
                .to.throw('branches must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: {},
            }))
                .to.throw('branches must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: 'foobar',
            }))
                .to.throw('branches must be an array');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [],
            }))
                .to.not.throw();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [null],
            }))
                .to.throw('branches.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [''],
            }))
                .to.throw('branches.0 must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: [false],
            }))
                .to.throw('branches.0 must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: ['/+/'],
            }))
                .to.throw('branches.0 is an invalid pattern');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                branches: ['foobar', 'bar*foo', '/.+/'],
            }))
                .to.not.throw();
        });

        it('should throw error if "sourceS3KeyPrefix" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: '/',
            }))
                .to.throw('sourceS3KeyPrefix must not start with "/"');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: null,
            }))
                .to.throw('sourceS3KeyPrefix must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: false,
            }))
                .to.throw('sourceS3KeyPrefix must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: '',
            }))
                .to.not.throw();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                sourceS3KeyPrefix: 'foobar',
            }))
                .to.not.throw();
        });

        it('should throw error if "artifactS3Bucket" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3Bucket: '',
            }))
                .to.throw('artifactS3Bucket must have a length of at least 1');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3Bucket: 'foobar',
            }))
                .to.not.throw();
        });

        it('should throw error if "artifactS3KeyPrefix" is invalid', () => {
            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: '/',
            }))
                .to.throw('artifactS3KeyPrefix must not start with "/"');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: null,
            }))
                .to.throw('artifactS3KeyPrefix must have a value');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: false,
            }))
                .to.throw('artifactS3KeyPrefix must be a string');

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: '',
            }))
                .to.not.throw();

            expect(() => schema.validateBuildParams({
                codeBuildProjectArn: 'arn:aws:codebuild:us-east-1:123456789012:project/foobar',
                image: 'foobar',
                sourceS3Bucket: 'foosource',
                artifactS3KeyPrefix: 'foobar',
            }))
                .to.not.throw();
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
            ))
                .to.not.throw();

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
            ))
                .to.not.throw();

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
            ))
                .to.not.throw();
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
            ))
                .to.throw('Build "first" cannot have a dependency to itself');

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
            ))
                .to.throw('Build "first" depends on "second" which does not exist');

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
            ))
                .to.throw('Builds "second" and "first" have a circular dependency');

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
            ))
                .to.throw('Builds "third" and "second" have a circular dependency');

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
            ))
                .to.throw('Builds "first" and "third" have a circular dependency');
        });
    });
});
