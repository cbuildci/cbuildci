'use strict';

/**
 * Build a repo ID.
 *
 * @param {string} host
 * @param {string} owner
 * @param {string} repo
 * @returns {string}
 */
exports.buildRepoId = function buildRepoId(host, owner, repo) {
    return `${host}/${owner}/${repo}`.toLowerCase();
};

/**
 * Split a repo ID into its parts, or null if it is invalid.
 *
 * @param {string} id
 * @returns {{ host: string, owner: string, repo: string }|null}
 */
exports.parseRepoId = function parseRepoId(id) {
    const match = typeof id === 'string' && id.toLowerCase().match(/^([^/ ]+)\/([^/ ]+)\/([^/ ]+)$/);
    return match ? {
        host: match[1],
        owner: match[2],
        repo: match[3],
    } : null;
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
 * Validate an execution ID.
 *
 * @param {string} id
 * @returns {boolean}
 */
exports.isValidExecutionId = function isValidExecutionId(id) {
    return typeof id === 'string' && !!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
};

/**
 * Build a lock ID.
 *
 * @param {string} host
 * @param {string} owner
 * @param {string} repo
 * @param {string} commit
 * @returns {string}
 */
exports.buildLockId = function buildLockId(host, owner, repo, commit) {
    return `${host}/${owner}/${repo}/${commit}`.toLowerCase();
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
