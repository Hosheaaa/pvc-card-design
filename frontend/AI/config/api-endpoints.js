/**
 * AI API 端点配置
 * 支持多个AI服务提供商，便于切换和测试
 */

export const AI_API_CONFIG = {
    // 所有前端调用统一走后端代理，避免泄露密钥/CORS问题
    // 后端建议路由：/api/ai/*

    // 背景移除（代理 remove.bg 或等价服务）
    backgroundRemoval: {
        provider: 'proxy',
        endpoint: '/api/ai/background-removal',
        apiKey: '', // 前端不使用密钥，统一由后端代理
        timeout: 30000,
        maxFileSize: 12 * 1024 * 1024, // 12MB
        supportedFormats: ['png', 'jpg', 'jpeg']
    },

    // 扩图（Gemini 代理，仅扩图按钮使用）
    openAiImage: {
        provider: 'proxy',
        endpoint: '/api/ai/gemini-outpaint',
        apiKey: '', // 前端不使用
        timeout: 120000,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        supportedFormats: ['png', 'jpg', 'jpeg', 'webp']
    },

    // 动漫化（保留 OpenAI 流程）
    animeStyleTransfer: {
        provider: 'proxy',
        endpoint: '/api/ai/openai-image',
        apiKey: '', // 前端不使用
        timeout: 120000,
        maxFileSize: 20 * 1024 * 1024, // 20MB
        supportedFormats: ['png', 'jpg', 'jpeg', 'webp']
    },

    // 扣轮廓（代理后端算法，输出透明背景的轮廓线）
    outlineExtraction: {
        provider: 'proxy',
        endpoint: '/api/ai/openai-image',
        apiKey: '', // 前端不使用
        timeout: 60000,
        maxFileSize: 12 * 1024 * 1024,
        supportedFormats: ['png', 'jpg', 'jpeg']
    },

    // 备用服务配置（保留占位，不在前端使用密钥）
    fallback: {
        backgroundRemoval: {
            provider: 'proxy',
            endpoint: '/api/ai/background-removal'
        }
    }
};

/**
 * 获取指定服务的API配置
 * @param {string} service - 服务名称 (backgroundRemoval, openAiImage, animeStyleTransfer)
 * @returns {Object} API配置对象
 */
export function getAPIConfig(service) {
    const config = AI_API_CONFIG[service];
    if (!config) {
        throw new Error(`未找到服务配置: ${service}`);
    }
    return { ...config };
}

/**
 * 验证API密钥是否已配置
 * @param {string} service - 服务名称
 * @returns {boolean} 是否已配置API密钥
 */
export function hasAPIKey(service) {
    // 前端不直接持有密钥，一律走后端代理
    return true;
}

/**
 * 获取环境变量中的API密钥
 * @param {string} service - 服务名称
 * @returns {string} API密钥
 */
export function getAPIKey(service) {
    // 前端不暴露密钥
    return '';
}
