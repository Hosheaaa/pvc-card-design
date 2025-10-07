/**
 * AI动漫化服务
 * 通过与扩图相同的代理端点实现动漫风格化
 */

import { BaseAIService } from '../core/BaseAIService.js';
import { mockAPICall } from '../core/utils.js';
import { getCurrentFeatureFlags } from '../config/feature-flags.js';

export class AnimeStyleTransfer extends BaseAIService {
    constructor() {
        super('animeStyleTransfer');
        this.featureFlags = getCurrentFeatureFlags();
    }

    /**
     * 处理动漫风格转换
     * @param {File|Blob} imageFile - 输入图像
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 处理结果
     */
    async processImage(imageFile, options = {}) {
        try {
            this.isProcessing = true;
            this.emit('processingStart', { service: this.serviceName });

            const validation = this.validateInput(imageFile);
            if (!validation.valid) {
                throw new Error(`输入验证失败: ${validation.errors.join(', ')}`);
            }

            if (this.featureFlags.mockApiCalls) {
                return await this.mockProcessing(imageFile, options);
            }

            const requestData = await this.prepareRequestData(imageFile, options);

            this.emit('uploadStart', { service: this.serviceName });

            const response = await this.makeAPIRequest(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json'
                },
                body: requestData
            });

            this.emit('uploadComplete', { service: this.serviceName });

            const responseData = await response.json();
            const result = await this.processAPIResponse(imageFile, responseData, options);

            this.emit('processingComplete', { service: this.serviceName, result });
            return result;

        } catch (error) {
            this.emit('processingError', { service: this.serviceName, error });
            throw new Error(`AI动漫化处理失败: ${error.message}`);

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 构建请求数据
     * 使用与扩图相同的FormData格式，并标记动漫化模式
     */
    async prepareRequestData(imageFile, options = {}) {
        const prompt = options.prompt;
        const additional = options.additionalParams || {};

        if (!prompt) {
            throw new Error('缺少动漫化提示词，请在 prompt-presets 中配置 animeStyleTransfer。');
        }

        const formData = new FormData();
        formData.append('image_file', imageFile);

        if (prompt) {
            formData.append('prompt', prompt);
        }

        // 固定标记，便于后端识别动漫化模式
        formData.append('mode', 'anime');
        formData.append('style', 'anime');

        Object.entries(additional).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                formData.append(key, value);
            }
        });

        return formData;
    }

    /**
     * 解析API响应
     */
    async processAPIResponse(originalFile, responseData, options) {
        const artifacts = responseData.artifacts || (responseData.data ? responseData.data.map(entry => ({
            base64: entry.b64_json,
            finishReason: entry.finish_reason
        })) : []);

        if (!artifacts || artifacts.length === 0) {
            throw new Error('API返回无效数据');
        }

        const artifact = artifacts[0];
        const base64Data = artifact.base64 || artifact.b64_json;
        if (!base64Data) {
            throw new Error('API未返回图像数据');
        }

        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const resultBlob = new Blob([bytes], { type: 'image/png' });

        return {
            success: true,
            originalFile,
            processedImage: resultBlob,
            processedURL: URL.createObjectURL(resultBlob),
            processedDataURL: await this.blobToDataURL(resultBlob),
            format: 'png',
            service: this.serviceName,
            timestamp: new Date().toISOString(),
            metadata: {
                originalSize: originalFile.size,
                processedSize: resultBlob.size,
                finishReason: artifact.finishReason,
                mode: 'anime',
                options
            }
        };
    }

    /**
     * 模拟处理流程（开发模式）
     */
    async mockProcessing(imageFile, options = {}) {
        console.log('🧪 模拟AI动漫化处理...');
        for (let progress = 0; progress <= 100; progress += 20) {
            this.emit('progressUpdate', {
                service: this.serviceName,
                progress,
                status: progress < 100 ? 'processing' : 'succeeded'
            });
            await mockAPICall(400);
        }

        const result = {
            success: true,
            originalFile: imageFile,
            processedImage: imageFile,
            processedURL: URL.createObjectURL(imageFile),
            processedDataURL: await this.blobToDataURL(imageFile),
            format: 'png',
            service: this.serviceName,
            timestamp: new Date().toISOString(),
            isMock: true,
            metadata: {
                originalSize: imageFile.size,
                processedSize: imageFile.size,
                options,
                mockSeed: Math.floor(Math.random() * 1_000_000)
            }
        };

        this.emit('processingComplete', { service: this.serviceName, result });
        return result;
    }
}
