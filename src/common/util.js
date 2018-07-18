'use strict';

/**
 * Validate a GitHub user or organization name.
 *
 * @param {string} owner
 * @returns {boolean}
 */
exports.isValidGitHubUser = function isValidGitHubUser(owner) {
    return typeof owner === 'string'
        && owner.length <= 39
        && !!owner.match(/^(?:[a-z0-9](?:-?[a-z0-9]+)*)$/i);
};

/**
 * Validate a GitHub repository name.
 *
 * @param {string} repo
 * @returns {boolean}
 */
exports.isValidGitHubRepo = function isValidGitHubRepo(repo) {
    return typeof repo === 'string'
        && !!repo.match(/^[_\-.a-z0-9]{1,100}$/i);
};

/**
 * Validate a SHA1 string.
 *
 * @param {string} sha
 * @returns {boolean}
 */
exports.isValidSha = function isValidSha(sha) {
    return typeof sha === 'string' && !!sha.match(/^[0-9a-f]{40}$/i);
};

/**
 * Build a repo ID.
 *
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
exports.buildRepoId = function buildRepoId(owner, repo) {
    return `${owner}/${repo}`.toLowerCase();
};

/**
 * Split a repo ID into its parts, or null if it is invalid.
 *
 * @param {string} id
 * @returns {{ owner: string, repo: string }|null}
 */
exports.parseRepoId = function parseRepoId(id) {
    if (typeof id !== 'string') {
        return null;
    }

    const [owner, repo, ...extra] = id.toLowerCase().split('/');

    if (extra.length) {
        return null;
    }

    if (!exports.isValidGitHubUser(owner) || !exports.isValidGitHubRepo(repo)) {
        return null;
    }

    return {
        owner,
        repo,
    };
};

/**
 * Validate a repo ID.
 *
 * @param {string} id
 * @returns {boolean}
 */
exports.isValidRepoId = function isValidRepoId(id) {
    return !!exports.parseRepoId(id);
};

/**
 * Split an execution ID into its parts, or null if it is invalid.
 *
 * @param {string} id
 * @returns {{ sha: string, executionId: string }|null}
 */
exports.parseExecutionId = function parseExecutionId(id) {
    if (typeof id !== 'string') {
        return null;
    }

    const [sha, executionId, ...extra] = id.toLowerCase().split('/');

    if (extra.length) {
        return null;
    }

    if (!exports.isValidSha(sha)
        || typeof executionId !== 'string'
        || !executionId.match(/^[1-9][0-9]{0,3}$/)) {
        return null;
    }

    return {
        sha,
        executionId,
    };
};

/**
 * Split an execution ID into its parts, or null if it is invalid.
 *
 * @param {string} id
 * @returns {{ owner: string, repo: string, sha: string, executionId: string }|null}
 */
exports.parseLongExecutionId = function parseLongExecutionId(id) {
    if (typeof id !== 'string') {
        return null;
    }

    const [owner, repo, sha, executionId, ...extra] = id.toLowerCase().split('/');

    if (extra.length) {
        return null;
    }

    if (!exports.isValidGitHubUser(owner)
        || !exports.isValidGitHubRepo(repo)
        || !exports.isValidSha(sha)
        || typeof executionId !== 'string'
        || !executionId.match(/^[1-9][0-9]{0,3}$/)) {
        return null;
    }

    return {
        owner,
        repo,
        sha,
        executionId,
    };
};

/**
 * Validate an execution ID.
 *
 * @param {string} id
 * @returns {boolean}
 */
exports.isValidExecutionId = function isValidExecutionId(id) {
    return !!exports.parseExecutionId(id);
};

/**
 * Build a lock ID.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {string} commit
 * @returns {string}
 */
exports.buildLockId = function buildLockId(owner, repo, commit) {
    return `${owner}/${repo}/${commit}`.toLowerCase();
};

/**
 * TODO: Is this still needed?
 *
 * @param {string[]} list
 * @param {string} label
 * @returns {boolean}
 */
exports.hasSpecialLabel = function hasSpecialLabel(list, label) {
    return list.length && label
        ? list.includes(String(label).toLowerCase())
        : false;
};

/**
 * Escape text so it can be inserted into a regular expression.
 *
 * @param {string} text
 * @returns {string}
 */
exports.escapeRegExp = function escapeRegExp(text) {
    return text
        .replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')
        .replace('\t', '\\t')
        .replace('\n', '\\n');
};

/**
 * Convert a pattern to a regular expression object, or null if it is invalid.
 *
 * @param {string} val
 * @returns {RegExp|null}
 */
exports.convertToRegex = function convertToRegex(val) {
    const pattern = val.startsWith('/') && val.endsWith('/')
        ? val.substr(1, val.length - 2)
        : `^${val.split('*').map(exports.escapeRegExp).join('.*')}$`;

    try {
        return new RegExp(pattern);
    }
    catch (err) {
        return null;
    }
};

/**
 * Wrap an async function so its result is cached.
 *
 * @param {function} fn
 * @param {object} [options]
 * @param {number|function} [options.getKey]
 * @param {number} [options.expirationMs]
 * @returns {function}
 */
exports.cacheAsyncResult = function cacheAsyncResult(fn, { getKey = null, expirationMs = null } = {}) {
    let cache = new Map();
    const keyType = typeof getKey;

    return async function cachedFn(...args) {
        let key = '';
        if (keyType === 'number') {
            key = args[getKey];
        }
        else if (keyType === 'function') {
            key = getKey(...args);
        }

        const cached = cache.get(key);
        if (cached && (cached.expires === null || cached.expires > Date.now())) {
            return cached.value;
        }

        const value = await fn.apply(this, args);

        cache.set(key, {
            value,
            expires: expirationMs != null
                ? Date.now() + expirationMs
                : null,
        });

        return value;
    };
};
