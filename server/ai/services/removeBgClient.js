const FormData = require('form-data');
const axios = require('axios');

const DEFAULT_ENDPOINT = 'https://api.remove.bg/v1.0/removebg';
const REMOVE_BG_ENDPOINT = process.env.REMOVE_BG_API_URL || DEFAULT_ENDPOINT;
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY;

class RemoveBgServiceError extends Error {
    constructor(message, { status = 500, details = null, providerStatus = null } = {}) {
        super(message);
        this.name = 'RemoveBgServiceError';
        this.status = status;
        this.details = details;
        this.providerStatus = providerStatus;
    }
}

function assertApiKey() {
    if (!REMOVE_BG_API_KEY) {
        throw new RemoveBgServiceError('AI 抠图服务未配置', {
            status: 500,
            details: '缺少 remove.bg API key, 请设置环境变量 REMOVE_BG_API_KEY'
        });
    }
}

function buildFormData(file, options = {}) {
    const formData = new FormData();
    formData.append('image_file', file.buffer, {
        filename: file.originalname || 'upload.png',
        contentType: file.mimetype || 'image/png'
    });

    Object.entries(options).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            value.forEach(item => formData.append(key, item));
        } else {
            formData.append(key, value);
        }
    });

    return formData;
}

async function removeBackground(file, options = {}) {
    assertApiKey();

    try {
        const formData = buildFormData(file, options);
        const response = await axios({
            method: 'post',
            url: REMOVE_BG_ENDPOINT,
            headers: {
                ...formData.getHeaders(),
                'X-Api-Key': REMOVE_BG_API_KEY
            },
            data: formData,
            responseType: 'arraybuffer',
            timeout: 45000,
            validateStatus: () => true
        });

        if (response.status < 200 || response.status >= 300) {
            let errorDetails = `remove.bg API 调用失败 (${response.status})`;
            let payload = response.data;

            try {
                const decoded = JSON.parse(Buffer.from(payload).toString('utf8'));
                errorDetails = decoded.errors?.[0]?.title || decoded.errors?.[0]?.detail || errorDetails;
                payload = decoded;
            } catch (parseErr) {
                payload = Buffer.from(payload).toString('utf8');
            }

            throw new RemoveBgServiceError('AI 抠图失败', {
                status: response.status,
                details: errorDetails,
                providerStatus: response.status
            });
        }

        return {
            buffer: Buffer.from(response.data),
            contentType: response.headers['content-type'] || 'image/png',
            contentDisposition: response.headers['content-disposition'] || null
        };
    } catch (error) {
        if (error instanceof RemoveBgServiceError) {
            throw error;
        }

        if (error.code === 'ECONNABORTED') {
            throw new RemoveBgServiceError('AI 抠图超时', {
                status: 504,
                details: 'remove.bg 请求超时，请稍后重试'
            });
        }

        const status = error.response?.status || 500;
        const details = error.response?.data || error.message || '未知错误';

        throw new RemoveBgServiceError('AI 抠图失败', {
            status,
            details,
            providerStatus: error.response?.status
        });
    }
}

module.exports = {
    removeBackground,
    RemoveBgServiceError,
    REMOVE_BG_ENDPOINT,
    DEFAULT_ENDPOINT
};
