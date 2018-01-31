const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('request');
const axios = require('axios');
const config = require('../config');

console.log('>>>', config.cspId, config);

const secret = Buffer.from(config.apiSecret, 'base64');
const token = jwt.sign({}, secret, { issuer: config.cspId });

module.exports = {
    newEncryptionKey,
    encryptPayload,
    encodePayload,
    uploadMedia,
    preUpload
};

function uploadMedia(url, body, length) {
    return new Promise((resolve, reject) => {
        request.post({
            url,
            body,
            headers: {
                'content-length': `${length}`
            }
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

async function encodePayload(data) {
    const response = await axios.post(config.appleBaseUrl + '/encodePayload', data, {
        headers: {
            'authorization': `Bearer ${token}`,
            'source-id': config.businessId,
            accept: '*/*',
            'accept-encoding': 'gzip, deflate'
        }
    });

    return response.data;
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
