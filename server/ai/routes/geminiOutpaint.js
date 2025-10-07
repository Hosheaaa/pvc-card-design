const express = require('express');
const multer = require('multer');
const { generateWithGemini, GeminiImageServiceError } = require('../services/geminiImageClient');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

router.post('/gemini-outpaint', upload.single('image_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '缺少待处理的图像文件(image_file)'
            });
        }

        const prompt = req.body.prompt || '';
        const targetWidth = req.body.target_width ? Number(req.body.target_width) : undefined;
        const targetHeight = req.body.target_height ? Number(req.body.target_height) : undefined;

        const result = await generateWithGemini({
            prompt,
            imageBuffer: req.file.buffer,
            mimeType: req.file.mimetype || 'image/png',
            width: targetWidth,
            height: targetHeight,
            user: req.body.user || 'pvc-card-designer'
        });

        res.set('Content-Type', result.contentType || 'image/png');
        res.set('Content-Disposition', 'inline; filename="gemini-outpaint.png"');
        if (result.metadata) {
            res.set('X-Outpaint-Metadata', Buffer.from(JSON.stringify(result.metadata)).toString('base64'));
        }
        res.send(result.buffer);
    } catch (error) {
        console.error('⚠️ Gemini 扩图失败:', error);
        if (error instanceof GeminiImageServiceError) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message,
                details: error.details || error.message
            });
        }
        res.status(500).json({
            success: false,
            error: 'AI 扩图失败',
            details: error.message || '未知错误'
        });
    }
});

module.exports = router;
