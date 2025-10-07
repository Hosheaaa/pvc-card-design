/**
 * AI功能开关配置
 * 用于控制AI功能的启用/禁用，支持逐步发布
 */

export const AI_FEATURE_FLAGS = {
    // 主开关 - 控制整个AI模块
    aiToolsEnabled: true,

    // 开发环境开关
    development: {
        backgroundRemoval: true,    // AI抠图
        openAiImage: true,          // OpenAI 图像（扩图等）
        animeStyleTransfer: true,   // AI动漫化
        outlineExtraction: true,    // AI扣轮廓
        debugMode: true,           // 调试模式
        // 开发默认使用模拟，避免前端直接调用三方API/泄漏密钥
        mockApiCalls: true         // 模拟API调用（开发测试用）
    },

    // 生产环境开关
    production: {
        backgroundRemoval: true,   // 生产环境启用抠图
        openAiImage: true,         // 生产环境启用 OpenAI 图像代理
        animeStyleTransfer: true,   // 生产环境启用动漫化
        outlineExtraction: true,    // 生产环境启用扣轮廓
        debugMode: false,          // 生产环境关闭调试
        mockApiCalls: false        // 生产环境不使用模拟
    }
};

/**
 * 获取当前环境的功能开关
 * @returns {Object} 当前环境的功能配置
 */
export function getCurrentFeatureFlags() {
    const isFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
    const host = (typeof window !== 'undefined' && window.location && window.location.hostname) || '';
    const isLocalhost = host === 'localhost' || host.includes('127.0.0.1') || host === '';
    const isProduction = !isFile && !isLocalhost;
    const envFlags = isProduction ? AI_FEATURE_FLAGS.production : AI_FEATURE_FLAGS.development;
    // 返回拍平后的有效配置：包含顶层主开关 + 当前环境功能项
    return {
        aiToolsEnabled: !!AI_FEATURE_FLAGS.aiToolsEnabled,
        backgroundRemoval: !!envFlags.backgroundRemoval,
        openAiImage: !!envFlags.openAiImage,
        animeStyleTransfer: !!envFlags.animeStyleTransfer,
        outlineExtraction: !!envFlags.outlineExtraction,
        debugMode: !!envFlags.debugMode,
        mockApiCalls: !!envFlags.mockApiCalls
    };
}

/**
 * 检查特定AI功能是否启用
 * @param {string} feature - 功能名称
 * @returns {boolean} 是否启用
 */
export function isAIFeatureEnabled(feature) {
    const flags = getCurrentFeatureFlags();
    // 任何子功能开启都需要主开关开启
    if (feature !== 'aiToolsEnabled' && !flags.aiToolsEnabled) return false;
    return !!flags[feature];
}
