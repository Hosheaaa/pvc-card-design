/**
 * AI服务基类
 * 定义所有AI服务的通用接口和行为
 */

import { getAPIConfig, getAPIKey } from '../config/api-endpoints.js';

export class BaseAIService {
    constructor(serviceName) {
        this.serviceName = serviceName;
        this.config = getAPIConfig(serviceName);
        this.apiKey = getAPIKey(serviceName);
        this.isProcessing = false;
        this.eventTarget = new EventTarget();
    }

    /**
     * 处理图像 - 子类必须实现此方法
     * @param {File|Blob|string} input - 输入图像
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 处理结果
     */
    async processImage(input, options = {}) {
        throw new Error('子类必须实现 processImage 方法');
    }

    /**
     * 验证输入图像
     * @param {File|Blob} file - 图像文件
     * @returns {Object} 验证结果
     */
    validateInput(file) {
        const result = {
            valid: true,
            errors: []
        };

        // 检查文件大小
        if (file.size > this.config.maxFileSize) {
            result.valid = false;
            result.errors.push(`文件大小超限，最大允许 ${(this.config.maxFileSize / 1024 / 1024).toFixed(1)}MB`);
        }

        // 检查文件格式
        const fileExtension = file.name ? file.name.split('.').pop().toLowerCase() : '';
        if (fileExtension && !this.config.supportedFormats.includes(fileExtension)) {
            result.valid = false;
            result.errors.push(`不支持的文件格式，支持: ${this.config.supportedFormats.join(', ')}`);
        }

        return result;
    }

    /**
     * 发送HTTP请求到AI服务
     * @param {string} endpoint - API端点
     * @param {Object} options - 请求选项
     * @returns {Promise<Response>} API响应
     */
    async makeAPIRequest(endpoint, options = {}) {
        const defaultOptions = {
            method: 'POST',
            headers: {
                // 前端不携带第三方密钥，统一由后端代理处理
                ...options.headers
            },
            timeout: this.config.timeout
        };

        // 合并选项
        const requestOptions = { ...defaultOptions, ...options };

        try {
            this.emit('requestStart', { service: this.serviceName, endpoint });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

            const response = await fetch(endpoint, {
                ...requestOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                let errText = `${response.status} ${response.statusText}`;
                try {
                    const maybeJson = await response.clone().json();
                    if (maybeJson && maybeJson.error) {
                        errText = maybeJson.error.message || maybeJson.error || errText;
                    }
                } catch (_) { /* ignore */ }
                throw new Error(`API请求失败: ${errText}`);
            }

            this.emit('requestSuccess', { service: this.serviceName, response });
            return response;

        } catch (error) {
            this.emit('requestError', { service: this.serviceName, error });
            throw new Error(`${this.serviceName} API调用失败: ${error.message}`);
        }
    }

    /**
     * 将文件转换为FormData
     * @param {File|Blob} file - 文件对象
     * @param {Object} additionalData - 额外数据
     * @returns {FormData} 表单数据
     */
    createFormData(file, additionalData = {}) {
        const formData = new FormData();
        formData.append('image_file', file);

        // 添加额外参数
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, value);
        });

        return formData;
    }

    /**
     * 将文件转换为Base64
     * @param {File|Blob} file - 文件对象
     * @returns {Promise<string>} Base64字符串
     */
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // 移除data:image/...;base64,前缀
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 发送事件
     * @param {string} eventType - 事件类型
     * @param {Object} detail - 事件详情
     */
    emit(eventType, detail) {
        this.eventTarget.dispatchEvent(new CustomEvent(eventType, { detail }));
    }

    /**
     * 监听事件
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理器
     */
    on(eventType, handler) {
        this.eventTarget.addEventListener(eventType, handler);
    }

    /**
     * 移除事件监听
     * @param {string} eventType - 事件类型
     * @param {Function} handler - 事件处理器
     */
    off(eventType, handler) {
        this.eventTarget.removeEventListener(eventType, handler);
    }

    /**
     * 获取处理状态
     * @returns {boolean} 是否正在处理
     */
    getProcessingStatus() {
        return this.isProcessing;
    }

    /**
     * 取消当前处理
     */
    cancel() {
        // 子类可以重写此方法来实现具体的取消逻辑
        this.isProcessing = false;
        this.emit('processingCancelled', { service: this.serviceName });
    }

    /**
     * 将Blob转换为DataURL
     * @param {Blob} blob - Blob对象
     * @returns {Promise<string>} DataURL
     */
    async blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
