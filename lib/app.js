const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const smooch = require('./smooch');
const abc = require('./abc');
const PassThrough = require('stream').PassThrough;

const config = require('../config');
const triggers = require('../config/triggers');

module.exports.init = (cb) => express()
    .use(bodyParser.json())
    .post('/smooch-event', smoochEventHandler)
    .post('/abc-event', abcEventHanlder)
    .listen(config.port, () => cb(config.startupMessage));

async function smoochEventHandler(req, res) {
    const secret = config.smoochEventWebhookSecret;
    if (secret && secret !== req.headers['x-api-key']) {
        return res.status(403).send();
    }
    res.end();
    try {
        if (req.body.trigger === 'message:appMaker') {
            for (const message of req.body.messages) {
                for (const trigger of triggers) {
                    if (message.text.indexOf(trigger.phrase) !== -1) {
                        const data = require(`../temp/${trigger.payload}`);
                        console.log('start--');
                        await sendPayload(req.body.appUser._id, data);
                    }
                }
            }
            console.log('--end');
        } else {
            console.log('Non-message event\n', req.body);
        }
    } catch(error) {
        console.error('smoochEventHandler ERROR\n', error);
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

async function sendPayload(appUserId, interactiveData) {
    const payload = await abc.getPayload(interactiveData);
    return smooch.appUsers.sendMessage(appUserId, {
        text: interactiveData.receivedMessage.title,
        override: { apple: { payload }},
        role: 'appMaker'
    });
}
