'use strict';

const util = require('./util');
const v = require('./v');
const {
    props,
    isRequired,
    isOptional,
    isObject,
    isString,
    isNumber,
    isArray,
    isBoolean,
    isOneOf,
    mapArray,
    VError,
} = v;

/**
 * @typedef {object} RepoConfig
 * @property {string} id
 * @property {string[]} codeBuildProjectArns
 * @property {string|null} encryptedWebhookSecret
 * @property {string|null} encryptedOAuthToken
 * @property {number|null} waitSeconds
 * @property {object} buildDefaults
 */

/**
 * Validate the repo config for a repo.
 */
exports.validateRepoConfig = v.top(
    isRequired(),
    isObject(),
    props({
        id: v(
            isRequired(),
            isString(),
            (value) => {
                if (!util.isValidRepoId(value)) {
                    throw new VError('{} must be a valid repo ID');
                }
                return value;
            },
        ),
        codeBuildProjectArns: v(
            isRequired(),
            isArray({ min: 1 }),
            mapArray(
                v(
                    isRequired(),
                    isString({ match: /^arn:aws:codebuild:[^:]+:[^:]+:project\/.+$/ }),
                ),
            ),
        ),
        encryptedWebhookSecret: v(
            isOptional(),
            isString({ min: 1 }),
        ),
        encryptedOAuthToken: v(
            isOptional(),
            isString({ min: 1 }),
        ),
        waitSeconds: v(
            isOptional(),
            isNumber({ min: 10, max: 120, onlyInteger: true }),
        ),
        buildDefaults: v(
            isOptional({ defaultTo: () => ({}) }),
            isObject(),
        ),
    })
);

/**
 * Validate a repo's YAML repo.
 *
 * @type {function}
 */
exports.validateBuildsYml = v.top(
    isRequired(),
    isObject(),
    props({
        version: v(
            isRequired(),
            isNumber(),
            isOneOf([1]),
        ),
        checksName: v(
            isRequired({ defaultTo: 'CBuildCI' }),
            isString({ min: 3 }),
        ),
        defaults: v(
            isOptional({ defaultTo: () => ({}) }),
            isObject(),
        ),
        builds: v(
            isRequired(),
            isObject({ minProps: 1 }),
        ),
    }),
);

/**
 * @typedef {object} BuildParams
 * @property {string} commitStatus
 * @property {string} codeBuildProjectArn
 * @property {string} image
 * @property {string} buildspec
 * @property {string} computeType
 * @property {string} environmentType
 * @property {boolean} privilegedMode
 * @property {number} timeoutInMinutes
 * @property {boolean} stopIfNotBranchHead
 * @property {string[]} dependsOn
 * @property {object[]} environmentVariables
 * @property {string[]} branches
 * @property {string} sourceS3Bucket
 * @property {string} sourceS3KeyPrefix
 * @property {boolean} noArtifacts
 * @property {string} artifactS3Bucket
 * @property {string} artifactS3KeyPrefix
 */

/**
 * Validate the final params for a build.
 *
 * This is after merging in defaults from repo config and "defaults" in YAML.
 *
 * @type {function}
 */
exports.validateBuildParams = v.top(
    isRequired(),
    isObject(),
    props({
        commitStatus: v(
            isOptional(),
            isString({ min: 3 }),
        ),
        codeBuildProjectArn: v(
            isRequired(),
            isString({ match: /^arn:aws:codebuild:[^:]+:[^:]+:project\/.+$/ }),
        ),
        image: v(
            isRequired(),
            isString(),
        ),
        buildspec: v(
            isOptional({ defaultTo: 'buildspec.yml' }),
            isString({ min: 1 }),
        ),
        computeType: v(
            isOptional({ defaultTo: 'BUILD_GENERAL1_SMALL' }),
            isString({ min: 1 }),
        ),
        environmentType: v(
            isOptional({ defaultTo: 'LINUX_CONTAINER' }),
            isString({ min: 1 }),
        ),
        privilegedMode: v(
            isOptional({ defaultTo: false }),
            isBoolean(),
        ),
        timeoutInMinutes: v(
            isOptional({ defaultTo: 5 }),
            isNumber({ min: 5, max: 480, onlyInteger: true }),
        ),
        stopIfNotBranchHead: v(
            isOptional({ defaultTo: false }),
            isBoolean(),
        ),
        dependsOn: v(
            isOptional({ defaultTo: () => [] }),
            isArray(),
            mapArray(
                isRequired(),
                isString(),
            ),
        ),
        environmentVariables: v(
            isOptional({ defaultTo: () => [] }),
            isArray(),
            mapArray(
                v(
                    isRequired(),
                    isObject(),
                    props({
                        name: v(
                            isRequired(),
                            isString({ notStartsWith: 'C_' }),
                        ),
                        value: v(
                            isRequired(),
                            isString({ min: 1 }),
                        ),
                    }),
                )
            ),
            (value) => value.map((item) => ({
                name: item.name,
                value: item.value,
            })),
        ),
        branches: v(
            isOptional(),
            isArray(),
            mapArray(
                isRequired(),
                isString(),
                (value) => {
                    if (!util.convertToRegex(value)) {
                        throw new VError('{} is an invalid pattern');
                    }
                    return true;
                },
            ),
        ),
        sourceS3Bucket: v(
            isRequired(),
            isString(),
        ),
        sourceS3KeyPrefix: v(
            isRequired({ defaultTo: '', allowEmptyString: true }),
            isString({ notStartsWith: '/' }),
        ),
        artifactS3Bucket: v(
            isOptional(),
            isString({ min: 1 }),
        ),
        artifactS3KeyPrefix: v(
            isRequired({ defaultTo: '', allowEmptyString: true }),
            isString({ notStartsWith: '/' }),
        ),
    }),
);

/**
 * Check builds for circular dependencies.
 *
 * @param {object[]} builds
 */
exports.checkBuildDependencies = function checkBuildDependencies(builds) {
    const nodes = {};

    for (const buildKey of Object.keys(builds)) {

        const build = builds[buildKey];
        const thisNode = nodes[buildKey] || (nodes[buildKey] = {
            buildKey,
            dependsOn: new Set(),
            dependencyFor: new Set(),
        });

        for (const depBuildKey of build.dependsOn) {

            // Fail if build references itself.
            if (buildKey === depBuildKey) {
                throw new Error(`Build "${buildKey}" cannot have a dependency to itself`);
            }

            // Fail if the dependency doesn't exist.
            if (!builds[depBuildKey]) {
                throw new Error(`Build "${buildKey}" depends on "${depBuildKey}" which does not exist`);
            }

            const depNode = nodes[depBuildKey] || (nodes[depBuildKey] = {
                buildKey: depBuildKey,
                dependsOn: new Set(),
                dependencyFor: new Set(),
            });

            // Fail if the dependency already depends on this build.
            if (depNode.dependsOn.has(buildKey)) {
                throw new Error(`Builds "${buildKey}" and "${depBuildKey}" have a circular dependency`);
            }

            // Loop through all builds that the dependency depends on.
            for (const deepBuildKey of depNode.dependsOn) {

                // Fail if one of those builds also depends on this build.
                if (nodes[deepBuildKey].dependsOn.has(buildKey)) {
                    throw new Error(`Builds "${buildKey}" and "${depBuildKey}" have a circular dependency`);
                }

                nodes[deepBuildKey].dependencyFor.add(buildKey);
                thisNode.dependsOn.add(deepBuildKey);
            }

            thisNode.dependsOn.add(depBuildKey);
            depNode.dependencyFor.add(buildKey);
        }
    }

    // return nodes;
};
