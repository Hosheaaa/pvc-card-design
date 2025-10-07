/**
 * AI抠图服务
 * 使用Remove.bg API或其他背景移除服务
 */

import { BaseAIService } from '../core/BaseAIService.js';
import { mockAPICall } from '../core/utils.js';
import { getCurrentFeatureFlags } from '../config/feature-flags.js';

export class BackgroundRemoval extends BaseAIService {
    constructor() {
        super('backgroundRemoval');
        this.featureFlags = getCurrentFeatureFlags();
    }

    /**
     * 处理图像抠图
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

            // 如果启用模拟模式（开发测试）
            if (this.featureFlags.mockApiCalls) {
                return await this.mockProcessing(imageFile, options);
            }

            // 准备API请求
            const formData = this.createFormData(imageFile, {
                format: options.format || 'png',
                size: options.size || 'auto',
                ...(options.prompt ? { prompt: options.prompt } : {}),
                ...options.additionalParams
            });

            this.emit('uploadStart', { service: this.serviceName });

            // 通过后端代理调用
            const response = await this.makeAPIRequest(this.config.endpoint, {
                method: 'POST',
                body: formData
            });

            this.emit('uploadComplete', { service: this.serviceName });

            // 处理响应
            const resultBlob = await response.blob();

            const result = {
                success: true,
                originalFile: imageFile,
                processedImage: resultBlob,
                processedURL: URL.createObjectURL(resultBlob),
                processedDataURL: await this.blobToDataURL(resultBlob),
                format: 'png',
                service: this.serviceName,
                timestamp: new Date().toISOString(),
                metadata: {
                    originalSize: imageFile.size,
                    processedSize: resultBlob.size,
                    compressionRatio: (imageFile.size / resultBlob.size).toFixed(2)
                }
            };

            this.emit('processingComplete', { service: this.serviceName, result });
            return result;

        } catch (error) {
            this.emit('processingError', { service: this.serviceName, error });
            throw new Error(`AI抠图处理失败: ${error.message}`);

        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 模拟处理（开发测试用）
     * @param {File|Blob} imageFile - 输入图像
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 模拟结果
     */
    async mockProcessing(imageFile, options = {}) {
        console.log('🧪 模拟AI抠图处理...');

        // 模拟处理时间
        await mockAPICall(3000);

        // 创建模拟结果（实际上返回原图）
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
                compressionRatio: 1.0
            }
        };

        this.emit('processingComplete', { service: this.serviceName, result });
        return result;
    }

    /**
     * 获取支持的输出格式
     * @returns {Array<string>} 支持的格式
     */
    getSupportedOutputFormats() {
        return ['png', 'png_hd'];
    }

    /**
     * 获取支持的尺寸选项
     * @returns {Array<string>} 支持的尺寸
     */
    getSupportedSizes() {
        return ['auto', 'preview', 'small', 'regular', 'medium', 'hd', '4k'];
    }

    /**
     * 估算处理时间
     * @param {File} file - 输入文件
     * @returns {number} 估算时间（秒）
     */
    estimateProcessingTime(file) {
        // 基于文件大小估算（简单算法）
        const sizeInMB = file.size / (1024 * 1024);
        if (sizeInMB < 1) return 5;
        if (sizeInMB < 5) return 10;
        if (sizeInMB < 10) return 20;
        return 30;
    }

    /**
     * 获取处理建议
     * @param {File} file - 输入文件
     * @returns {Object} 处理建议
     */
    getProcessingRecommendations(file) {
        const sizeInMB = file.size / (1024 * 1024);
        const recommendations = {
            format: 'png',
            size: 'auto',
            tips: []
        };

        if (sizeInMB > 10) {
            recommendations.size = 'regular';
            recommendations.tips.push('大文件建议使用 regular 尺寸以加快处理速度');
        }

        if (file.type === 'image/jpeg') {
            recommendations.tips.push('JPEG格式可能影响透明度处理效果');
        }

        if (sizeInMB < 0.5) {
            recommendations.size = 'hd';
            recommendations.tips.push('小文件建议使用 HD 尺寸获得最佳质量');
        }

        return recommendations;
    }

    /**
     * 预处理图像（如果需要）
     * @param {File} file - 输入文件
     * @returns {Promise<File>} 预处理后的文件
     */
    async preprocessImage(file) {
        // 如果文件太大，进行压缩
        if (file.size > this.config.maxFileSize * 0.8) {
            const withVersion = (path) => {
                if (typeof window === 'undefined') return path;
                if (typeof window.__aiWithVersion === 'function') {
                    return window.__aiWithVersion(path);
                }
                return path;
            };
            const { compressImage } = await import(withVersion('../core/utils.js'));
            return await compressImage(file, {
                maxWidth: 1920,
                maxHeight: 1920,
                quality: 0.9
            });
        }

        return file;
    }
}
