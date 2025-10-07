/**
 * AI处理进度模态框
 * 显示AI处理的实时进度和状态
 */

export class ProcessingModal {
    constructor(aiManager) {
        this.aiManager = aiManager;
        this.isVisible = false;
        this.currentJobId = null;
        this.currentService = null;
        this.autoCloseOnSuccess = false;
        this.autoCloseDelay = 3000;

        this.i18n = {
            zh: {
                titleSuffix: ' - 处理中...',
                processingTitle: 'AI处理中...',
                uploadStep: '上传图像',
                processStep: 'AI处理',
                downloadStep: '下载结果',
                uploading: '上传中...',
                processing: 'AI处理中...',
                done: '处理完成！',
                failed: '处理失败',
                cancelled: '已取消',
                etaLabel: '⏱️ 预计完成时间:',
                elapsedLabel: '⏰ 已用时间:',
                aiNames: {
                    backgroundRemoval: '人像抠图',
                    openAiImage: '拓展至卡片大小',
                    animeStyleTransfer: '动漫化',
                    outlineExtraction: '扣轮廓'
                }
            },
            en: {
                titleSuffix: ' - Processing...',
                processingTitle: 'Processing...',
                uploadStep: 'Upload Image',
                processStep: 'AI Processing',
                downloadStep: 'Download Result',
                uploading: 'Uploading...',
                processing: 'AI Processing...',
                done: 'Done!',
                failed: 'Failed',
                cancelled: 'Cancelled',
                etaLabel: '⏱️ Estimated Time:',
                elapsedLabel: '⏰ Elapsed Time:',
                aiNames: {
                    backgroundRemoval: 'Portrait Cutout',
                    openAiImage: 'Expand to Card Size',
                    animeStyleTransfer: 'Anime Style',
                    outlineExtraction: 'Outline Extraction'
                }
            }
        };

        this.init();
    }

    /**
     * 初始化模态框
     */
    init() {
        this.createModal();
        this.bindEvents();
        this.setupAIManagerEvents();
        console.log('⏳ AI处理模态框已初始化');
    }

