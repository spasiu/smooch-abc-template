const express = require('express');
const bodyParser = require('body-parser');
const smooch = require('./smooch');
const abc = require('./abc');
const triggers = require('../config/triggers');
const config = require('../config');

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
                        const appUserId = req.body.appUser._id;
                        const payload = await abc.getPayload(data);
                        await smooch.appUsers.sendMessage(appUserId, {
                            name: 'Template Engine',
                            text: `Sending listpicker [${data.receivedMessage.title}]`,
                            override: { apple: { payload }},
                            role: 'appMaker'
                        });
                    }
                }
            }
        }
    } catch(error) {
        console.error('abcEventHanlder ERROR\n', error && error.response && error.response.data || error);
    }
}

async function abcEventHanlder(req, res) {
    const secret = config.abcEventWebhookSecret;
    if (secret && secret !== req.headers['x-api-key']) {
        return res.status(403).send();
    }

    res.end();

    try {
        const payload = await abc.getResponse(req.body.payload.apple.interactiveDataRef);
        const text = payload.data.listPicker.sections[0].items
            .map(item => item.title)
            .join(' and ');

        await smooch.appUsers.sendMessage(req.body.appUser._id, {
            role: 'appUser', type: 'text', text
        });
    } catch (error) {
        console.error('abcEventHanlder ERROR\n', error && error.response && error.response.data || error);
    }
}
