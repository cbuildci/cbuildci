'use strict';

exports.INSTALLATION_TOKEN_CACHE = Symbol('INSTALLATION_TOKEN_CACHE');
exports.INSTALLATION_TOKEN_CACHE_LAST_PRUNE = Symbol('INSTALLATION_TOKEN_CACHE_LAST_PRUNE');

/**
 * Cache a value by key.
 *
 * @param {object} cache - An object with cached values.
 * @param {string|function} cacheKey - The cache key or a function that returns the key.
 * @param {function} isCachedValueValid - Checks if a cache entry is valid.
 * @param {function} fn - Returns the value to be cached if it was not already cached or the cached value is invalid. May return a promise.
 * @returns {Promise<*>}
 */
exports.getCachedValue = async function getCachedValue(
    cache,
    cacheKey,
    isCachedValueValid,
    fn,
) {
    if (typeof cacheKey === 'function') {
        cacheKey = cacheKey();
    }

    // Check existing cached entry, if one exists.
    if (cache[cacheKey]) {
        // Reuse the token if it is still valid.
        if (isCachedValueValid(cache[cacheKey])) {
            return cache[cacheKey];
        }
        else {
            // Otherwise delete the cached token and get a new one.
            delete cache[cacheKey];
        }
    }

    return cache[cacheKey] = await fn();
};

/**
 * Prune invalid entries from a cache object.
 *
 * @param {object} cache
 * @param {function} isValid
 */
exports.pruneCache = function pruneCache(cache, isValid) {
    for (const [key, value] of Object.entries(cache)) {
        if (!isValid(value, key)) {
            delete cache[key];
        }
    }
};
