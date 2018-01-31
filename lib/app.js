const express = require('express');
const bodyParser = require('body-parser');
const smooch = require('./smooch');
const abc = require('./abc');

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
        res.end(); // TODO when stable add error response
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
        res.end(); // TODO when stable add error response
    }
}

async function sendPayload(appUserId, interactiveData) {
    const payload = await abc.encodePayload({ v: 1, type: 'interactive', interactiveData });
    const key = await abc.newEncryptionKey();
    const encryptedPayload = abc.encryptPayload(key.buffer, payload);
    const size = Buffer.byteLength(encryptedPayload, 'utf8');
    const uploadEndpointData = await abc.preUpload(size);
    const uploadFileData = await abc.uploadMedia(uploadEndpointData['upload-url'], encryptedPayload, size);
    return smooch.appUsers.sendMessage(appUserId, {
        "role": "appMaker",
        "text": "Hello there",
        "override": {
            "apple": {
                "payload": {
                    "type": "interactive",
                    "interactiveDataRef": {
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
