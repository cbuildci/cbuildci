'use strict';

const chai = require('chai');
const expect = chai.expect;

const v = require('../../../src/common/v');

describe('v', () => {

    it('should have expected exports', () => {
        expect(Object.keys(v).sort()).to.deep.equal([
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
        it('should return function that reduces value using arguments');
    });

    describe('VError', () => {
        it('should create error as expected', () => {
            const err = new v.VError('foobar');
            expect(err.message).to.equal('foobar');
            expect(err.path).to.deep.equal([]);
        });
    });

    describe('top', () => {
        it('should catch error and replace "{}" with prop path if VError');

        it('should not modified message if not VError', () => {
            const err = new Error('{} msg');
            expect(() => v.top(() => {
                throw err;
            })())
                .to.throw(err);
            expect(err.message).to.equal('{} msg');
        });
    });

    describe('mapArray', () => {
        it('should pass value through if not array', () => {
            expect(v.mapArray({})()).to.equal(undefined);
            expect(v.mapArray({})(null)).to.equal(null);
            expect(v.mapArray({})('foobar')).to.equal('foobar');

            const obj = {};
            expect(v.mapArray()(obj)).to.equal(obj);
        });

        it('should validate and map values');

        it('should push index to "path" property of VError', () => {
            const err = new v.VError('{} foobar');
            try {
                v.mapArray(() => {
                    throw err;
                })(['foobar']);
            }
            catch (err) {
                expect(err.path).to.deep.equal([0]);
                return;
            }

            throw new Error('expected to throw error');
        });

        it('should pass-through error if not VError', () => {
            const err = new Error('{} msg');
            expect(() => v.mapArray(() => {
                throw err;
            })(['foobar']))
                .to.throw(err);
        });
    });

    describe('props', () => {
        it('should pass value through if not object', () => {
            expect(v.props({})()).to.equal(undefined);
            expect(v.props({})(null)).to.equal(null);
            expect(v.props({})('foobar')).to.equal('foobar');

            const arr = [];
            expect(v.props({})(arr)).to.equal(arr);
        });

        it('should validate and map props');

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
                expect(err.path).to.deep.equal(['foobar']);
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
                .to.throw(err);
        });
    });

    describe('isRequired', () => {
        it('should throw error if undefined, null or an empty string');

        it('should allow empty string if "allowEmptyString" is set');

        it('should set default if specified and value is undefined', () => {
            expect(v.isRequired({ defaultTo: 5 })())
                .to.equal(5);

            const obj = {};
            expect(v.isRequired({ defaultTo: () => obj })())
                .to.equal(obj);
        });
    });

    describe('isOptional', () => {
        it('should passthrough any value', () => {
            expect(v.isOptional()()).to.equal(undefined);
            expect(v.isOptional()(null)).to.equal(null);

            const obj = {};
            expect(v.isOptional()(obj)).to.equal(obj);
        });

        it('should support setting default if undefined', () => {
            expect(v.isOptional({ defaultTo: 5 })()).to.equal(5);

            const obj = {};
            expect(v.isOptional({ defaultTo: () => obj })()).to.equal(obj);
        });

        it('should support converting null to undefined', () => {
            expect(v.isOptional({ nullToUndefined: true })(null)).to.equal(undefined);
        });
    });

    describe('isString', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isString();
            expect(fn).to.be.a('function');
            expect(fn('')).to.equal('');
            expect(fn('foobar')).to.equal('foobar');

            expect(() => fn())
                .to.not.throw();

            expect(() => fn(null))
                .to.throw('{} must be a string');
            expect(() => fn({}))
                .to.throw('{} must be a string');
        });

        it('should throw error if string is shortern than "min"', () => {
            expect(() => v.isString({ min: 3 })(''))
                .to.throw('{} must have a length of at least 3');

            expect(() => v.isString({ min: 3 })('ab'))
                .to.throw('{} must have a length of at least 3');

            expect(() => v.isString({ min: 3 })('abc'))
                .to.not.throw();

            expect(() => v.isString({ min: 3 })('abcd'))
                .to.not.throw();
        });

        it('should throw error if string starts with string', () => {
            expect(() => v.isString({ notStartsWith: '/' })('/'))
                .to.throw('{} must not start with "/"');

            expect(() => v.isString({ notStartsWith: '/foo' })('/foobar'))
                .to.throw('{} must not start with "/foo"');

            expect(() => v.isString({ notStartsWith: '/foo' })('/'))
                .to.not.throw();
        });

        it('should throw error if string does not starts with string', () => {
            expect(() => v.isString({ startsWith: '/foo' })('/'))
                .to.throw('{} must start with "/foo"');

            expect(() => v.isString({ startsWith: '/' })('foobar'))
                .to.throw('{} must start with "/"');

            expect(() => v.isString({ startsWith: '/' })('/foobar'))
                .to.not.throw();

            expect(() => v.isString({ startsWith: '/foo' })('/foobar'))
                .to.not.throw();
        });

        it('should throw error if string matches pattern', () => {
            expect(() => v.isString({ match: /^foobar$/ })('foo'))
                .to.throw('{} must match the pattern /^foobar$/');

            expect(() => v.isString({ match: /^foobar$/ })('foobar'))
                .to.not.throw();
        });
    });

    describe('isOneOf', () => {
        it('should return function that throws error if value is not in the speified list');
    });

    describe('isNumber', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isNumber();
            expect(fn).to.be.a('function');
            expect(fn(Number.MIN_SAFE_INTEGER)).to.equal(Number.MIN_SAFE_INTEGER);
            expect(fn(-100)).to.equal(-100);
            expect(fn(0)).to.equal(0);
            expect(fn(5)).to.equal(5);
            expect(fn(100)).to.equal(100);
            expect(fn(Number.MAX_SAFE_INTEGER)).to.equal(Number.MAX_SAFE_INTEGER);

            expect(() => fn())
                .to.not.throw();

            expect(() => fn(null))
                .to.throw('{} must be a number');
            expect(() => fn(-Infinity))
                .to.throw('{} must be a number');
            expect(() => fn(Infinity))
                .to.throw('{} must be a number');
            expect(() => fn(NaN))
                .to.throw('{} must be a number');
            expect(() => fn(null))
                .to.throw('{} must be a number');
            expect(() => fn([]))
                .to.throw('{} must be a number');
            expect(() => fn('5'))
                .to.throw('{} must be a number');
        });

        it('should throw error if number has decimal and onlyInteger is true', () => {
            expect(() => v.isNumber({ onlyInteger: true })(5))
                .to.not.throw();

            expect(() => v.isNumber({ onlyInteger: true })(5.5))
                .to.throw('{} must be an integer');

            expect(() => v.isNumber({ onlyInteger: true })(-5.5))
                .to.throw('{} must be an integer');
        });

        it('should throw error if "min" and/or "max" are exceeded', () => {
            expect(() => v.isNumber({ min: 5 })(4))
                .to.throw('{} must not be less than 5');

            expect(() => v.isNumber({ min: 5 })(5))
                .to.not.throw();

            expect(() => v.isNumber({ min: 5 })(6))
                .to.not.throw();

            expect(() => v.isNumber({ max: 5 })(6))
                .to.throw('{} must not be greater than 5');

            expect(() => v.isNumber({ max: 5 })(5))
                .to.not.throw();

            expect(() => v.isNumber({ max: 5 })(4))
                .to.not.throw();

            expect(() => v.isNumber({ min: 5, max: 7 })(4))
                .to.throw('{} must not be less than 5');

            expect(() => v.isNumber({ min: 5, max: 7 })(8))
                .to.throw('{} must not be greater than 7');

            expect(() => v.isNumber({ min: 5, max: 7 })(5))
                .to.not.throw();

            expect(() => v.isNumber({ min: 5, max: 7 })(6))
                .to.not.throw();

            expect(() => v.isNumber({ min: 5, max: 7 })(7))
                .to.not.throw();
        });
    });

    describe('isObject', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isObject();
            const obj = {};
            expect(fn).to.be.a('function');
            expect(fn(obj)).to.equal(obj);

            expect(() => fn())
                .to.not.throw();

            expect(() => fn(null))
                .to.throw('{} must be an object');
            expect(() => fn([]))
                .to.throw('{} must be an object');
            expect(() => fn(() => {}))
                .to.throw('{} must be an object');
        });

        it('should throw error if object has less than "minProps"', () => {
            const fn1 = v.isObject({ minProps: 1 });

            expect(() => fn1({}))
                .to.throw('{} must have at least 1 property');

            const fn2 = v.isObject({ minProps: 2 });

            expect(() => fn2({}))
                .to.throw('{} must have at least 2 properties');

            expect(() => fn2({ a: 1 }))
                .to.throw('{} must have at least 2 properties');

            expect(() => fn2({ a: 1, b: 2 }))
                .to.not.throw();

            expect(() => fn2({ a: 1, b: 2, c: 3 }))
                .to.not.throw();
        });
    });

    describe('isArray', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isArray();
            const arr = [];
            expect(fn).to.be.a('function');
            expect(fn(arr)).to.equal(arr);

            expect(() => fn())
                .to.not.throw();

            expect(() => fn(null))
                .to.throw('{} must be an array');
            expect(() => fn({}))
                .to.throw('{} must be an array');
        });

        it('should throw an error if "min" and/or "max" are exceeded', () => {
            expect(() => v.isArray({ min: 5 })([1, 2, 3, 4]))
                .to.throw('{} must not have a length less than 5');

            expect(() => v.isArray({ min: 5 })([1, 2, 3, 4, 5]))
                .to.not.throw();

            expect(() => v.isArray({ min: 5 })([1, 2, 3, 4, 6]))
                .to.not.throw();

            expect(() => v.isArray({ max: 5 })([1, 2, 3, 4, 5, 6]))
                .to.throw('{} must not have a length greater than 5');

            expect(() => v.isArray({ max: 5 })([1, 2, 3, 4, 5]))
                .to.not.throw();

            expect(() => v.isArray({ max: 5 })([1, 2, 3, 4]))
                .to.not.throw();

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4]))
                .to.throw('{} must not have a length less than 5');

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5, 6, 7, 8]))
                .to.throw('{} must not have a length greater than 7');

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5]))
                .to.not.throw();

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5, 6]))
                .to.not.throw();

            expect(() => v.isArray({ min: 5, max: 7 })([1, 2, 3, 4, 5, 6, 7]))
                .to.not.throw();
        });
    });

    describe('isBoolean', () => {
        it('should return function that throws error if value is invalid', () => {
            const fn = v.isBoolean();
            expect(fn).to.be.a('function');
            expect(fn(true)).to.equal(true);
            expect(fn(false)).to.equal(false);

            expect(() => fn())
                .to.not.throw();

            expect(() => fn(null))
                .to.throw('{} must be a boolean');
            expect(() => fn({}))
                .to.throw('{} must be a boolean');
        });
    });
});
