'use strict';

const v = require('../../../src/common/v');

describe('v', () => {

    it('should have expected exports', () => {
        expect(Object.keys(v).sort()).toEqual([
            'VError',
            'isArray',
            'isBoolean',
            'isNumber',
            'isObject',
            'isOneOf',
            'isOptional',
            'isRequired',
            'isString',
            'mapArray',
            'props',
            'top',
        ].sort());
    });

    describe('v', () => {
        it.skip('should return function that reduces value using arguments', () => {
            // TODO
        });
    });

    describe('VError', () => {
        it('should create error as expected', () => {
            const err = new v.VError('foobar');
            expect(err.message).toBe('foobar');
            expect(err.path).toEqual([]);
        });
    });

    describe('top', () => {
        it.skip('should catch error and replace "{}" with prop path if VError', () => {
            // TODO
        });

        it('should not modified message if not VError', () => {
            const err = new Error('{} msg');
            expect(() => v.top(() => {
                throw err;
            })())
                .toThrowError(err);
            expect(err.message).toBe('{} msg');
        });
    });

    describe('mapArray', () => {
        it('should pass value through if not array', () => {
            expect(v.mapArray({})()).toBeUndefined();
            expect(v.mapArray({})(null)).toBeNull();
            expect(v.mapArray({})('foobar')).toBe('foobar');

            const obj = {};
            expect(v.mapArray()(obj)).toBe(obj);
        });

        it.skip('should validate and map values', () => {
            // TODO
        });

        it('should push index to "path" property of VError', () => {
            const err = new v.VError('{} foobar');
            try {
                v.mapArray(() => {
                    throw err;
                })(['foobar']);
            }
            catch (err) {
                expect(err.path).toEqual([0]);
                return;
            }

            throw new Error('expected to throw error');
        });

        it('should pass-through error if not VError', () => {
            const err = new Error('{} msg');
            expect(() => v.mapArray(() => {
                throw err;
            })(['foobar']))
                .toThrowError(err);
        });
    });

    describe('props', () => {
        it('should pass value through if not object', () => {
            expect(v.props({})()).toBeUndefined();
            expect(v.props({})(null)).toBeNull();
            expect(v.props({})('foobar')).toBe('foobar');

            const arr = [];
            expect(v.props({})(arr)).toBe(arr);
        });

        it.skip('should validate and map props', () => {
            // TODO
        });

        it('should push index to "path" property of VError', () => {
            const err = new v.VError('{} foobar');
            try {
                v.props({
                    foobar: () => {
                        throw err;
                    },
                })({
                    foobar: 1,
                });
            }
            catch (err) {
                expect(err.path).toEqual(['foobar']);
                return;
            }

            throw new Error('expected to throw error');
        });

        it('should pass-through error if not VError', () => {
            const err = new Error('{} msg');
            expect(() => v.props({
                foobar: () => {
                    throw err;
                },
            })({
                foobar: 1,
            }))
                .toThrowError(err);
        });
    });

    describe('isRequired', () => {
        it.skip('should throw error if undefined, null or an empty string', () => {
            // TODO
        });

        it.skip('should allow empty string if "allowEmptyString" is set', () => {
            // TODO
        });

        it('should set default if specified and value is undefined', () => {
            expect(v.isRequired({ defaultTo: 5 })())
                .toBe(5);

            const obj = {};
            expect(v.isRequired({ defaultTo: () => obj })())
                .toBe(obj);
        });
    });

    describe('isOptional', () => {
        it('should passthrough any value', () => {
            expect(v.isOptional()()).toBeUndefined();
            expect(v.isOptional()(null)).toBeNull();

            const obj = {};
            expect(v.isOptional()(obj)).toBe(obj);
        });

        it('should support setting default if undefined', () => {
            expect(v.isOptional({ defaultTo: 5 })()).toBe(5);

            const obj = {};
            expect(v.isOptional({ defaultTo: () => obj })()).toBe(obj);
        });

        it('should support converting null to undefined', () => {
            expect(v.isOptional({ nullToUndefined: true })(null)).toBeUndefined();
        });
    });

    describe('isString', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isString();
            expect(typeof fn).toBe('function');
            expect(fn('')).toBe('');
            expect(fn('foobar')).toBe('foobar');

            expect(() => fn())
                .not.toThrowError();

            expect(() => fn(null))
                .toThrowError('{} must be a string');
            expect(() => fn({}))
                .toThrowError('{} must be a string');
        });

        it('should throw error if string is shortern than "min"', () => {
            expect(() => v.isString({ min: 3 })(''))
                .toThrowError('{} must have a length of at least 3');

            expect(() => v.isString({ min: 3 })('ab'))
                .toThrowError('{} must have a length of at least 3');

            expect(() => v.isString({ min: 3 })('abc'))
                .not.toThrowError();

            expect(() => v.isString({ min: 3 })('abcd'))
                .not.toThrowError();
        });

        it('should throw error if string starts with string', () => {
            expect(() => v.isString({ notStartsWith: '/' })('/'))
                .toThrowError('{} must not start with "/"');

            expect(() => v.isString({ notStartsWith: '/foo' })('/foobar'))
                .toThrowError('{} must not start with "/foo"');

            expect(() => v.isString({ notStartsWith: '/foo' })('/'))
                .not.toThrowError();
        });

        it('should throw error if string does not starts with string', () => {
            expect(() => v.isString({ startsWith: '/foo' })('/'))
                .toThrowError('{} must start with "/foo"');

            expect(() => v.isString({ startsWith: '/' })('foobar'))
                .toThrowError('{} must start with "/"');

            expect(() => v.isString({ startsWith: '/' })('/foobar'))
                .not.toThrowError();

            expect(() => v.isString({ startsWith: '/foo' })('/foobar'))
                .not.toThrowError();
        });

        it('should throw error if string matches pattern', () => {
            expect(() => v.isString({ match: /^foobar$/ })('foo'))
                .toThrowError('{} must match the pattern /^foobar$/');

            expect(() => v.isString({ match: /^foobar$/ })('foobar'))
                .not.toThrowError();
        });
    });

    describe('isOneOf', () => {
        it.skip('should return function that throws error if value is not in the speified list', () => {
            // TODO
        });
    });

    describe('isNumber', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isNumber();
            expect(typeof fn).toBe('function');
            expect(fn(Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
            expect(fn(-100)).toBe(-100);
            expect(fn(0)).toBe(0);
            expect(fn(5)).toBe(5);
            expect(fn(100)).toBe(100);
            expect(fn(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);

            expect(() => fn())
                .not.toThrowError();

            expect(() => fn(null))
                .toThrowError('{} must be a number');
            expect(() => fn(-Infinity))
                .toThrowError('{} must be a number');
            expect(() => fn(Infinity))
                .toThrowError('{} must be a number');
            expect(() => fn(NaN))
                .toThrowError('{} must be a number');
            expect(() => fn(null))
                .toThrowError('{} must be a number');
            expect(() => fn([]))
                .toThrowError('{} must be a number');
            expect(() => fn('5'))
                .toThrowError('{} must be a number');
        });

        it('should throw error if number has decimal and onlyInteger is true', () => {
            expect(() => v.isNumber({ onlyInteger: true })(5))
                .not.toThrowError();

            expect(() => v.isNumber({ onlyInteger: true })(5.5))
                .toThrowError('{} must be an integer');

            expect(() => v.isNumber({ onlyInteger: true })(-5.5))
                .toThrowError('{} must be an integer');
        });

        it('should throw error if "min" and/or "max" are exceeded', () => {
            expect(() => v.isNumber({ min: 5 })(4))
                .toThrowError('{} must not be less than 5');

            expect(() => v.isNumber({ min: 5 })(5))
                .not.toThrowError();

            expect(() => v.isNumber({ min: 5 })(6))
                .not.toThrowError();

            expect(() => v.isNumber({ max: 5 })(6))
                .toThrowError('{} must not be greater than 5');

            expect(() => v.isNumber({ max: 5 })(5))
                .not.toThrowError();

            expect(() => v.isNumber({ max: 5 })(4))
                .not.toThrowError();

            expect(() => v.isNumber({ min: 5, max: 7 })(4))
                .toThrowError('{} must not be less than 5');

            expect(() => v.isNumber({ min: 5, max: 7 })(8))
                .toThrowError('{} must not be greater than 7');

            expect(() => v.isNumber({ min: 5, max: 7 })(5))
                .not.toThrowError();

            expect(() => v.isNumber({ min: 5, max: 7 })(6))
                .not.toThrowError();

            expect(() => v.isNumber({ min: 5, max: 7 })(7))
                .not.toThrowError();
        });
    });

    describe('isObject', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isObject();
            const obj = {};
            expect(typeof fn).toBe('function');
            expect(fn(obj)).toBe(obj);

            expect(() => fn())
                .not.toThrowError();

            expect(() => fn(null)).toThrowError('{} must be an object');
            expect(() => fn([])).toThrowError('{} must be an object');
            expect(() => fn(() => {})).toThrowError('{} must be an object');
        });

        it('should throw error if object has less than "minProps"', () => {
            const fn1 = v.isObject({ minProps: 1 });

            expect(() => fn1({}))
                .toThrowError('{} must have at least 1 property');

            const fn2 = v.isObject({ minProps: 2 });

            expect(() => fn2({}))
                .toThrowError('{} must have at least 2 properties');

            expect(() => fn2({ a: 1 }))
                .toThrowError('{} must have at least 2 properties');

            expect(() => fn2({ a: 1, b: 2 }))
                .not.toThrowError();

            expect(() => fn2({ a: 1, b: 2, c: 3 }))
                .not.toThrowError();
        });
    });

    describe('isArray', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isArray();
            const arr = [];
            expect(typeof fn).toBe('function');
            expect(fn(arr)).toBe(arr);

            expect(() => fn())
                .not.toThrowError();

            expect(() => fn(null))
                .toThrowError('{} must be an array');
            expect(() => fn({}))
                .toThrowError('{} must be an array');
        });

        it('should throw an error if "min" and/or "max" are exceeded', () => {
            expect(() => v.isArray({ min: 5 })([1, 2, 3, 4]))
                .toThrowError('{} must not have a length less than 5');

            expect(() => v.isArray({ min: 5 })([1, 2, 3, 4, 5]))
                .not.toThrowError();

            expect(() => v.isArray({ min: 5 })([1, 2, 3, 4, 6]))
                .not.toThrowError();

            expect(() => v.isArray({ max: 5 })([1, 2, 3, 4, 5, 6]))
                .toThrowError('{} must not have a length greater than 5');

            expect(() => v.isArray({ max: 5 })([1, 2, 3, 4, 5]))
                .not.toThrowError();

            expect(() => v.isArray({ max: 5 })([1, 2, 3, 4]))
                .not.toThrowError();

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4]))
                .toThrowError('{} must not have a length less than 5');

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5, 6, 7, 8]))
                .toThrowError('{} must not have a length greater than 7');

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5]))
                .not.toThrowError();

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5, 6]))
                .not.toThrowError();

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5, 6, 7]))
                .not.toThrowError();
        });
    });

    describe('isBoolean', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isBoolean();
            expect(typeof fn).toBe('function');
            expect(fn(true)).toBe(true);
            expect(fn(false)).toBe(false);

            expect(() => fn()).not.toThrowError();
            expect(() => fn(null)).toThrowError('{} must be a boolean');
            expect(() => fn({})).toThrowError('{} must be a boolean');
        });
    });
});
