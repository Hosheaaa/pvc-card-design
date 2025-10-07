/**
 * OpenAI 图像扩展/生成服务 (Outpainting)
 * 通过后端代理调用 OpenAI GPT-Image 系列
 */

import { BaseAIService } from '../core/BaseAIService.js';
import { mockAPICall } from '../core/utils.js';
import { getCurrentFeatureFlags } from '../config/feature-flags.js';

export class OpenAIImageService extends BaseAIService {
    constructor() {
        super('openAiImage');
        this.featureFlags = getCurrentFeatureFlags();
    }

    /**
     * 处理图像扩展
     * @param {File|Blob} imageFile - 输入图像
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 处理结果
     */
    async processImage(imageFile, options = {}) {
        try {
            this.isProcessing = true;
            this.emit('processingStart', { service: this.serviceName });

            // 验证输入
            const validation = this.validateInput(imageFile);
            if (!validation.valid) {
                throw new Error(`输入验证失败: ${validation.errors.join(', ')}`);
            }

            // 如果启用模拟模式
            if (this.featureFlags.mockApiCalls) {
                return await this.mockProcessing(imageFile, options);
            }

            // 准备API请求数据
            const requestData = await this.prepareRequestData(imageFile, options);

            this.emit('uploadStart', { service: this.serviceName });

            // 通过后端代理调用
            const response = await this.makeAPIRequest(this.config.endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json, image/png'
                },
                body: requestData
            });

            this.emit('uploadComplete', { service: this.serviceName });

            const contentType = (response.headers.get && response.headers.get('Content-Type')) || '';
            let result;
            if (contentType.includes('application/json')) {
                const responseData = await response.json();
                result = await this.processAPIResponse(imageFile, responseData, options);
            } else {
                const resultBlob = await response.blob();
                result = await this.processBinaryResponse(imageFile, resultBlob, response, options);
            }

