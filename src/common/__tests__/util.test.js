'use strict';

const util = require('../../../src/common/util');

describe('util', () => {

    it('should have expected exports', () => {
        expect(Object.keys(util).sort()).toEqual([
            'isValidGitHubUser',
            'isValidGitHubRepo',
            'isValidSha',
            'buildRepoId',
            'parseRepoId',
            'isValidRepoId',
            'buildExecutionId',
            'parseExecutionId',
            'parseLongExecutionId',
            'isValidExecutionId',
            'buildLockId',
            'hasSpecialLabel',
            'escapeRegExp',
            'convertToRegex',
            'cacheAsyncResult',
            'toEpochTime',
            'toISODateString',
        ].sort());
    });

    describe('isValidGitHubUser', () => {
        it('should return true for valid user names', () => {
            expect(util.isValidGitHubUser('a')).toBe(true);
            expect(util.isValidGitHubUser('0')).toBe(true);
            expect(util.isValidGitHubUser('a'.repeat(39))).toBe(true);
            expect(util.isValidGitHubUser('a-1-2-d')).toBe(true);
            expect(util.isValidGitHubUser('abc-1def-2344-daef')).toBe(true);
        });

        it('should return false for invalid user names', () => {
            expect(util.isValidGitHubUser('-')).toBe(false);
            expect(util.isValidGitHubUser('-a')).toBe(false);
            expect(util.isValidGitHubUser('-a')).toBe(false);
            expect(util.isValidGitHubUser('-a-')).toBe(false);
            expect(util.isValidGitHubUser('a--b')).toBe(false);
            expect(util.isValidGitHubUser('a'.repeat(40))).toBe(false);
        });
    });

    describe('isValidSha', () => {
        it('should return true for valid SHAs', () => {
            expect(util.isValidSha('204f627a1d310e50725d3a7fa6a7bacc65a3cc89'))
                .toBe(true);

            expect(util.isValidSha('204F627A1D310E50725D3A7FA6A7BACC65A3CC89'))
                .toBe(true);
        });

        it('should return false for invalid SHAs', () => {
            expect(util.isValidSha('204f627a1d310e50725d3a7fa6a7bacc65a3cc8'))
                .toBe(false);

            expect(util.isValidSha('204F627A1D310E50725D3A7FA6A7BACC65A3CC89a'))
                .toBe(false);
        });
    });

    describe('buildRepoId', () => {
        it('should produce the expected id', () => {
            expect(util.buildRepoId('USER', 'rePO'))
                .toBe('user/repo');
        });
    });

    describe('parseRepoId', () => {
        it('should produce the expected values', () => {
            expect(util.parseRepoId('USeR/rePO'))
                .toEqual({
                    owner: 'user',
                    repo: 'repo',
                });
        });
    });

    describe('isValidRepoId', () => {
        it('should return true for valid IDs', () => {
            expect(util.isValidRepoId('user/repo')).toBe(true);
            expect(util.isValidRepoId('USER/repo')).toBe(true);
            expect(util.isValidRepoId('user/REPO')).toBe(true);
        });

        it('should return false for invalid IDs', () => {
            expect(util.isValidRepoId(null)).toBe(false);
            expect(util.isValidRepoId('')).toBe(false);
            expect(util.isValidRepoId('hst')).toBe(false);
            expect(util.isValidRepoId('hst/user/repo')).toBe(false);
            expect(util.isValidRepoId('https://hst/user/repo/')).toBe(false);
            expect(util.isValidRepoId('http://hst/user/repo/')).toBe(false);
        });
    });

    describe('buildExecutionId', () => {
        it('should return execution ID', () => {
            expect(util.buildExecutionId(
                'ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89',
                5,
            )).toBe('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/0005');

            expect(util.buildExecutionId(
                'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                50,
            )).toBe('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/0050');

            expect(util.buildExecutionId(
                'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                500,
            )).toBe('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/0500');

            expect(util.buildExecutionId(
                'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                5000,
            )).toBe('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/5000');
        });
    });

    describe('parseExecutionId', () => {
        it('should produce the expected values', () => {
            expect(util.parseExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89/0005'))
                .toEqual({
                    commit: 'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionNum: 5,
                });

            expect(util.parseExecutionId('204f627a1d310e50725d3a7fa6a7bacc65a3cc89/9999'))
                .toEqual({
                    commit: '204f627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionNum: 9999,
                });
        });

        it('should return null or invalid values', () => {
            expect(util.parseExecutionId(null)).toBeNull();
            expect(util.parseExecutionId('')).toBeNull();
            expect(util.parseExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5')).toBeNull();
            expect(util.parseExecutionId('204f627a1d310e50725d3a7fa6a7bacc65a3cc89')).toBeNull();
            expect(util.parseExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5/5')).toBeNull();
        });
    });

    describe('parseLongExecutionId', () => {
        it('should produce the expected values for valid execution IDs', () => {
            expect(util.parseLongExecutionId('USeR/rePO/ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89/0005'))
                .toEqual({
                    owner: 'user',
                    repo: 'repo',
                    commit: 'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionNum: 5,
                });

            expect(util.parseLongExecutionId('USeR/rePO/204f627a1d310e50725d3a7fa6a7bacc65a3cc89/9999'))
                .toEqual({
                    owner: 'user',
                    repo: 'repo',
                    commit: '204f627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionNum: 9999,
                });
        });

        it('should return null or invalid values', () => {
            expect(util.parseLongExecutionId(null)).toBeNull();
            expect(util.parseLongExecutionId('')).toBeNull();
            expect(util.parseLongExecutionId('USeR/rePO/ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5')).toBeNull();
            expect(util.parseLongExecutionId('USeR/rePO/204f627a1d310e50725d3a7fa6a7bacc65a3cc89')).toBeNull();
            expect(util.parseLongExecutionId('USeR/rePO/ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5/5')).toBeNull();
        });
    });

    describe('isValidExecutionId', () => {
        it('should return true for valid execution IDs', () => {
            expect(util.isValidExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89/0001')).toBe(true);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/9999')).toBe(true);
        });

        it('should return false for invalid IDs', () => {
            expect(util.isValidExecutionId(null)).toBe(false);
            expect(util.isValidExecutionId('')).toBe(false);
            expect(util.isValidExecutionId('0')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/0')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/1')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/01')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/001')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/10000')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/99999')).toBe(false);
            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/99999')).toBe(false);
        });
    });

    describe('buildLockId', () => {
        it('should produce the expected id', () => {
            expect(util.buildLockId('USER', 'rePO', 'coMMit')).toBe('user/repo/commit');
        });
    });

    describe('hasSpecialLabel', () => {
        it('should return true if contains label', () => {
            expect(util.hasSpecialLabel(['foobar'], 'foobar')).toBe(true);
            expect(util.hasSpecialLabel(['foobar', 'foo', 'bar'], 'foobar')).toBe(true);
            expect(util.hasSpecialLabel(['foobar'], 'FOOBAR')).toBe(true);
        });

        it('should return false if not contains label', () => {
            expect(util.hasSpecialLabel([], 'foobar')).toBe(false);
            expect(util.hasSpecialLabel(['xfoobar', 'foobarx'], 'foobar')).toBe(false);
            expect(util.hasSpecialLabel(['null'], null)).toBe(false);
            expect(util.hasSpecialLabel(['undefined'], undefined)).toBe(false);
        });
    });

    describe('escapeRegExp', () => {
        it('should escape characters', () => {
            const chars = '-[]{}()*+?.,\\^$|#'.split('');

            for (const char of chars) {
                expect(util.escapeRegExp(char)).toBe(`\\${char}`);
            }

            expect(util.escapeRegExp(chars.join(''))).toBe(chars.map((v) => `\\${v}`).join(''));
            expect(util.escapeRegExp('\n')).toBe('\\n');
            expect(util.escapeRegExp('\t')).toBe('\\t');

            // Check that the pattern would match the list of characters above.
            expect(!!chars.join('').match(new RegExp(`^${util.escapeRegExp(chars.join(''))}$`))).toBe(true);
        });
    });

    describe('convertToRegex', () => {
        it('should support glob pattern', () => {
            const re = util.convertToRegex('fo*bar');
            expect(re).toBeInstanceOf(RegExp);
            expect(re.source).toBe('^fo.*bar$');
            expect(re.flags).toBe('');

            expect(util.convertToRegex('foobar').source).toBe('^foobar$');

            const chars = '-[]{}()+?.,\\^$|#'.split('');

            for (const char of chars) {
                expect(util.convertToRegex(`foo${char}bar`).source).toBe(`^foo\\${char}bar$`);
            }

            expect(util.convertToRegex('fo*ba*r').source).toBe('^fo.*ba.*r$');
            expect(util.convertToRegex('*fo**r*').source).toBe('^.*fo.*.*r.*$');
        });

        it('should be same regex if wrapped in forward slashes', () => {
            const re = util.convertToRegex('/^foo$/');
            expect(re).toBeInstanceOf(RegExp);
            expect(re.source).toBe('^foo$');
            expect(re.flags).toBe('');
        });

        it('should return null if invalid pattern', () => {
            expect(util.convertToRegex('/+/')).toBeNull();
        });
    });

    describe('cacheAsyncResult', () => {
        it('should return a function that is a promise', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult(() => `foo${++executions}`);

            expect(typeof fn).toBe('function');

            expect(await fn()).toBe('foo1');
            expect(executions).toBe(1);

            expect(await fn()).toBe('foo1');
            expect(executions).toBe(1);
        });

        it('should support numeric getKey to determine cache key', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult((v) => `${v}${++executions}`, { getKey: 0 });

            expect(await fn('a')).toBe('a1');
            expect(executions).toBe(1);

            expect(await fn('a')).toBe('a1');
            expect(executions).toBe(1);

            expect(await fn('b')).toBe('b2');
            expect(executions).toBe(2);

            expect(await fn('b')).toBe('b2');
            expect(executions).toBe(2);

            expect(await fn('a')).toBe('a1');
            expect(executions).toBe(2);
        });

        it('should support function getKey to determine cache key', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult((v) => `${v}${++executions}`, { getKey: (a, b) => b });

            expect(await fn('a', 'alpha')).toBe('a1');
            expect(executions).toBe(1);

            expect(await fn('a', 'alpha')).toBe('a1');
            expect(executions).toBe(1);

            expect(await fn('foo', 'alpha')).toBe('a1');
            expect(executions).toBe(1);

            expect(await fn('a', 'beta')).toBe('a2');
            expect(executions).toBe(2);

            expect(await fn('a', 'beta')).toBe('a2');
            expect(executions).toBe(2);

            expect(await fn('a', 'alpha')).toBe('a1');
            expect(executions).toBe(2);
        });

        it('should support expiration', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult(
                (v) => `${v}${++executions}`,
                { expirationMs: 50 },
            );

            expect(await fn('a')).toBe('a1');
            expect(executions).toBe(1);

            expect(await fn('a')).toBe('a1');
            expect(executions).toBe(1);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(await fn('a')).toBe('a1');
            expect(executions).toBe(1);

            await new Promise((resolve) => setTimeout(resolve, 75));

            expect(await fn('a')).toBe('a2');
            expect(executions).toBe(2);
        });
    });

    describe('toEpochTime', () => {
        it('should return epoch time for parsable dates', () => {
            expect(util.toEpochTime(new Date(1536668197845)))
                .toBe(1536668197845);

            expect(util.toEpochTime(-100000))
                .toBe(-100000);

            expect(util.toEpochTime(0))
                .toBe(0);

            expect(util.toEpochTime(1536668197845))
                .toBe(1536668197845);

            expect(util.toEpochTime('2018-09-11T12:16:37.845Z'))
                .toBe(1536668197845);
        });

        it('should return null if invalid date', () => {
            expect(util.toEpochTime(undefined)).toBeNull();
            expect(util.toEpochTime(null)).toBeNull();
            expect(util.toEpochTime(false)).toBeNull();
            expect(util.toEpochTime('')).toBeNull();
            expect(util.toEpochTime(Infinity)).toBeNull();
            expect(util.toEpochTime(-Infinity)).toBeNull();
            expect(util.toEpochTime(NaN)).toBeNull();
            expect(util.toEpochTime({})).toBeNull();
            expect(util.toEpochTime([])).toBeNull();
        });
    });

    describe('toISODateString', () => {
        it('should return epoch time for parsable dates', () => {
            expect(util.toISODateString(new Date(1536668197845)))
                .toBe('2018-09-11T12:16:37.845Z');

            expect(util.toISODateString(-100000))
                .toBe('1969-12-31T23:58:20.000Z');

            expect(util.toISODateString(0))
                .toBe('1970-01-01T00:00:00.000Z');

            expect(util.toISODateString(1536668197845))
                .toBe('2018-09-11T12:16:37.845Z');

            expect(util.toISODateString('2018-09-11T12:16:37.845Z'))
                .toBe('2018-09-11T12:16:37.845Z');
        });

        it('should return null if invalid date', () => {
            expect(util.toISODateString(undefined)).toBeNull();
            expect(util.toISODateString(null)).toBeNull();
            expect(util.toISODateString(false)).toBeNull();
            expect(util.toISODateString('')).toBeNull();
            expect(util.toISODateString(Infinity)).toBeNull();
            expect(util.toISODateString(-Infinity)).toBeNull();
            expect(util.toISODateString(NaN)).toBeNull();
            expect(util.toISODateString({})).toBeNull();
            expect(util.toISODateString([])).toBeNull();
        });
    });
});
