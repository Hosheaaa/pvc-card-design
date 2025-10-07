/**
 * AI功能管理器
 * 统一管理和协调所有AI服务
 */

import { isAIFeatureEnabled, getCurrentFeatureFlags } from '../config/feature-flags.js';
import { generateUniqueId } from './utils.js';

const withVersion = (path) => {
    if (typeof window === 'undefined') return path;
    if (typeof window.__aiWithVersion === 'function') {
        return window.__aiWithVersion(path);
    }
    return path;
};

export class AIManager {
    constructor(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.services = new Map();
        this.activeJobs = new Map();
        this.eventTarget = new EventTarget();
        this.featureFlags = getCurrentFeatureFlags();

        this.serviceConfigs = [
            {
                name: 'backgroundRemoval',
                module: '../services/BackgroundRemoval.js',
                className: 'BackgroundRemoval',
                featureFlag: 'backgroundRemoval'
            },
            {
                name: 'openAiImage',
                module: '../services/OpenAIImageService.js',
                className: 'OpenAIImageService',
                featureFlag: 'openAiImage'
            },
            {
                name: 'animeStyleTransfer',
                module: '../services/AnimeStyleTransfer.js',
                className: 'AnimeStyleTransfer',
                featureFlag: 'animeStyleTransfer'
            },
            {
                name: 'outlineExtraction',
                module: '../services/OutlineExtraction.js',
                className: 'OutlineExtraction',
                featureFlag: 'outlineExtraction'
            }
        ];

        this.init();
    }

    /**
     * 初始化AI管理器
     */
    async init() {
        console.log('🤖 初始化AI管理器...');

        try {
            // 动态加载启用的AI服务
            await this.loadEnabledServices();

            // 初始化UI组件（如果功能启用）
            if (this.hasEnabledServices()) {
                await this.initializeUI();
            }

            this.emit('initialized', { manager: this });
            console.log('✅ AI管理器初始化完成');

        } catch (error) {
            console.error('❌ AI管理器初始化失败:', error);
            this.emit('initError', { error });
        }
    }

    /**
     * 加载已启用的AI服务
     */
    async loadEnabledServices() {
        for (const config of this.serviceConfigs) {
            await this.loadService(config);
        }
    }

    async loadService(config) {
        if (!config) return false;
        if (this.services.has(config.name)) return true;
        const enabled = isAIFeatureEnabled(config.featureFlag);
        console.log(`[AI] feature flag ${config.name}:`, enabled);
        if (!enabled) return false;
        try {
            const module = await import(withVersion(config.module));
            const ServiceClass = module[config.className];
            if (!ServiceClass) throw new Error(`服务类未导出: ${config.className}`);
            const service = new ServiceClass();
            this.setupServiceEventListeners(service);
            this.services.set(config.name, service);
            console.log(`✅ 已加载AI服务: ${config.name}`);
            return true;
        } catch (error) {
            console.error(`❌ 加载AI服务失败 ${config.name}:`, error);
            return false;
        }
    }

    /**
     * 设置服务事件监听
     * @param {BaseAIService} service - AI服务实例
     */
    setupServiceEventListeners(service) {
        service.on('requestStart', (event) => {
            this.emit('serviceRequestStart', event.detail);
        });

        service.on('requestSuccess', (event) => {
            this.emit('serviceRequestSuccess', event.detail);
        });

        service.on('requestError', (event) => {
            this.emit('serviceRequestError', event.detail);
        });

        service.on('processingCancelled', (event) => {
            this.emit('serviceProcessingCancelled', event.detail);
        });

        service.on('progressUpdate', (event) => {
            this.emit('jobProgress', event.detail);
        });
    }

    /**
     * 初始化UI组件
     */
    async initializeUI() {
        if (this.featureFlags.debugMode) {
            console.log('🎨 初始化AI处理UI（仅进度模态框）...');
        }

        try {
            // 仅加载处理进度模态框，移除独立AI工具面板
            const { ProcessingModal } = await import(withVersion('../ui/ProcessingModal.js'));
            this.processingModal = new ProcessingModal(this);
        } catch (error) {
            console.error('❌ AI 进度UI初始化失败:', error);
        }
    }

