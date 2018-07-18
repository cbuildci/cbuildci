'use strict';

const chai = require('chai');
const expect = chai.expect;

const util = require('../../../src/common/util');

describe('util', () => {

    it('should have expected exports', () => {
        expect(Object.keys(util).sort()).to.deep.equal([
            'isValidGitHubUser',
            'isValidGitHubRepo',
            'isValidSha',
            'buildRepoId',
            'parseRepoId',
            'isValidRepoId',
            'parseExecutionId',
            'parseLongExecutionId',
            'isValidExecutionId',
            'buildLockId',
            'hasSpecialLabel',
            'escapeRegExp',
            'convertToRegex',
            'cacheAsyncResult',
        ].sort());
    });

    describe('isValidGitHubUser', () => {
        it('should return true for valid user names', () => {
            expect(util.isValidGitHubUser('a'))
                .to.equal(true);

            expect(util.isValidGitHubUser('0'))
                .to.equal(true);

            expect(util.isValidGitHubUser('a'.repeat(39)))
                .to.equal(true);

            expect(util.isValidGitHubUser('a-1-2-d'))
                .to.equal(true);

            expect(util.isValidGitHubUser('abc-1def-2344-daef'))
                .to.equal(true);
        });

        it('should return false for invalid user names', () => {
            expect(util.isValidGitHubUser('-'))
                .to.equal(false);

            expect(util.isValidGitHubUser('-a'))
                .to.equal(false);

            expect(util.isValidGitHubUser('-a'))
                .to.equal(false);

            expect(util.isValidGitHubUser('-a-'))
                .to.equal(false);

            expect(util.isValidGitHubUser('a--b'))
                .to.equal(false);

            expect(util.isValidGitHubUser('a'.repeat(40)))
                .to.equal(false);
        });
    });

    describe('isValidSha', () => {
        it('should return true for valid SHAs', () => {
            expect(util.isValidSha('204f627a1d310e50725d3a7fa6a7bacc65a3cc89'))
                .to.equal(true);

            expect(util.isValidSha('204F627A1D310E50725D3A7FA6A7BACC65A3CC89'))
                .to.equal(true);
        });

        it('should return false for invalid SHAs', () => {
            expect(util.isValidSha('204f627a1d310e50725d3a7fa6a7bacc65a3cc8'))
                .to.equal(false);

            expect(util.isValidSha('204F627A1D310E50725D3A7FA6A7BACC65A3CC89a'))
                .to.equal(false);
        });
    });

    describe('buildRepoId', () => {
        it('should produce the expected id', () => {
            expect(util.buildRepoId('USER', 'rePO'))
                .to.equal('user/repo');
        });
    });

    describe('parseRepoId', () => {
        it('should produce the expected values', () => {
            expect(util.parseRepoId('USeR/rePO'))
                .to.deep.equal({
                    owner: 'user',
                    repo: 'repo',
                });
        });
    });

    describe('isValidRepoId', () => {
        it('should return true for valid IDs', () => {
            expect(util.isValidRepoId('user/repo'))
                .to.equal(true);

            expect(util.isValidRepoId('USER/repo'))
                .to.equal(true);

            expect(util.isValidRepoId('user/REPO'))
                .to.equal(true);
        });

        it('should return false for invalid IDs', () => {
            expect(util.isValidRepoId(null))
                .to.equal(false);

            expect(util.isValidRepoId(''))
                .to.equal(false);

            expect(util.isValidRepoId('hst'))
                .to.equal(false);

            expect(util.isValidRepoId('hst/user/repo'))
                .to.equal(false);

            expect(util.isValidRepoId('https://hst/user/repo/'))
                .to.equal(false);

            expect(util.isValidRepoId('http://hst/user/repo/'))
                .to.equal(false);
        });
    });

    describe('parseExecutionId', () => {
        it('should produce the expected values', () => {
            expect(util.parseExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89/5'))
                .to.deep.equal({
                    sha: 'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionId: '5',
                });

            expect(util.parseExecutionId('204f627a1d310e50725d3a7fa6a7bacc65a3cc89/9999'))
                .to.deep.equal({
                    sha: '204f627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionId: '9999',
                });
        });

        it('should return null or invalid values', () => {
            expect(util.parseExecutionId(null))
                .to.equal(null);

            expect(util.parseExecutionId(''))
                .to.equal(null);

            expect(util.parseExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5'))
                .to.equal(null);

            expect(util.parseExecutionId('204f627a1d310e50725d3a7fa6a7bacc65a3cc89'))
                .to.equal(null);

            expect(util.parseExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5/5'))
                .to.equal(null);
        });
    });

    describe('parseLongExecutionId', () => {
        it('should produce the expected values for valid execution IDs', () => {
            expect(util.parseLongExecutionId('USeR/rePO/ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89/5'))
                .to.deep.equal({
                    owner: 'user',
                    repo: 'repo',
                    sha: 'abcf627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionId: '5',
                });

            expect(util.parseLongExecutionId('USeR/rePO/204f627a1d310e50725d3a7fa6a7bacc65a3cc89/9999'))
                .to.deep.equal({
                    owner: 'user',
                    repo: 'repo',
                    sha: '204f627a1d310e50725d3a7fa6a7bacc65a3cc89',
                    executionId: '9999',
                });
        });

        it('should return null or invalid values', () => {
            expect(util.parseLongExecutionId(null))
                .to.equal(null);

            expect(util.parseLongExecutionId(''))
                .to.equal(null);

            expect(util.parseLongExecutionId('USeR/rePO/ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5'))
                .to.equal(null);

            expect(util.parseLongExecutionId('USeR/rePO/204f627a1d310e50725d3a7fa6a7bacc65a3cc89'))
                .to.equal(null);

            expect(util.parseLongExecutionId('USeR/rePO/ABCF627a1d310e50725d3a7fa6a7bacc65a3cc8/5/5'))
                .to.equal(null);
        });
    });

    describe('isValidExecutionId', () => {
        it('should return true for valid execution IDs', () => {
            expect(util.isValidExecutionId('ABCF627a1d310e50725d3a7fa6a7bacc65a3cc89/1'))
                .to.equal(true);

            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/9999'))
                .to.equal(true);
        });

        it('should return false for invalid IDs', () => {
            expect(util.isValidExecutionId(null))
                .to.equal(false);

            expect(util.isValidExecutionId(''))
                .to.equal(false);

            expect(util.isValidExecutionId('0'))
                .to.equal(false);

            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/0'))
                .to.equal(false);

            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/0001'))
                .to.equal(false);

            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/10000'))
                .to.equal(false);

            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/99999'))
                .to.equal(false);

            expect(util.isValidExecutionId('abcf627a1d310e50725d3a7fa6a7bacc65a3cc89/99999'))
                .to.equal(false);
        });
    });

    describe('buildLockId', () => {
        it('should produce the expected id', () => {
            expect(util.buildLockId('USER', 'rePO', 'coMMit'))
                .to.equal('user/repo/commit');
        });
    });

    describe('hasSpecialLabel', () => {
        it('should return true if contains label', () => {
            expect(util.hasSpecialLabel(['foobar'], 'foobar'))
                .to.equal(true);

            expect(util.hasSpecialLabel(['foobar', 'foo', 'bar'], 'foobar'))
                .to.equal(true);

            expect(util.hasSpecialLabel(['foobar'], 'FOOBAR'))
                .to.equal(true);
        });

        it('should return false if not contains label', () => {
            expect(util.hasSpecialLabel([], 'foobar'))
                .to.equal(false);

            expect(util.hasSpecialLabel(['xfoobar', 'foobarx'], 'foobar'))
                .to.equal(false);

            expect(util.hasSpecialLabel(['null'], null))
                .to.equal(false);

            expect(util.hasSpecialLabel(['undefined'], undefined))
                .to.equal(false);
        });
    });

    describe('escapeRegExp', () => {
        it('should escape characters', () => {
            const chars = '-[]{}()*+?.,\\^$|#'.split('');

            for (const char of chars) {
                expect(util.escapeRegExp(char))
                    .to.equal(`\\${char}`);
            }

            expect(util.escapeRegExp(chars.join('')))
                .to.equal(chars.map((v) => `\\${v}`).join(''));

            expect(util.escapeRegExp('\n'))
                .to.equal('\\n');

            expect(util.escapeRegExp('\t'))
                .to.equal('\\t');

            // Check that the pattern would match the list of characters above.
            expect(!!chars.join('').match(new RegExp(`^${util.escapeRegExp(chars.join(''))}$`)))
                .to.equal(true);
        });
    });

    describe('convertToRegex', () => {
        it('should support glob pattern', () => {
            const re = util.convertToRegex('fo*bar');
            expect(re).to.be.instanceof(RegExp);
            expect(re.source).to.equal('^fo.*bar$');
            expect(re.flags).to.equal('');

            expect(util.convertToRegex('foobar').source)
                .to.equal('^foobar$');

            const chars = '-[]{}()+?.,\\^$|#'.split('');

            for (const char of chars) {
                expect(util.convertToRegex(`foo${char}bar`).source)
                    .to.equal(`^foo\\${char}bar$`);
            }

            expect(util.convertToRegex('fo*ba*r').source)
                .to.equal('^fo.*ba.*r$');

            expect(util.convertToRegex('*fo**r*').source)
                .to.equal('^.*fo.*.*r.*$');
        });

        it('should be same regex if wrapped in forward slashes', () => {
            const re = util.convertToRegex('/^foo$/');
            expect(re).to.be.instanceof(RegExp);
            expect(re.source).to.equal('^foo$');
            expect(re.flags).to.equal('');
        });

        it('should return null if invalid pattern', () => {
            expect(util.convertToRegex('/+/'))
                .to.equal(null);
        });
    });

    describe('cacheAsyncResult', () => {
        it('should return a function that is a promise', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult(() => `foo${++executions}`);

            expect(fn)
                .to.be.a('function');

            expect(await fn()).to.equal('foo1');
            expect(executions).to.equal(1);

            expect(await fn()).to.equal('foo1');
            expect(executions).to.equal(1);
        });

        it('should support numeric getKey to determine cache key', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult((v) => `${v}${++executions}`, { getKey: 0 });

            expect(await fn('a')).to.equal('a1');
            expect(executions).to.equal(1);

            expect(await fn('a')).to.equal('a1');
            expect(executions).to.equal(1);

            expect(await fn('b')).to.equal('b2');
            expect(executions).to.equal(2);

            expect(await fn('b')).to.equal('b2');
            expect(executions).to.equal(2);

            expect(await fn('a')).to.equal('a1');
            expect(executions).to.equal(2);
        });

        it('should support function getKey to determine cache key', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult((v) => `${v}${++executions}`, { getKey: (a, b) => b });

            expect(await fn('a', 'alpha')).to.equal('a1');
            expect(executions).to.equal(1);

            expect(await fn('a', 'alpha')).to.equal('a1');
            expect(executions).to.equal(1);

            expect(await fn('foo', 'alpha')).to.equal('a1');
            expect(executions).to.equal(1);

            expect(await fn('a', 'beta')).to.equal('a2');
            expect(executions).to.equal(2);

            expect(await fn('a', 'beta')).to.equal('a2');
            expect(executions).to.equal(2);

            expect(await fn('a', 'alpha')).to.equal('a1');
            expect(executions).to.equal(2);
        });

        it('should support expiration', async () => {
            let executions = 0;
            const fn = util.cacheAsyncResult(
                (v) => `${v}${++executions}`,
                { expirationMs: 10 },
            );

            expect(await fn('a')).to.equal('a1');
            expect(executions).to.equal(1);

            expect(await fn('a')).to.equal('a1');
            expect(executions).to.equal(1);

            await new Promise((resolve) => setTimeout(resolve, 5));

            expect(await fn('a')).to.equal('a1');
            expect(executions).to.equal(1);

            await new Promise((resolve) => setTimeout(resolve, 10));

            expect(await fn('a')).to.equal('a2');
            expect(executions).to.equal(2);
        });
    });
});
