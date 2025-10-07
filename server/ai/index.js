const express = require('express');
const backgroundRemovalRouter = require('./routes/backgroundRemoval');
const geminiOutpaintRouter = require('./routes/geminiOutpaint');
const openAIImageRouter = require('./routes/openAIImage');

function registerAIRoutes(app) {
    const router = express.Router();

    router.use(backgroundRemovalRouter);
    router.use(geminiOutpaintRouter);
    router.use(openAIImageRouter);

    app.use('/api/ai', router);
}

module.exports = {
    registerAIRoutes
};
