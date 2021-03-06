const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const request = require('request');
const axios = require('axios');
const config = require('../config');
const PassThrough = require('stream').PassThrough;

const secret = Buffer.from(config.apiSecret, 'base64');
const token = jwt.sign({}, secret, { issuer: config.cspId });

module.exports = { getPayload, getResponse };

async function getPayload(interactiveData) {
    const key = await newEncryptionKey();
    const encodedPayloadStream = getEncryptedStream(key.buffer, await getEncodedStream({ v: 1, type: 'interactive', interactiveData }));

    const strm1 = new PassThrough();
    const strm2 = new PassThrough();
    encodedPayloadStream.pipe(strm1);
    encodedPayloadStream.pipe(strm2);

    const size = await getEncryptedStreamLength(key.buffer, strm1);
    const uploadEndpointData = await preUpload(size);
    const uploadFileData = await uploadMedia(uploadEndpointData['upload-url'], strm2, size);

    return {
        type: 'interactive',
        interactiveDataRef: {
            title: interactiveData.receivedMessage.title,
            bid: 'com.apple.messages.MSMessageExtensionBalloonPlugin:0000000000:com.apple.icloud.apps.messages.business.extension',
            'signature-base64': uploadFileData.singleFile.fileChecksum,
            url: uploadEndpointData['mmcs-url'],
            owner: uploadEndpointData['mmcs-owner'],
            key: key.hex,
            size
        }
    };
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

function getEncryptedStream(encryptionKey, inputStream) {
    const initializationVector = Buffer.alloc(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', encryptionKey, initializationVector);

    return inputStream.pipe(cipher);
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
                const passthrough = new PassThrough();
                res.pipe(passthrough);
                resolve(passthrough);
            }
        });
        req.on('error', reject);
    });
}

async function getEncryptedStreamLength(encryptionKey, inputStream) {
    const encryptedLength = await new Promise((resolve, reject) => {
        let fileLength = 0;

        inputStream
            .on('data', (chunk) => {
                return fileLength += chunk.length;
            })
            .on('end', () => {
                resolve(fileLength);
            })
            .on('error', reject);
    });

    return encryptedLength;
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

async function getResponse(interactiveDataRef) {
    const url = await getPayloadUrl(interactiveDataRef);
    const fileStream = await getFileStream(url);
    const iv = Buffer.alloc(16);
    const key = interactiveDataRef.key.substr(2);
    const cipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(key, 'hex'), iv);
    const decodedStream = await getDecodedStream(interactiveDataRef, fileStream.pipe(cipher));

    return new Promise((resolve, reject) => {
        let string = '';
        decodedStream.on('data', data => string += data.toString());
        decodedStream.on('end', () => {
            try {
                const data = JSON.parse(string);
                resolve(data);
            } catch (error) {
                reject(error);
            }
        });
    });
}

async function getPayloadUrl(interactiveDataRef) {
    const response = await axios.get(`${config.appleBaseUrl}/preDownload`, {
        headers: {
            'source-id': config.businessId,
            authorization: `Bearer ${token}`,
            url: interactiveDataRef.url,
            signature: interactiveDataRef['signature-base64'],
            owner: interactiveDataRef.owner
        }
    });

    return response.data['download-url'];
}

function getFileStream(url) {
    return new Promise((resolve, reject) => {
        const req = request.get(url);

        req.on('response', (res) => {
            if (res.statusCode > 399) {
                reject(new Error('Unexpected Status Code ' + res.statusCode));
            } else {
                const passthrough = new PassThrough();
                res.pipe(passthrough);
                resolve(passthrough);
            }
        });
        req.on('error', reject);
    });
}

function getDecodedStream(interactiveDataRef, inputStream) {
    return new Promise((resolve, reject) => {
        const req = request.post({
            url: `${config.appleBaseUrl}/decodePayload`,
            headers: {
                'source-id': config.businessId,
                authorization: `Bearer ${token}`,
                bid: interactiveDataRef.bid
            },
            body: inputStream
        });

        req.on('response', (res) => {
            if (res.statusCode > 399) {
                reject(new Error('Unexpected Status Code ' + res.statusCode));
            } else {
                const passthrough = new PassThrough();
                res.pipe(passthrough);
                resolve(passthrough);
            }
        });
        req.on('error', reject);
    });
}
