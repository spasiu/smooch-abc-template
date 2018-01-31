module.exports = {
    startupMessage: `"Excuse me, is your server running?"\n"Let me see... yes it\'s running."\n"Well then you\'d better go catch it (on port ${process.env.PORT})."\n`,
    smoochAppKeyId: process.env.SMOOCH_APP_KEY_ID,
    smoochAppKeySecret: process.env.SMOOCH_APP_KEY_SECRET,
    smoochEventWebhookSecret: process.env.SMOOCH_EVENT_WEBHOOK_SECRET,
    abcEventWebhookSecret: process.env.ABC_EVENT_WEBHOOK_SECRET,
    appleBaseUrl: process.env.APPLE_BASE_URL,
    apiSecret: process.env.APPLE_API_SECRET,
    businessId: process.env.APPLE_BUSINESS_ID,
    cspId: process.env.APPLE_CSP_ID,
    port: process.env.PORT
};