    /**
     * 创建模态框DOM结构
     */
    createModal() {
        const modalHTML = `
            <div class="ai-processing-modal" id="aiProcessingModal" style="display: none;">
                <div class="modal-backdrop"></div>
                <div class="modal-container">
                    <div class="modal-header">
                        <h3 id="processingTitle">AI处理中...</h3>
                        <button class="modal-close" id="processingModalClose">&times;</button>
                    </div>

                    <div class="modal-body">
                        <!-- 处理信息 -->
                        <div class="processing-info">
                            <div class="service-info">
                                <span class="service-icon" id="serviceIcon">🤖</span>
                                <div class="service-details">
                                    <h4 id="serviceName">AI服务</h4>
                                    <p id="serviceDescription">正在处理您的图像...</p>
                                </div>
                            </div>
                        </div>

                        <!-- 图像预览 -->
                        <div class="image-preview">
                            <div class="preview-container">
                                <img id="previewImage" src="" alt="处理中的图像" style="max-width: 100%; max-height: 200px; object-fit: contain;">
                            </div>
                        </div>

                        <!-- 进度条 -->
                        <div class="progress-section">
                            <div class="progress-bar">
                                <div class="progress-fill" id="progressFill" style="width: 0%;"></div>
                            </div>
                            <div class="progress-text">
                                <span id="progressPercent">0%</span>
                                <span id="progressStatus">初始化中...</span>
                            </div>
                        </div>

                        <!-- 估算时间 -->
                        <div class="time-estimation">
                            <div class="time-info">
                                <span id="etaLabel">⏱️ 预计完成时间:</span>
                                <span id="estimatedTime">计算中...</span>
                            </div>
                            <div class="elapsed-time">
                                <span id="elapsedLabel">⏰ 已用时间:</span>
                                <span id="elapsedTime">00:00</span>
                            </div>
                        </div>

                        <!-- 处理步骤 -->
                        <div class="processing-steps">
                            <div class="step" id="step1">
                                <span class="step-icon">📤</span>
                                <span class="step-text" id="step1Text">上传图像</span>
                                <span class="step-status">⏳</span>
                            </div>
                            <div class="step" id="step2">
                                <span class="step-icon">🔄</span>
                                <span class="step-text" id="step2Text">AI处理</span>
                                <span class="step-status">⏳</span>
                            </div>
                            <div class="step" id="step3">
                                <span class="step-icon">⬇️</span>
                                <span class="step-text" id="step3Text">下载结果</span>
                                <span class="step-status">⏳</span>
                            </div>
                        </div>

                        <!-- 错误信息 -->
                        <div class="error-section" id="errorSection" style="display: none;">
                            <div class="error-icon">❌</div>
                            <div class="error-message">
                                <h4>处理失败</h4>
                                <p id="errorText">发生未知错误</p>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="cancelProcessing">取消处理</button>
                        <button class="btn btn-primary" id="closeModal" style="display: none;">关闭</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.refreshLangTexts();
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        const modal = document.getElementById('aiProcessingModal');
        const closeBtn = document.getElementById('processingModalClose');
        const cancelBtn = document.getElementById('cancelProcessing');
        const closeModalBtn = document.getElementById('closeModal');

        // 关闭按钮
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // 取消处理按钮
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.cancelProcessing());
        }

        // 关闭模态框按钮
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => this.hide());
        }

        // 点击背景关闭（可选）
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-backdrop')) {
                    // this.hide(); // 注释掉，防止误操作
                }
            });
        }

        // ESC键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }

    /**
     * 设置AI管理器事件监听
     */
    setupAIManagerEvents() {
        this.aiManager.on('jobStart', (event) => {
            // 模态框已显示时不重复显示
            if (!this.isVisible) {
                this.onJobStart(event.detail);
            }
        });

        this.aiManager.on('serviceRequestStart', (event) => {
            const L = this.getLang();
            this.updateStep(1, 'active', '📤');
            this.updateStatus(L.uploading, 10);
        });

        this.aiManager.on('serviceRequestSuccess', (event) => {
            const L = this.getLang();
            this.updateStep(1, 'completed', '✅');
            this.updateStep(2, 'active', '🔄');
            this.updateStatus(L.processing, 30);
        });

        this.aiManager.on('jobComplete', (event) => {
            this.onJobComplete(event.detail);
        });

        this.aiManager.on('jobError', (event) => {
            this.onJobError(event.detail);
        });

        this.aiManager.on('jobCancelled', (event) => {
            this.onJobCancelled(event.detail);
        });

        this.aiManager.on('jobProgress', (event) => {
            const { progress, status } = event.detail || {};
            if (typeof progress === 'number') {
                this.updateProgress(progress);
            }
            if (status) {
                this.updateStatus(status);
            }
        });
    }

    /**
     * 显示模态框
     * @param {string} serviceName - 服务名称
     * @param {File} imageFile - 图像文件
     */
    show(serviceName, imageFile) {
        const modal = document.getElementById('aiProcessingModal');
        if (!modal) return;

        this.currentService = serviceName;
        this.isVisible = true;

        // 设置服务信息
        this.updateServiceInfo(serviceName);
        this.refreshLangTexts();

        // 设置图像预览
        if (imageFile) {
            this.setImagePreview(imageFile);
        }

        // 重置状态
        this.resetModalState();

        // 启动计时器
        this.startTimer();

        // 显示模态框
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // 防止背景滚动

        console.log(`⏳ 显示处理模态框: ${serviceName}`);
    }

    /**
     * 隐藏模态框
     */
    hide() {
        const modal = document.getElementById('aiProcessingModal');
        if (!modal) return;

        modal.style.display = 'none';
        document.body.style.overflow = ''; // 恢复背景滚动

        this.isVisible = false;
        this.stopTimer();

        console.log('⏳ 隐藏处理模态框');
    }

    /**
     * 更新服务信息
     * @param {string} serviceName - 服务名称
     */
    updateServiceInfo(serviceName) {
        const L = this.getLang();
        const serviceInfoMap = {
            backgroundRemoval: { icon: '✂️', name: L.aiNames.backgroundRemoval, description: L.processing },
            openAiImage: { icon: '🔍', name: L.aiNames.openAiImage, description: L.processing },
            animeStyleTransfer: { icon: '🎨', name: L.aiNames.animeStyleTransfer, description: L.processing },
            outlineExtraction: { icon: '🖊️', name: L.aiNames.outlineExtraction, description: L.processing }
        };

        const serviceInfo = serviceInfoMap[serviceName] || {
            icon: '🤖',
            name: 'AI处理',
            description: '正在处理您的图像...'
        };

        const serviceIcon = document.getElementById('serviceIcon');
        const serviceNameEl = document.getElementById('serviceName');
        const serviceDesc = document.getElementById('serviceDescription');
        const title = document.getElementById('processingTitle');

        if (serviceIcon) serviceIcon.textContent = serviceInfo.icon;
        if (serviceNameEl) serviceNameEl.textContent = serviceInfo.name;
        if (serviceDesc) serviceDesc.textContent = serviceInfo.description;
        if (title) title.textContent = `${serviceInfo.name}${L.titleSuffix}`;
    }

    /**
     * 设置图像预览
     * @param {File} imageFile - 图像文件
     */
    setImagePreview(imageFile) {
        const previewImg = document.getElementById('previewImage');
        if (previewImg && imageFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
            };
            reader.readAsDataURL(imageFile);
        }
    }

    /**
     * 重置模态框状态
     */
    resetModalState() {
        // 重置进度
        this.updateProgress(0);
        this.updateStatus(this.getLang().processing, 0);

        // 重置步骤
        this.resetSteps();

        // 隐藏错误信息
        const errorSection = document.getElementById('errorSection');
        if (errorSection) {
            errorSection.style.display = 'none';
        }

        // 显示取消按钮，隐藏关闭按钮
        const cancelBtn = document.getElementById('cancelProcessing');
        const closeBtn = document.getElementById('closeModal');

        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (closeBtn) closeBtn.style.display = 'none';
    }

    /**
     * 重置处理步骤
     */
    resetSteps() {
        for (let i = 1; i <= 3; i++) {
            this.updateStep(i, 'pending', '⏳');
        }
    }

    /**
     * 更新处理步骤
     * @param {number} stepNumber - 步骤编号
     * @param {string} status - 状态 (pending, active, completed, failed)
     * @param {string} icon - 图标
     */
    updateStep(stepNumber, status, icon) {
        const step = document.getElementById(`step${stepNumber}`);
        if (!step) return;

        const statusIcon = step.querySelector('.step-status');
        if (statusIcon) {
            statusIcon.textContent = icon;
        }

        // 移除所有状态类
        step.classList.remove('pending', 'active', 'completed', 'failed');
        step.classList.add(status);
    }

    /**
     * 更新进度
     * @param {number} percent - 进度百分比
     */
    updateProgress(percent) {
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');

        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }

        if (progressPercent) {
            progressPercent.textContent = `${Math.round(percent)}%`;
        }
    }

    /**
     * 更新状态文本
     * @param {string} status - 状态文本
     * @param {number} progress - 进度百分比
     */
    updateStatus(status, progress) {
        const progressStatus = document.getElementById('progressStatus');
        if (progressStatus) {
            progressStatus.textContent = status;
        }

        if (progress !== undefined) {
            this.updateProgress(progress);
        }
    }

    /**
     * 启动计时器
     */
    startTimer() {
        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            this.updateElapsedTime();
        }, 1000);
    }

    /**
     * 停止计时器
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * 更新已用时间
     */
    updateElapsedTime() {
        if (!this.startTime) return;

        const elapsed = Date.now() - this.startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);

        const elapsedTimeEl = document.getElementById('elapsedTime');
        if (elapsedTimeEl) {
            elapsedTimeEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * 任务开始回调
     * @param {Object} detail - 事件详情
     */
    onJobStart(detail) {
        this.currentJobId = detail.jobId;
        console.log('⏳ 任务开始:', detail);
    }

    /**
     * 任务完成回调
     * @param {Object} detail - 事件详情
     */
    onJobComplete(detail) {
        console.log('✅ 任务完成:', detail);

        // 更新所有步骤为完成状态
        for (let i = 1; i <= 3; i++) {
            this.updateStep(i, 'completed', '✅');
        }

        this.updateStatus(this.getLang().done, 100);

        // 显示关闭按钮，隐藏取消按钮
        const cancelBtn = document.getElementById('cancelProcessing');
        const closeBtn = document.getElementById('closeModal');

        if (cancelBtn) cancelBtn.style.display = 'none';
        if (closeBtn) closeBtn.style.display = 'inline-block';

        this.stopTimer();

        // 根据配置决定是否自动关闭
        if (this.autoCloseOnSuccess) {
            setTimeout(() => {
                if (this.isVisible) {
                    this.hide();
                }
            }, this.autoCloseDelay);
        }
    }

    /**
     * 任务错误回调
     * @param {Object} detail - 事件详情
     */
    onJobError(detail) {
        console.error('❌ 任务错误:', detail);

        // 显示错误信息
        const errorSection = document.getElementById('errorSection');
        const errorText = document.getElementById('errorText');

        if (errorSection) errorSection.style.display = 'block';
        if (errorText) {
            errorText.textContent = detail.error.message || detail.error || this.getLang().failed;
        }

        // 更新当前步骤为失败状态
        const activeStep = document.querySelector('.step.active');
        if (activeStep) {
            const stepNumber = activeStep.id.replace('step', '');
            this.updateStep(parseInt(stepNumber), 'failed', '❌');
        }

        this.updateStatus(this.getLang().failed, 0);

        // 显示关闭按钮，隐藏取消按钮
        const cancelBtn = document.getElementById('cancelProcessing');
        const closeBtn = document.getElementById('closeModal');

        if (cancelBtn) cancelBtn.style.display = 'none';
        if (closeBtn) closeBtn.style.display = 'inline-block';

        this.stopTimer();
    }

    /**
     * 任务取消回调
     * @param {Object} detail - 事件详情
     */
    onJobCancelled(detail) {
        console.log('🚫 任务取消:', detail);

        this.updateStatus(this.getLang().cancelled, 0);
        this.stopTimer();
        this.hide();
    }

    /**
     * 取消处理
     */
    cancelProcessing() {
        if (this.currentJobId) {
            this.aiManager.cancelJob(this.currentJobId);
        } else {
            this.hide();
        }
    }

    getLang() {
        const lang = (window.cardDesigner?.currentLanguage === 'zh') ? 'zh' : 'en';
        return this.i18n[lang];
    }

    refreshLangTexts() {
        const L = this.getLang();
        const title = document.getElementById('processingTitle');
        if (title) title.textContent = L.processingTitle;
        const step1Text = document.getElementById('step1Text');
        const step2Text = document.getElementById('step2Text');
        const step3Text = document.getElementById('step3Text');
        if (step1Text) step1Text.textContent = L.uploadStep;
        if (step2Text) step2Text.textContent = L.processStep;
        if (step3Text) step3Text.textContent = L.downloadStep;
        const eta = document.getElementById('etaLabel');
        const elapsed = document.getElementById('elapsedLabel');
        if (eta) eta.textContent = L.etaLabel;
        if (elapsed) elapsed.textContent = L.elapsedLabel;
    }

    /**
     * 销毁模态框
     */
    destroy() {
        this.stopTimer();

        const modal = document.getElementById('aiProcessingModal');
        if (modal) {
            modal.remove();
        }

        console.log('⏳ AI处理模态框已销毁');
    }
}
