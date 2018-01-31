const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const smooch = require('./smooch');
const abc = require('./abc');
const PassThrough = require('stream').PassThrough;

const config = require('../config');
const triggers = require('../config/triggers');

express()
    .use(bodyParser.json())
    .post('/smooch-event', smoochEventHandler)
    .post('/abc-event', abcEventHanlder)
    .listen(config.port, () => console.log(config.startupMessage));

async function smoochEventHandler(req, res) {
    const secret = config.smoochEventWebhookSecret;
    if (secret && secret !== req.headers['x-api-key']) {
        return res.status(403).send();
    }

    try {
        if (req.body.trigger === 'message:appMaker') {
            for (const message of req.body.messages) {
                for (const trigger of triggers) {
                    if (message.text.indexOf(trigger.phrase) !== -1) {
                        const payload = require(`../config/templates/${trigger.payload}`);
                        await sendPayload(req.body.appUser._id, payload);
                    }
                }
            }
        } else {
            console.log('Non-message event\n', req.body);
        }
        res.end();
    } catch(error) {
        console.error('smoochEventHandler ERROR\n', error);
        res.status(500).json({ error: error.message });
    }
}

async function abcEventHanlder(req, res) {
    const secret = config.abcEventWebhookSecret;
    if (secret && secret !== req.headers['x-api-key']) {
        return res.status(403).send();
    }

    try {
        const selections = JSON.stringify(req.body.payload.apple.interactiveData.data.listPicker.sections, null, 2);
        await smooch.appUsers.sendMessage(req.body.appUser._id, {
            role: 'appUser',
            type: 'text',
            text: `SELECTION\n${selections}`
        });
        res.end();
    } catch (error) {
        console.error('abcEventHanlder ERROR\n', error);
        res.status.json({ error: error.message });
    }
}

function getEncryptedStream(encryptionKey, inputStream) {
    const initializationVector = Buffer.alloc(16);
    const cipher = crypto.createCipheriv('aes-256-ctr', encryptionKey, initializationVector);

    return inputStream.pipe(cipher);
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

async function sendPayload(appUserId, interactiveData) {
    const key = await abc.newEncryptionKey();
    const encodedPayloadStream = getEncryptedStream(key.buffer, await abc.getEncodedStream({ v: 1, type: 'interactive', interactiveData }));

    const strm1 = new PassThrough();
    const strm2 = new PassThrough();
    encodedPayloadStream.pipe(strm1);
    encodedPayloadStream.pipe(strm2);

    const size = await getEncryptedStreamLength(key.buffer, strm1);
    const uploadEndpointData = await abc.preUpload(size);
    const uploadFileData = await abc.uploadMedia(uploadEndpointData['upload-url'], strm2, size);
    return smooch.appUsers.sendMessage(appUserId, {
        role: 'appMaker',
        text: interactiveData.receivedMessage.title,
        override: {
            apple: {
                payload: {
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
                }
            }
        }
    });
}