            this.emit('processingComplete', { service: this.serviceName, result });
            return result;

        } catch (error) {
            this.emit('processingError', { service: this.serviceName, error });
            throw new Error(`AI扩图处理失败: ${error.message}`);

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 准备API请求数据
     * @param {File|Blob} imageFile - 输入图像
     * @param {Object} options - 处理选项
     * @returns {Promise<FormData>} 请求数据
     */
    async prepareRequestData(imageFile, options) {
        const prompt = options.prompt;
        const additional = options.additionalParams || {};

        if (!prompt) {
            throw new Error('缺少扩图提示词，请在 prompt-presets 中配置 openAiImage。');
        }

        const formData = new FormData();
        formData.append('image_file', imageFile);
        formData.append('prompt', prompt);

        if (additional.target_width) {
            formData.append('target_width', additional.target_width);
        }
        if (additional.target_height) {
            formData.append('target_height', additional.target_height);
        }
        if (additional.background_mode) {
            formData.append('background_mode', additional.background_mode);
        }

        return formData;
    }

    /**
     * 处理API响应
     * @param {File|Blob} originalFile - 原始文件
     * @param {Object} responseData - API响应数据
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 处理结果
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
        
        // 将base64转换为Blob
        const base64Data = artifact.base64 || artifact.b64_json;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const resultBlob = new Blob([bytes], { type: 'image/png' });

        return {
            success: true,
            originalFile: originalFile,
            processedImage: resultBlob,
            processedURL: URL.createObjectURL(resultBlob),
            processedDataURL: await this.blobToDataURL(resultBlob),
            format: 'png',
            service: this.serviceName,
            timestamp: new Date().toISOString(),
            metadata: {
                originalSize: originalFile.size,
                processedSize: resultBlob.size,
                seed: artifact.seed,
                finishReason: artifact.finishReason,
                expansionOptions: options
            }
        };
    }

    /**
     * 处理返回二进制图像的响应（Gemini）
     */
    async processBinaryResponse(originalFile, resultBlob, response, options) {
        const objectUrl = URL.createObjectURL(resultBlob);
        const dataURL = await this.blobToDataURL(resultBlob);
        let metadata = {
            originalSize: originalFile.size,
            processedSize: resultBlob.size,
            expansionOptions: options
        };

        if (response && response.headers && response.headers.get) {
            const metaHeader = response.headers.get('X-Outpaint-Metadata');
            const contentType = response.headers.get('Content-Type');
            if (metaHeader) {
                try {
                    const decoded = JSON.parse(atob(metaHeader));
                    metadata = { ...metadata, ...decoded };
                } catch (err) {
                    console.warn('Failed to decode outpaint metadata header:', err);
                }
            }
            if (contentType) {
                metadata.contentType = contentType;
            }
        }

        return {
            success: true,
            originalFile,
            processedImage: resultBlob,
            processedURL: objectUrl,
            processedDataURL: dataURL,
            format: (response && response.headers && response.headers.get && response.headers.get('Content-Type')) || 'image/png',
            service: this.serviceName,
            timestamp: new Date().toISOString(),
            metadata
        };
    }

    /**
     * 模拟处理（开发测试用）
     * @param {File|Blob} imageFile - 输入图像
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 模拟结果
     */
    async mockProcessing(imageFile, options = {}) {
        console.log('🧪 模拟AI扩图处理...');

        // 模拟较长的处理时间
        await mockAPICall(8000);

        const result = {
            success: true,
            originalFile: imageFile,
            processedImage: imageFile, // 模拟时使用原图
            processedURL: URL.createObjectURL(imageFile),
            processedDataURL: await this.blobToDataURL(imageFile),
            format: 'png',
            service: this.serviceName,
            timestamp: new Date().toISOString(),
            isMock: true,
            metadata: {
                originalSize: imageFile.size,
                processedSize: imageFile.size,
                expansionOptions: options,
                mockSeed: Math.floor(Math.random() * 1000000)
            }
        };

        this.emit('processingComplete', { service: this.serviceName, result });
        return result;
    }

    /**
     * 获取支持的扩展方向
     * @returns {Array<Object>} 扩展方向选项
     */
    getSupportedExpansionDirections() {
        return [
            { value: 'all', label: '全方向扩展' },
            { value: 'horizontal', label: '水平扩展' },
            { value: 'vertical', label: '垂直扩展' },
            { value: 'top', label: '向上扩展' },
            { value: 'bottom', label: '向下扩展' },
            { value: 'left', label: '向左扩展' },
            { value: 'right', label: '向右扩展' }
        ];
    }

    /**
     * 获取推荐的扩展比例
     * @returns {Array<Object>} 扩展比例选项
     */
    getRecommendedExpansionRatios() {
        return [
            { value: 1.2, label: '轻微扩展 (20%)' },
            { value: 1.5, label: '适中扩展 (50%)' },
            { value: 2.0, label: '大幅扩展 (100%)' },
            { value: 2.5, label: '极大扩展 (150%)' }
        ];
    }

    /**
     * 估算处理时间
     * @param {File} file - 输入文件
     * @param {Object} options - 处理选项
     * @returns {number} 估算时间（秒）
     */
    estimateProcessingTime(file, options = {}) {
        const sizeInMB = file.size / (1024 * 1024);
        const baseTime = 20; // 基础时间

        // 根据文件大小调整
        let timeMultiplier = 1;
        if (sizeInMB > 5) timeMultiplier = 1.5;
        if (sizeInMB > 10) timeMultiplier = 2.0;

        // 根据扩展比例调整
        const expansionRatio = options.expansionRatio || 1.5;
        if (expansionRatio > 2.0) timeMultiplier *= 1.3;

        // 根据步数调整
        const steps = options.steps || 30;
        if (steps > 40) timeMultiplier *= 1.2;

        return Math.round(baseTime * timeMultiplier);
    }

    /**
     * 获取处理建议
     * @param {File} file - 输入文件
     * @returns {Object} 处理建议
     */
    getProcessingRecommendations(file) {
        const sizeInMB = file.size / (1024 * 1024);
        const recommendations = {
            expansionRatio: 1.5,
            strength: 0.35,
            steps: 30,
            tips: []
        };

        if (sizeInMB > 8) {
            recommendations.expansionRatio = 1.2;
            recommendations.steps = 25;
            recommendations.tips.push('大文件建议使用较小的扩展比例以减少处理时间');
        }

        if (file.type === 'image/jpeg') {
            recommendations.strength = 0.3;
            recommendations.tips.push('JPEG格式建议降低强度以保持图像质量');
        }

        recommendations.tips.push('建议先预览效果再进行最终处理');
        recommendations.tips.push('复杂图像可能需要调整提示词以获得更好效果');

        return recommendations;
    }

    /**
     * 生成处理提示词建议
     * @param {string} imageContext - 图像内容描述
     * @returns {Array<string>} 提示词建议
     */
    generatePromptSuggestions(imageContext = '') {
        const basePrompts = [
            '继续图像内容，保持相同风格和色调',
            '自然延续图像边缘，无缝衔接',
            '扩展背景内容，保持整体一致性'
        ];

        const contextPrompts = {
            portrait: '继续背景环境，保持人物主体完整',
            landscape: '延续自然景观，保持地平线连续',
            abstract: '延续抽象图案和色彩流动',
            architectural: '继续建筑结构和周边环境'
        };

        return [
            ...basePrompts,
            ...(contextPrompts[imageContext] ? [contextPrompts[imageContext]] : [])
        ];
    }
}
