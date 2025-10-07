/**
 * AI模块工具函数
 */

/**
 * 压缩图像文件
 * @param {File} file - 原始图像文件
 * @param {Object} options - 压缩选项
 * @returns {Promise<Blob>} 压缩后的图像
 */
export async function compressImage(file, options = {}) {
    const {
        maxWidth = 1920,
        maxHeight = 1920,
        quality = 0.8,
        format = 'image/jpeg'
    } = options;

    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            // 计算新尺寸
            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }

            // 设置画布尺寸
            canvas.width = width;
            canvas.height = height;

            // 绘制并压缩
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(resolve, format, quality);
        };

        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
}

/**
 * 检查图像文件类型
 * @param {File} file - 文件对象
 * @returns {boolean} 是否为有效的图像文件
 */
export function isValidImageFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return file && validTypes.includes(file.type);
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化的文件大小
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成唯一ID
 * @returns {string} 唯一标识符
 */
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 限制时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 创建进度回调函数
 * @param {Function} callback - 进度回调
 * @returns {Function} 包装后的进度函数
 */
export function createProgressCallback(callback) {
    return (progress) => {
        if (typeof callback === 'function') {
            callback(Math.min(Math.max(progress, 0), 100));
        }
    };
}

/**
 * 错误处理包装器
 * @param {Function} asyncFunc - 异步函数
 * @returns {Function} 包装后的函数
 */
export function errorHandler(asyncFunc) {
    return async (...args) => {
        try {
            return await asyncFunc(...args);
        } catch (error) {
            console.error(`AI处理错误:`, error);
            throw error;
        }
    };
}

/**
 * 创建图像预览URL
 * @param {File|Blob} file - 图像文件
 * @returns {string} 预览URL
 */
export function createImagePreviewURL(file) {
    return URL.createObjectURL(file);
}

/**
 * 释放预览URL
 * @param {string} url - 预览URL
 */
export function revokeImagePreviewURL(url) {
    URL.revokeObjectURL(url);
}

/**
 * 等待指定时间
 * @param {number} ms - 等待时间（毫秒）
 * @returns {Promise} Promise对象
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查是否支持FileReader API
 * @returns {boolean} 是否支持
 */
export function supportsFileReader() {
    return 'FileReader' in window;
}

/**
 * 检查是否支持Canvas API
 * @returns {boolean} 是否支持
 */
export function supportsCanvas() {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
}

/**
 * 模拟API调用（开发测试用）
 * @param {number} delay - 延迟时间（毫秒）
 * @param {*} result - 模拟结果
 * @returns {Promise} 模拟的异步结果
 */
export async function mockAPICall(delay = 2000, result = null) {
    await sleep(delay);
    return result || { success: true, data: 'mock_result' };
}