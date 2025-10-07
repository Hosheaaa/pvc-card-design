const express = require('express');
const multer = require('multer');
const {
    prepareOutpaintBuffers,
    outpaintWithGPTImage,
    OpenAIImageServiceError
} = require('../services/gptImageClient');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024
    }
});

async function handleOpenAIImage(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '缺少待处理的图像文件(image_file)'
            });
        }

        const prompt = req.body.prompt || 'Outpaint the canvas without altering any existing pixels. Preserve the original subject exactly as provided and add new context only outside its bounds.';
        const backgroundMode = req.body.background_mode || 'auto';
        const targetWidth = req.body.target_width ? Number(req.body.target_width) : undefined;
        const targetHeight = req.body.target_height ? Number(req.body.target_height) : undefined;

        const { baseImageBuffer, maskBuffer, dimensions, offsets, original, rendered } = await prepareOutpaintBuffers(req.file.buffer, {
            targetWidth,
            targetHeight
        });

        const enrichedPrompt = [
            prompt,
            'The original subject area (masked in black) is locked: reproduce those pixels exactly with zero changes in color, lighting, texture, or edges. Treat it as immutable photographic content.',
            'Only paint in the white/transparent regions beyond the original boundaries so the canvas reaches the requested size, matching perspective, lighting, and material of the source.',
            'Blend the new content smoothly into the perimeter, but never overwrite or blend over interior details of the locked region.'
        ].join(' ');

        const openAIResponse = await outpaintWithGPTImage({
            prompt: enrichedPrompt,
            baseImageBuffer,
            maskBuffer,
            width: dimensions.width,
            height: dimensions.height,
            background: backgroundMode,
            user: req.body.user || 'pvc-card-designer'
        });

        const images = openAIResponse.data || [];
        if (!Array.isArray(images) || images.length === 0) {
            throw new OpenAIImageServiceError('OpenAI 返回空结果', { status: 502, details: openAIResponse });
        }

        const artifact = images[0];
        const base64 = artifact.b64_json || artifact.base64;
        if (!base64) {
            throw new OpenAIImageServiceError('OpenAI 返回缺少图像数据', { status: 502, details: artifact });
        }

        res.json({
            success: true,
            artifacts: [
                {
                    base64,
                    finishReason: artifact.finish_reason || artifact.finishReason || 'SUCCESS',
                    seed: artifact.seed || null
                }
            ],
            metadata: {
                width: dimensions.width,
                height: dimensions.height,
                offsets,
                originalSize: original,
                renderedSize: rendered
            }
        });
    } catch (error) {
        console.error('⚠️ 图像扩展失败:', error);
        if (error instanceof OpenAIImageServiceError) {
            return res.status(error.status || 500).json({
                success: false,
                error: 'AI 扩图失败',
                details: error.details || error.message
            });
        }
        res.status(500).json({
            success: false,
            error: 'AI 扩图失败',
            details: error.message || '未知错误'
        });
    }
}

router.post('/openai-image', upload.single('image_file'), handleOpenAIImage);
router.post('/image-expansion', upload.single('image_file'), handleOpenAIImage);

module.exports = router;
