const axios = require('axios');
const { createCanvas, loadImage } = require('canvas');
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_APIKEY;

class GeminiImageServiceError extends Error {
    constructor(message, { status = 500, details = null } = {}) {
        super(message);
        this.name = 'GeminiImageServiceError';
        this.status = status;
        this.details = details;
    }
}

function assertApiKey() {
    if (!GEMINI_API_KEY) {
        throw new GeminiImageServiceError('缺少 Gemini API Key，请设置环境变量 GEMINI_API_KEY', {
            status: 500,
            details: 'GEMINI_API_KEY 未配置'
        });
    }
}

function buildPrompt(basePrompt, { width, height }) {
    const lines = [];
    if (basePrompt && basePrompt.trim()) {
        lines.push(basePrompt.trim());
    }
    lines.push(
        'Freely expand the scene outward so the card feels rich, cinematic, and balanced.',
        'Keep the main subject recognizable, but you may reinterpret the surrounding setting with new scenery, props, lighting, or ambiance that fits the style.',
        'Do not limit yourself to the tiny border area—explore new elements, perspective shifts, or storytelling details that make the composition striking.'
    );
    if (width && height) {
        lines.push(`Treat the final composition as a ${width} x ${height} px canvas, ensuring the new scene fills the space dynamically.`);
    }
    return lines.join(' ');
}

async function generateWithGemini({
    prompt,
    imageBuffer,
    mimeType = 'image/png',
    width,
    height,
    user
}) {
    assertApiKey();
    if (!prompt || !prompt.trim()) {
        throw new GeminiImageServiceError('缺少有效提示词', { status: 400 });
    }
    if (!imageBuffer || !(imageBuffer instanceof Buffer)) {
        throw new GeminiImageServiceError('缺少有效的图像缓冲数据', {
            status: 400,
            details: 'imageBuffer 必须是 Buffer'
        });
    }

    const requestPrompt = buildPrompt(prompt, { width, height });
    const base64Data = imageBuffer.toString('base64');

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    { text: requestPrompt },
                    {
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    }
                ]
            }
        ]
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await axios.post(url, requestBody, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 120000
        });

        const candidates = response.data?.candidates || response.data?.contents || [];
        const parts = candidates[0]?.content?.parts || candidates[0]?.parts || [];
        const imagePart = parts.find(part => part.inlineData && part.inlineData.data);
        if (!imagePart) {
            throw new GeminiImageServiceError('Gemini 返回缺少图像数据', { status: 502, details: response.data });
        }

        let resultBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

        let outputWidth;
        let outputHeight;

        if (width && height) {
            const targetRatio = width / height;
            try {
                const image = await loadImage(resultBuffer);
                outputWidth = image.width;
                outputHeight = image.height;
                const currentRatio = image.width / image.height;

                if (Math.abs(currentRatio - targetRatio) > 0.01) {
                    let cropWidth = image.width;
                    let cropHeight = image.height;
                    let offsetX = 0;
                    let offsetY = 0;

                    if (currentRatio > targetRatio) {
                        cropWidth = Math.round(image.height * targetRatio);
                        offsetX = Math.round((image.width - cropWidth) / 2);
                    } else {
                        cropHeight = Math.round(image.width / targetRatio);
                        offsetY = Math.round((image.height - cropHeight) / 2);
                    }

                    const canvas = createCanvas(cropWidth, cropHeight);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(image, -offsetX, -offsetY);
                    resultBuffer = canvas.toBuffer('image/png');
                    outputWidth = cropWidth;
                    outputHeight = cropHeight;
                }
            } catch (err) {
                console.warn('Gemini post-crop failed:', err.message || err);
            }
        }

        return {
            buffer: resultBuffer,
            contentType: 'image/png',
            metadata: {
                model: DEFAULT_MODEL,
                prompt: requestPrompt,
                targetWidth: width,
                targetHeight: height,
                outputWidth,
                outputHeight,
                user
            }
        };
    } catch (error) {
        const status = error.response?.status || 500;
        const details = error.response?.data || error.message;
        throw new GeminiImageServiceError('调用 Gemini 图像接口失败', { status, details });
    }
}

module.exports = {
    GeminiImageServiceError,
    generateWithGemini
};