    /**
     * 处理图像
     * @param {string} serviceName - 服务名称
     * @param {File|Blob} imageFile - 图像文件
     * @param {Object} options - 处理选项
     * @returns {Promise<Object>} 处理结果
     */
    async processImage(serviceName, imageFile, options = {}) {
        const service = this.services.get(serviceName);
        if (!service) {
            throw new Error(`AI服务未找到: ${serviceName}`);
        }

        // 生成任务ID
        const jobId = generateUniqueId();

        try {
            // 记录活动任务
            this.activeJobs.set(jobId, {
                serviceName,
                startTime: Date.now(),
                status: 'processing'
            });

            this.emit('jobStart', { jobId, serviceName, imageFile });

            // 执行处理
            const result = await service.processImage(imageFile, options);

            // 更新任务状态
            this.activeJobs.set(jobId, {
                ...this.activeJobs.get(jobId),
                status: 'completed',
                endTime: Date.now(),
                result
            });

            this.emit('jobComplete', { jobId, serviceName, result });
            return { jobId, result };

        } catch (error) {
            // 更新任务状态
            this.activeJobs.set(jobId, {
                ...this.activeJobs.get(jobId),
                status: 'failed',
                endTime: Date.now(),
                error: error.message
            });

            this.emit('jobError', { jobId, serviceName, error });
            throw error;

        } finally {
            // 清理完成的任务（延迟清理以便查看历史）
            setTimeout(() => {
                this.activeJobs.delete(jobId);
            }, 30000); // 30秒后清理
        }
    }

    /**
     * 获取可用的AI服务
     * @returns {Array<string>} 服务名称数组
     */
    getAvailableServices() {
        return Array.from(this.services.keys());
    }

    /**
     * 检查服务是否可用
     * @param {string} serviceName - 服务名称
     * @returns {boolean} 是否可用
     */
    isServiceAvailable(serviceName) {
        return this.services.has(serviceName);
    }

    async ensureServiceLoaded(serviceName) {
        if (this.services.has(serviceName)) {
            return true;
        }
        const config = this.serviceConfigs.find(cfg => cfg.name === serviceName);
        if (!config) {
            return false;
        }
        return await this.loadService(config);
    }

    /**
     * 获取服务状态
     * @param {string} serviceName - 服务名称
     * @returns {Object} 服务状态
     */
    getServiceStatus(serviceName) {
        const service = this.services.get(serviceName);
        if (!service) {
            return { available: false, processing: false };
        }

        return {
            available: true,
            processing: service.getProcessingStatus(),
            config: service.config
        };
    }

    /**
     * 取消任务
     * @param {string} jobId - 任务ID
     */
    cancelJob(jobId) {
        const job = this.activeJobs.get(jobId);
        if (!job) {
            console.warn(`任务未找到: ${jobId}`);
            return;
        }

        const service = this.services.get(job.serviceName);
        if (service) {
            service.cancel();
        }

        this.activeJobs.set(jobId, {
            ...job,
            status: 'cancelled',
            endTime: Date.now()
        });

        this.emit('jobCancelled', { jobId });
    }

    /**
     * 获取活动任务
     * @returns {Array<Object>} 活动任务列表
     */
    getActiveJobs() {
        return Array.from(this.activeJobs.entries()).map(([jobId, job]) => ({
            jobId,
            ...job
        }));
    }

    /**
     * 检查是否有启用的服务
     * @returns {boolean} 是否有启用的服务
     */
    hasEnabledServices() {
        return this.services.size > 0;
    }

    /**
     * 销毁AI管理器
     */
    destroy() {
        // 取消所有活动任务
        for (const jobId of this.activeJobs.keys()) {
            this.cancelJob(jobId);
        }

        // 清理UI组件
        if (this.processingModal) {
            this.processingModal.destroy();
        }

        // 清理服务
        this.services.clear();
        this.activeJobs.clear();

        this.emit('destroyed');
        console.log('🤖 AI管理器已销毁');
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
}
