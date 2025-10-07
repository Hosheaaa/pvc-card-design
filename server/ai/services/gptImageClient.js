const axios = require('axios');
const FormData = require('form-data');
const { createCanvas, loadImage } = require('canvas');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.GPT_IMAGE_API_KEY || process.env.OPENAI_API_KEY_V2;
const OPENAI_ORG = process.env.OPENAI_ORG_ID || process.env.OPENAI_ORGANIZATION || null;
const GPT_IMAGE_MODEL = process.env.GPT_IMAGE_MODEL || 'gpt-image-1';
const MAX_DIMENSION = parseInt(process.env.GPT_IMAGE_MAX_DIMENSION || '2048', 10);
const ALLOWED_BACKGROUNDS = new Set(['transparent', 'opaque', 'auto']);

class OpenAIImageServiceError extends Error {
    constructor(message, { status = 500, details = null } = {}) {
        super(message);
        this.name = 'OpenAIImageServiceError';
        this.status = status;
        this.details = details;
    }
}

function assertAPIKey() {
    if (!OPENAI_API_KEY) {
        throw new OpenAIImageServiceError('缺少 OpenAI API Key，请设置环境变量 OPENAI_API_KEY', {
            status: 500,
            details: 'OPENAI_API_KEY 未配置'
        });
    }
}

function normalizeDimension(value, fallback) {
    const base = Number.isFinite(Number(value)) ? Number(value) : fallback;
    const finalValue = Math.max(64, Math.min(MAX_DIMENSION, base));
    return Math.round(finalValue / 8) * 8;
}

function selectOpenAISize(requestedWidth, requestedHeight, originalWidth, originalHeight) {
    const targetWidth = Number.isFinite(Number(requestedWidth)) ? Number(requestedWidth) : originalWidth;
    const targetHeight = Number.isFinite(Number(requestedHeight)) ? Number(requestedHeight) : originalHeight;
    const targetRatio = targetWidth / targetHeight;

    const ALLOWED_SIZES = [
        { width: 1024, height: 1024 },
        { width: 1536, height: 1024 },
        { width: 1024, height: 1536 }
    ];

    let best = ALLOWED_SIZES[0];
    let bestScore = Infinity;

    ALLOWED_SIZES.forEach(option => {
        const ratio = option.width / option.height;
        const ratioScore = Math.abs(ratio - targetRatio);
        const sizeScore = Math.abs(option.width - targetWidth) + Math.abs(option.height - targetHeight);
        const score = ratioScore * 3 + sizeScore / 512;
        if (score < bestScore) {
            bestScore = score;
            best = option;
        }
    });

    return best;
}

async function prepareOutpaintBuffers(imageBuffer, { targetWidth, targetHeight }) {
    const source = await loadImage(imageBuffer);
    const originalWidth = source.width;
    const originalHeight = source.height;

    const size = selectOpenAISize(
        normalizeDimension(targetWidth, originalWidth),
        normalizeDimension(targetHeight, originalHeight),
        originalWidth,
        originalHeight
    );

    const finalWidth = Math.min(MAX_DIMENSION, size.width);
    const finalHeight = Math.min(MAX_DIMENSION, size.height);

    const scale = Math.min(1, Math.min(finalWidth / originalWidth, finalHeight / originalHeight));
    const renderWidth = Math.round(originalWidth * scale);
    const renderHeight = Math.round(originalHeight * scale);

    const offsetX = Math.floor((finalWidth - renderWidth) / 2);
    const offsetY = Math.floor((finalHeight - renderHeight) / 2);

    const baseCanvas = createCanvas(finalWidth, finalHeight);
    const baseCtx = baseCanvas.getContext('2d');
    baseCtx.clearRect(0, 0, finalWidth, finalHeight);
    baseCtx.drawImage(source, offsetX, offsetY, renderWidth, renderHeight);
    const baseImageBuffer = baseCanvas.toBuffer('image/png');

    const maskCanvas = createCanvas(finalWidth, finalHeight);
    const maskCtx = maskCanvas.getContext('2d');
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(0, 0, finalWidth, finalHeight);

    const gradientPadding = 12;
    const coreX = offsetX + gradientPadding;
    const coreY = offsetY + gradientPadding;
    const coreW = Math.max(0, renderWidth - gradientPadding * 2);
    const coreH = Math.max(0, renderHeight - gradientPadding * 2);

    if (coreW > 0 && coreH > 0) {
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(coreX, coreY, coreW, coreH);

        const gradients = [
            { x: offsetX, y: coreY, w: gradientPadding, h: coreH, dir: 'horizontal' },
            { x: coreX + coreW, y: coreY, w: gradientPadding, h: coreH, dir: 'horizontal-reverse' },
            { x: coreX, y: offsetY, w: coreW, h: gradientPadding, dir: 'vertical' },
            { x: coreX, y: coreY + coreH, w: coreW, h: gradientPadding, dir: 'vertical-reverse' }
        ];

        gradients.forEach((region) => {
            if (region.w <= 0 || region.h <= 0) return;
            const grad = region.dir.includes('horizontal')
                ? maskCtx.createLinearGradient(region.x, 0, region.x + region.w, 0)
                : maskCtx.createLinearGradient(0, region.y, 0, region.y + region.h);

            const reverse = region.dir.includes('reverse');
            if (reverse) {
                grad.addColorStop(0, '#ffffff');
                grad.addColorStop(1, '#000000');
            } else {
                grad.addColorStop(0, '#000000');
                grad.addColorStop(1, '#ffffff');
            }
            maskCtx.fillStyle = grad;
            maskCtx.fillRect(region.x, region.y, region.w, region.h);
        });
    } else {
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(offsetX, offsetY, renderWidth, renderHeight);
    }

    return {
        baseImageBuffer,
        maskBuffer: maskCanvas.toBuffer('image/png'),
        dimensions: { width: finalWidth, height: finalHeight },
        original: { width: originalWidth, height: originalHeight },
        rendered: { width: renderWidth, height: renderHeight },
        offsets: { x: offsetX, y: offsetY }
    };
}

async function outpaintWithGPTImage({
    prompt,
    baseImageBuffer,
    maskBuffer,
    width,
    height,
    background = 'auto',
    user
}) {
    assertAPIKey();

    const formData = new FormData();
    formData.append('model', GPT_IMAGE_MODEL);
    if (prompt) {
        formData.append('prompt', prompt);
    }
    if (background && ALLOWED_BACKGROUNDS.has(String(background).toLowerCase())) {
        formData.append('background', String(background).toLowerCase());
    }
    if (width && height) {
        formData.append('size', `${width}x${height}`);
    }
    formData.append('image[]', baseImageBuffer, { filename: 'base.png', contentType: 'image/png' });
    if (maskBuffer) {
        formData.append('mask', maskBuffer, { filename: 'mask.png', contentType: 'image/png' });
    }
    if (user) {
        formData.append('user', user);
    }

    try {
        const response = await axios.post('https://api.openai.com/v1/images/edits', formData, {
            headers: {
                ...formData.getHeaders(),
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                ...(OPENAI_ORG ? { 'OpenAI-Organization': OPENAI_ORG } : {})
            },
            timeout: 120000
        });

        return response.data;
    } catch (error) {
        const status = error.response?.status || 500;
        const details = error.response?.data || error.message;
        throw new OpenAIImageServiceError('调用 OpenAI 图像接口失败', { status, details });
    }
}

module.exports = {
    OpenAIImageServiceError,
    prepareOutpaintBuffers,
    outpaintWithGPTImage
};
