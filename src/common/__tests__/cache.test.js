'use strict';

const cacheUtil = require('../../../src/common/cache');

describe('cache', () => {

    it('should have expected exports', () => {
        expect(Object.keys(cacheUtil).sort()).toEqual([
            'INSTALLATION_TOKEN_CACHE',
            'INSTALLATION_TOKEN_CACHE_LAST_PRUNE',
            'getCachedValue',
            'pruneCache',
        ].sort());
    });

    describe('getCachedValue', () => {
        it('should get value and store it in the cache', async () => {
            const cache = {};

            const isValid = jest.fn((v) => v === 400);

            const getValue = jest.fn()
                .mockReturnValueOnce(400)
                .mockReturnValueOnce(500)
                .mockReturnValue(600);

            // Store a value.
            expect(
                await cacheUtil.getCachedValue(
                    cache,
                    'foo',
                    isValid,
                    getValue,
                ),
            ).toBe(400);

            expect(isValid.mock.calls.length).toBe(0);
            expect(getValue.mock.calls.length).toBe(1);
            expect(getValue.mock.calls[0].length).toBe(0);

            expect(cache)
                .toEqual({
                    foo: 400,
                });

            // Store a different value.
            expect(
                await cacheUtil.getCachedValue(
                    cache,
                    'bar',
                    isValid,
                    getValue,
                ),
            ).toBe(500);

            expect(isValid.mock.calls.length).toBe(0);
            expect(getValue.mock.calls.length).toBe(2);
            expect(getValue.mock.calls[1].length).toBe(0);

            expect(cache)
                .toEqual({
                    foo: 400,
                    bar: 500,
                });

            // Get the first value, which should be cached.
            expect(
                await cacheUtil.getCachedValue(
                    cache,
                    'foo',
                    isValid,
                    getValue,
                ),
            ).toBe(400);

            expect(isValid.mock.calls.length).toBe(1);
            expect(isValid.mock.calls[0]).toEqual([400]);
            expect(getValue.mock.calls.length).toBe(2);

            // Get the first value, which should no longer be valid.
            expect(
                await cacheUtil.getCachedValue(
                    cache,
                    'bar',
                    isValid,
                    getValue,
                ),
            ).toBe(600);

            expect(isValid.mock.calls.length).toBe(2);
            expect(isValid.mock.calls[1]).toEqual([500]);
            expect(getValue.mock.calls.length).toBe(3);
            expect(getValue.mock.calls[2].length).toBe(0);

            expect(cache)
                .toEqual({
                    foo: 400,
                    bar: 600,
                });
        });

        it('should allow cacheKey to be a function', async () => {
            const cache = {};
            const isValid = jest.fn();
            const cacheKey = jest.fn()
                .mockReturnValue('foo');
            const getValue = jest.fn()
                .mockReturnValue(400);

            // Store a value.
            expect(
                await cacheUtil.getCachedValue(
                    cache,
                    cacheKey,
                    isValid,
                    getValue,
                ),
            ).toBe(400);

            expect(isValid.mock.calls.length).toBe(0);
            expect(getValue.mock.calls.length).toBe(1);
            expect(getValue.mock.calls[0].length).toBe(0);
            expect(cacheKey.mock.calls.length).toBe(1);
            expect(cacheKey.mock.calls[0].length).toBe(0);

            expect(cache)
                .toEqual({
                    foo: 400,
                });
        });
    });

    describe('pruneCache', () => {
        it('should remove that are invalid', () => {
            const cache = {
                a: 100,
                b: 200,
                c: 300,
            };

            const result = {
                a: 100,
                b: 200,
            };

            cacheUtil.pruneCache(
                cache,
                (v) => v <= 200,
            );

            expect(cache).toEqual(result);
        });
    });
});
