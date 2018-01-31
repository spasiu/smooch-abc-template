const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('request');
const axios = require('axios');
const config = require('../config');
const PassThrough = require('stream').PassThrough;

const secret = Buffer.from(config.apiSecret, 'base64');
const token = jwt.sign({}, secret, { issuer: config.cspId });

module.exports = {
    newEncryptionKey,
    encryptPayload,
    getEncodedStream,
    uploadMedia,
    preUpload
};

function uploadMedia(url, stream, length) {
    return new Promise((resolve, reject) => {
        request.post({
            url,
            headers: {
                'content-length': `${length}`
            },
            body: stream
        }, (err, res, body) => {
            if (err) {
                return reject(err);
            }

            try {
                resolve(JSON.parse(body));
            } catch (err) {
                reject(err);
            }
        });
    });
}

async function getEncodedStream(data) {
    return new Promise((resolve, reject) => {
        const req = request.post({
            url: config.appleBaseUrl + '/encodePayload',
            json: data,
            headers: {
                'authorization': `Bearer ${token}`,
                'source-id': config.businessId
            }
        });

        req.on('response', (res) => {
            if (res.statusCode > 399) {
                reject(new Error('Unexpected Status Code ' + res.statusCode));
            } else {
                // Use passthrough to convert the stream to a type usable by aws-sdk library
                const passthrough = new PassThrough();
                res.pipe(passthrough);
                resolve(passthrough);
            }
        });
        req.on('error', reject);
    });
}

async function preUpload(size) {
    const response = await axios({
        url: config.appleBaseUrl + '/preUpload',
        headers: {
            'authorization': `Bearer ${token}`,
            'source-id': config.businessId,
            size
        },
        'method': 'get'
    });

    return response.data;
}

function encryptPayload(key, encodedPayload) {
    const iv = Buffer.alloc(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
    let crypted = cipher.update(encodedPayload, 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
}

async function newEncryptionKey() {
    const keyBuffer = await new Promise((resolve, reject) => {
        crypto.randomBytes(32, (err, buf) => {
            if (err) {
                reject(err);
            } else {
                resolve(buf);
            }
        });
    });

    return {
        buffer: keyBuffer,
        hex: '00' + keyBuffer.toString('hex')
    };
}
