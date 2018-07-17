'use strict';

const url = require('url');
const https = require('https');
const typeis = require('type-is');
const qs = require('querystring');

exports.request = async function request(
    method,
    requestURL,
    data,
    { headers = {}, writeStream = null, raw = false } = {}
) {
    const res = await new Promise((resolve, reject) => {
        const reqOpts = url.parse(requestURL);
        reqOpts.method = method;
        reqOpts.headers = headers;

        const req = https.request(reqOpts, resolve);

        req.on('error', reject);

        if (data) {
            if (!Buffer.isBuffer(data) && typeof data !== 'string') {
                data = JSON.stringify(data);
                headers['Content-Type'] = 'application/json; charset=UTF-8';
                headers['Content-Length'] = Buffer.byteLength(data);
            }

            req.write(data);
        }

        req.end();
    });

    const ret = {
        statusCode: res.statusCode,
        headers: res.headers,
    };

    if (writeStream) {
        res.pipe(writeStream);

        await Promise.all([
            new Promise((resolve, reject) => {
                res.on('end', resolve);
                res.on('error', reject);
            }),
            new Promise((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            }),
        ]);
    }
    else {
        ret.data = await new Promise((resolve, reject) => {
            const parts = [];
            res.on('data', (data) => {
                parts.push(data);
            });
            res.on('error', reject);
            res.on('end', () => {
                resolve(Buffer.concat(parts));
            });
        });

        if (!raw && typeof res.headers['content-type'] === 'string') {
            if (typeis.is(res.headers['content-type'], 'application/json')) {
                ret.data = JSON.parse(ret.data.toString('utf8'));
            }
            else if (typeis.is(res.headers['content-type'], 'text/*')) {
                ret.data = ret.data.toString('utf8');
            }
            else if (typeis.is(res.headers['content-type'], 'application/x-www-form-urlencoded')) {
                ret.data = qs.parse(ret.data.toString('utf8'));
            }
        }
    }

    return ret;
};
