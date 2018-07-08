'use strict';

// TODO: Eventually replace with third-party schema validation library.

class VError extends Error {
    constructor(message) {
        super();
        this.message = message;
        this.path = [];
    }
}

module.exports = v;
v.VError = VError;

function v(...args) {
    return (value) => {
        for (let i = 0; i < args.length; i++) {
            value = args[i](value);
        }
        return value;
    };
}

// eslint-disable-next-line jsdoc/require-param
/**
 * @returns {function}
 */
v.top = function top(...fns) {
    const fn = v(...fns);
    return (value) => {
        try {
            return fn(value);
        }
        catch (err) {
            if (err instanceof VError) {
                err.message = err.message.replace('{}', err.path.join('.'));
            }
            throw err;
        }
    };
};

v.mapArray = function mapArray(...args) {
    const fn = v(...args);
    return (value) => {
        let ret = value;
        if (value && Array.isArray(value)) {
            ret = value.slice(0);

            for (let i = 0; i < value.length; i++) {
                try {
                    ret[i] = fn(value[i]);
                }
                catch (err) {
                    if (err instanceof VError) {
                        err.path.unshift(i);
                    }
                    throw err;
                }
            }
        }
        return ret;
    };
};

v.props = function props(obj) {
    const entries = Object.entries(obj);
    return (value) => {
        let ret = value;
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            ret = {};

            for (const [key, fn] of entries) {
                try {
                    const validatedValue = fn(value[key]);
                    if (validatedValue !== undefined) {
                        ret[key] = validatedValue;
                    }
                }
                catch (err) {
                    if (err instanceof VError) {
                        err.path.unshift(key);
                    }
                    throw err;
                }
            }
        }
        return ret;
    };
};

v.isRequired = function isRequired({ defaultTo = undefined, allowEmptyString = false } = {}) {
    const isFunc = typeof defaultTo === 'function';
    return (value) => {
        if (defaultTo !== undefined && value === undefined) {
            value = isFunc ? defaultTo() : defaultTo;
        }

        if (value == null || !allowEmptyString && value === '') {
            throw new VError('{} must have a value');
        }

        return value;
    };
};

v.isOptional = function isOptional({ defaultTo = undefined, nullToUndefined = false } = {}) {
    const isFunc = typeof defaultTo === 'function';
    return (value) => {
        if (value === null && nullToUndefined) {
            value = undefined;
        }

        if (defaultTo !== undefined && value === undefined) {
            value = isFunc ? defaultTo() : defaultTo;
        }

        return value;
    };
};

v.isString = function isString({ min = null, notStartsWith = null, startsWith = null, match = null } = {}) {
    return (value) => {
        if (value !== undefined) {
            if (typeof value !== 'string') {
                throw new VError('{} must be a string');
            }
            if (min != null && value.length < min) {
                throw new VError(`{} must have a length of at least ${min}`);
            }
            if (typeof startsWith === 'string' && !value.startsWith(startsWith)) {
                throw new VError(`{} must start with ${JSON.stringify(startsWith)}`);
            }
            if (typeof notStartsWith === 'string' && value.startsWith(notStartsWith)) {
                throw new VError(`{} must not start with ${JSON.stringify(notStartsWith)}`);
            }
            if (match != null && !value.match(match)) {
                throw new VError(`{} must match the pattern /${match.source}/`);
            }
        }
        return value;
    };
};

v.isOneOf = function isOneOf(values) {
    const valuesList = values.map((v) => JSON.stringify(v)).join(', ');
    return (value) => {
        if (value !== undefined && !values.includes(value)) {
            throw new VError(`{} must be one of the following values: ${valuesList}`);
        }
        return value;
    };
};

v.isNumber = function isNumber({ min = null, max = null, onlyInteger = false } = {}) {
    return (value) => {
        if (value !== undefined) {
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                throw new VError('{} must be a number');
            }
            if (min != null && value < min) {
                throw new VError(`{} must not be less than ${min}`);
            }
            if (max != null && value > max) {
                throw new VError(`{} must not be greater than ${max}`);
            }
            if (onlyInteger && value % 1 !== 0) {
                throw new VError('{} must be an integer');
            }
        }
        return value;
    };
};

v.isObject = function isObject({ minProps = null } = {}) {
    return (value) => {
        if (value !== undefined) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                throw new VError('{} must be an object');
            }
            if (minProps != null && Object.keys(value).length < minProps) {
                throw new VError(`{} must have at least ${minProps} ${minProps === 1 ? 'property' : 'properties'}`);
            }
        }
        return value;
    };
};

v.isArray = function isArray({ min = null, max = null } = {}) {
    return (value) => {
        if (value !== undefined) {
            if (!Array.isArray(value)) {
                throw new VError('{} must be an array');
            }
            if (min != null && value.length < min) {
                throw new VError(`{} must not have a length less than ${min}`);
            }
            if (max != null && value.length > max) {
                throw new VError(`{} must not have a length greater than ${max}`);
            }
        }
        return value;
    };
};

v.isBoolean = function isBoolean() {
    return (value) => {
        if (value !== undefined && typeof value !== 'boolean') {
            throw new VError('{} must be a boolean');
        }
        return value;
    };
};
