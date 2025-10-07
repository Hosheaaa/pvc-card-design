/**
 * AI模块加载器 - 零修改集成方案
 * 通过覆盖和扩展现有功能，无需修改原有script.js
 */

(function() {
    'use strict';

    console.log('🤖 AI模块加载器启动...');

    const AI_ASSET_VERSION = (typeof window !== 'undefined' && window.__AI_ASSET_VERSION__) || '20240924T1100';
    if (typeof window !== 'undefined') {
        window.__AI_ASSET_VERSION__ = AI_ASSET_VERSION;
        window.__aiWithVersion = function(path) {
            if (!path) return path;
            const hasQuery = path.includes('?');
            const suffix = `v=${AI_ASSET_VERSION}`;
            if (hasQuery) {
                return path.includes('v=') ? path : `${path}&${suffix}`;
            }
            return `${path}?${suffix}`;
        };
    }
    const withVersion = (path) => {
        if (typeof window === 'undefined') return path;
        if (typeof window.__aiWithVersion === 'function') {
            return window.__aiWithVersion(path);
        }
        return path;
    };

    // 等待现有CardDesigner完全初始化
    function waitForCardDesigner() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (window.cardDesigner && window.cardDesigner.init) {
                    clearInterval(checkInterval);
                    resolve(window.cardDesigner);
                }
            }, 100);

            // 最多等待10秒
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve(null);
            }, 10000);
        });
    }

    // AI功能增强器
    class AIEnhancer {
        constructor(originalCardDesigner) {
            this.original = originalCardDesigner;
            this.aiManager = null;
            this.isEnabled = false;

            // 内联文案（中英）
            this.i18n = {
                zh: {
                    hint: '上传图片后可以使用AI进行人像抠图、拓展至卡片大小、动漫化、扣轮廓',
                    title: 'AI 图像工具',
                    btnBG: '✂️ 人像抠图',
                    btnEXP: '🔍 拓展至卡片大小',
                    btnANIME: '🎨 动漫化',
                    btnOUTLINE: '🖊️ 扣轮廓',
                    selectImgFirst: '请先在卡片上选择一张图片。',
                    mockNotice: 'AI服务不可用，当前走演示流程。',
                    fail: '处理失败，请重试。'
                },
                en: {
                    hint: 'After uploading, you can use AI for portrait cutout, expand to card size, anime style, and outline extraction.',
                    title: 'AI Image Tools',
                    btnBG: '✂️ Portrait Cutout',
                    btnEXP: '🔍 Expand to Card Size',
                    btnANIME: '🎨 Anime Style',
                    btnOUTLINE: '🖊️ Outline Extraction',
                    selectImgFirst: 'Please select an image on the card first.',
                    mockNotice: 'AI service unavailable, running demo flow.',
                    fail: 'Processing failed, please try again.'
                }
            };

            this.enhance();
        }

        getLang() {
            const lang = this.original?.currentLanguage === 'zh' ? 'zh' : 'en';
            return this.i18n[lang];
        }

        async enhance() {
            try {
                // 检查功能开关
                const { isAIFeatureEnabled } = await import(withVersion('./config/feature-flags.js'));

                if (!isAIFeatureEnabled('aiToolsEnabled')) {
                    console.log('ℹ️ AI功能未启用');
                    return;
                }

                // 加载AI管理器
                const { AIManager } = await import(withVersion('./core/AIManager.js'));
                this.aiManager = new AIManager(this.original);
                // 移除独立AI面板，改为注入到图片属性面板
                this.aiManager.on?.('initialized', () => {
                    try {
                        if (this.aiManager.toolsPanel) {
                            this.aiManager.toolsPanel.destroy();
                            this.aiManager.toolsPanel = null;
                        }
                        // 仍保留 ProcessingModal 以显示进度
                    } catch (e) { console.warn('移除独立AI面板失败:', e); }
                });

                // 增强现有方法
                this.enhanceImageHandling();
                // AIToolsPanel 会自带 AI 标签，这里不重复插入
                this.addAIStyles();
                this.setupDOMObservers();
                this.decorateImageFeatureTab();
                this.injectInlineAIIntoImagePanel();

                this.isEnabled = true;
                console.log('✅ AI功能增强完成');

            } catch (error) {
                console.warn('⚠️ AI功能增强失败:', error);
            }
        }

        // 增强图像处理功能
        enhanceImageHandling() {
            // 保存原始方法
            const originalHandleFileSelect = this.original.handleFileSelect;
            const originalAddImageElement = this.original.addImageElement;

            // 增强文件选择处理
            if (originalHandleFileSelect) {
                this.original.handleFileSelect = (file) => {
                    // 调用原始方法
                    originalHandleFileSelect.call(this.original, file);
                    // 不再弹出独立AI提示，仅在Image属性面板使用AI
                };
            }

            // 增强元素添加
            if (originalAddImageElement) {
                this.original.addImageElement = (...args) => {
                    const result = originalAddImageElement.call(this.original, ...args);
                    return result;
                };
            }
        }

        // 删除：不再创建独立AI标签/面板

        // 动态加载AI样式
        async addAIStyles() {
            const styles = [
                './AI/styles/ai-tools.css',
                './AI/styles/processing.css'
            ];

            for (const styleUrl of styles) {
                if (!document.querySelector(`link[href="${styleUrl}"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = styleUrl;
                    document.head.appendChild(link);
                }
            }
        }

        // 已移除独立AI面板

        // 监听属性面板与标签栏的DOM变更，保证 Image 面板的 AI 内联控件稳定
        setupDOMObservers() {
            let ensuring = false;
            const ensure = () => {
                if (ensuring) return;
                ensuring = true;
                try {
                    // 确保 Image 面板中 AI 注入存在
                    this.decorateImageFeatureTab();
                    this.injectInlineAIIntoImagePanel();
                } catch (e) {
                    console.warn('AI ensureMounted 失败:', e);
                } finally {
                    setTimeout(() => { ensuring = false; }, 0);
                }
            };

            const panel = document.querySelector('.properties-panel');
            const tabs = document.querySelector('.feature-tabs');
            if (panel) {
                const mo = new MutationObserver(() => ensure());
                mo.observe(panel, { childList: true, subtree: true });
            }
            if (tabs) {
                const mo2 = new MutationObserver(() => ensure());
                mo2.observe(tabs, { childList: true, subtree: true });
            }

            const start = Date.now();
            const it = setInterval(() => {
                ensure();
                if (Date.now() - start > 5000) clearInterval(it);
            }, 300);
        }

        // 在 Image 功能标签上追加 (AI+)
        decorateImageFeatureTab() {
            const imgTab = document.querySelector('.feature-tabs [data-feature="image"]');
            if (imgTab && !imgTab.querySelector('.ai-badge')) {
                const span = document.createElement('span');
                span.className = 'ai-badge';
                span.textContent = 'AI+';
                imgTab.appendChild(span);
            }
        }

        // 在 image 属性面板中注入 AI inline 控件和提示
        injectInlineAIIntoImagePanel() {
            const imagePanel = document.getElementById('imageProperties');
            if (!imagePanel) return;

            // 提示文字（上传区下方）
            const uploadSection = imagePanel.querySelector('#uploadSection');
            if (uploadSection && !uploadSection.querySelector('.ai-inline-hint')) {
                const hint = document.createElement('p');
                hint.className = 'ai-inline-hint';
                hint.textContent = this.getLang().hint;
                uploadSection.appendChild(hint);
            }
            // 若已存在，刷新文案（应对语言切换）
            const hintExist = uploadSection && uploadSection.querySelector('.ai-inline-hint');
            if (hintExist) hintExist.textContent = this.getLang().hint;

            // Inline 控制区域（放在 imagePropertiesPanel 之前）
            if (!imagePanel.querySelector('.ai-inline-controls')) {
                const container = document.createElement('div');
                container.className = 'ai-inline-controls';
                const L = this.getLang();
                container.innerHTML = `
                    <div class="ai-inline-title">${L.title}</div>
                    <div class="ai-inline-buttons">
                        <button class="ai-inline-btn ai-bg" data-ai-action="background-removal">${L.btnBG}</button>
                        <button class="ai-inline-btn ai-exp" data-ai-action="openai-image">${L.btnEXP}</button>
                        <button class="ai-inline-btn ai-anime" data-ai-action="anime-style">${L.btnANIME}</button>
                        <button class="ai-inline-btn ai-outline" data-ai-action="outline-extraction">${L.btnOUTLINE}</button>
                    </div>
                `;
                // 插入到上传区之后
                if (uploadSection && uploadSection.parentNode) {
                    uploadSection.parentNode.insertBefore(container, uploadSection.nextSibling);
                } else {
                    imagePanel.appendChild(container);
                }

                container.addEventListener('click', async (e) => {
                    const btn = e.target.closest('[data-ai-action]');
                    if (!btn) return;
                    const action = btn.getAttribute('data-ai-action');
                    const sel = this.original && this.original.selectedElement;
                    if (!sel || !sel.classList || !sel.classList.contains('image-element')) {
                        alert(this.getLang().selectImgFirst);
                        return;
                    }
                    try {
                        const file = await this.imageElementToFile(sel);
                        const map = {
                            'background-removal': 'backgroundRemoval',
                            'openai-image': 'openAiImage',
                            'anime-style': 'animeStyleTransfer',
                            'outline-extraction': 'outlineExtraction'
                        };
                        const service = map[action];
                        if (service && this.aiManager?.ensureServiceLoaded) {
                            await this.aiManager.ensureServiceLoaded(service);
                        }
                        // 统一构建请求选项（隐藏提示词按服务注入）
                        const options = {};
                        if (service) {
                            const { getFixedPrompt } = await import(withVersion('./config/prompt-presets.js'));
                            let prompt = getFixedPrompt(service, 'en');

                            // 针对扩图：使用当前卡片预览区域的精确像素尺寸，注入明确输出尺寸
                            if (service === 'openAiImage') {
                                const activeContent = document.querySelector('.card.active .card-content');
                                if (activeContent) {
                                    const rect = activeContent.getBoundingClientRect();
                                    const W = Math.max(1, Math.round(rect.width));
                                    const H = Math.max(1, Math.round(rect.height));
                                    prompt = `Outpaint the image to exactly ${W}x${H} pixels to fill the card canvas (full-bleed, no borders). Keep the same style, color tone and fine details, with seamless edges.`;
                                    // 附带目标尺寸，便于后端严格控制
                                    options.additionalParams = {
                                        ...(options.additionalParams || {}),
                                        target_width: Math.max(64, Math.round(W)),
                                        target_height: Math.max(64, Math.round(H)),
                                        background_mode: 'extend'
                                    };
                                }
                            }

                            if (service === 'outlineExtraction') {
                                options.additionalParams = {
                                    ...(options.additionalParams || {}),
                                    background_mode: 'transparent'
                                };
                            }

                            if (prompt) {
                                if (service === 'openAiImage' || service === 'animeStyleTransfer' || service === 'outlineExtraction') {
                                    options.prompt = prompt;
                                } else {
                                    options.additionalParams = { ...(options.additionalParams || {}), prompt };
                                }
                            }
                        }
                        const status = service ? this.aiManager?.getServiceStatus?.(service) : null;
                        console.log('[AI-inline] service status', service, status);
                        if (!service || !(status && status.available)) {
                            // 在开发或未启用时，给出提示
                            alert(this.getLang().mockNotice);
                            // 演示：直接用原始图
                            const imgNode = sel.matches('img') ? sel : sel.querySelector('img');
                            if (imgNode && file) {
                                const reader = new FileReader();
                                reader.onload = () => this.replaceSelectedImage(sel, reader.result);
                                reader.readAsDataURL(file);
                            }
                            return;
                        }
                        // 显示处理进度模态框
                        if (this.aiManager?.processingModal) {
                            this.aiManager.processingModal.show(service, file);
                        }
                        const { result } = await this.aiManager.processImage(service, file, options);
                        const dataURL = result?.processedDataURL || result?.processedURL;
                        if (dataURL) this.replaceSelectedImage(sel, dataURL, { service });
                    } catch (err) {
                        console.error('AI inline 处理失败:', err);
                        alert(this.getLang().fail);
                    }
                });
            }
            // 刷新已存在容器的文案（语言切换）
            const exist = imagePanel.querySelector('.ai-inline-controls');
            if (exist) {
                const L = this.getLang();
                const title = exist.querySelector('.ai-inline-title');
                const btnBG = exist.querySelector('[data-ai-action="background-removal"]');
                const btnEXP = exist.querySelector('[data-ai-action="openai-image"]');
                const btnANIME = exist.querySelector('[data-ai-action="anime-style"]');
                const btnOUTLINE = exist.querySelector('[data-ai-action="outline-extraction"]');
                if (title) title.textContent = L.title;
                if (btnBG) btnBG.textContent = L.btnBG;
                if (btnEXP) btnEXP.textContent = L.btnEXP;
                if (btnANIME) btnANIME.textContent = L.btnANIME;
                if (btnOUTLINE) btnOUTLINE.textContent = L.btnOUTLINE;
            }
        }

        fitImageElementToCanvas(imageElement) {
            try {
                if (!imageElement) return;
                const cardContent = imageElement.closest('.card-content');
                if (!cardContent) return;

                const width = Math.round(cardContent.clientWidth || cardContent.offsetWidth || 0);
                const height = Math.round(cardContent.clientHeight || cardContent.offsetHeight || 0);
                if (!width || !height) return;

                imageElement.style.left = '0px';
                imageElement.style.top = '0px';
                imageElement.style.width = `${width}px`;
                imageElement.style.height = `${height}px`;

                const img = imageElement.querySelector('img');
                if (img) {
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.objectFit = 'cover';
                    img.style.objectPosition = 'center';
                }

                if (this.original?.updateElementSerializableData) {
                    this.original.updateElementSerializableData(imageElement);
                }

                if (this.original?.selectedElement === imageElement) {
                    const widthInput = document.getElementById('imageWidth');
                    const heightInput = document.getElementById('imageHeight');
                    const xInput = document.getElementById('imageX');
                    const yInput = document.getElementById('imageY');
                    if (widthInput) widthInput.value = width;
                    if (heightInput) heightInput.value = height;
                    if (xInput) xInput.value = 0;
                    if (yInput) yInput.value = 0;
                }
            } catch (error) {
                console.warn('AI auto-fit failed:', error);
            }
        }

        // 替换选中的图片，并更新其序列化数据
        replaceSelectedImage(imageElement, dataURL, metadata = {}) {
            const imgNode = imageElement && (imageElement.matches?.('img') ? imageElement : imageElement.querySelector('img'));
            if (imgNode) {
                // 在设置 src 之前挂载 onload，以便在图片加载后执行二值化
                const applyEngraveIfNeeded = () => {
                    try {
                        const material = this.original?.currentMaterial;
                        const side = this.original?.currentSide;
                        if (material === 'wood' && typeof this.original?.applyWoodEngravingEffect === 'function') {
                            this.original.applyWoodEngravingEffect(imgNode);
                        } else if (material === 'metal' && side !== 'back' && typeof this.original?.applyMetalEngravingEffect === 'function') {
                            this.original.applyMetalEngravingEffect(imgNode);
                        }
                    } catch (_) { /* ignore */ }
                };
                imgNode.onload = () => {
                    applyEngraveIfNeeded();
                    if (metadata?.service === 'openAiImage') {
                        this.fitImageElementToCanvas(imageElement);
                    }
                    imgNode.onload = null; // 清理
                };
                imgNode.src = dataURL;
                if (metadata?.service === 'openAiImage') {
                    this.fitImageElementToCanvas(imageElement);
                }
                // 如浏览器立即完成加载（极少数情况下），兜底执行
                if (imgNode.complete) {
                    applyEngraveIfNeeded();
                    if (metadata?.service === 'openAiImage') {
                        this.fitImageElementToCanvas(imageElement);
                    }
                }
            }
            try {
                const side = this.original?.currentSide;
                const list = this.original?.elements?.[side] || [];
                const rec = list.find(el => el && el.element === imageElement);
                if (rec) {
                    const previousSrc = rec.data?.src || rec.serializable?.src;
                    const service = metadata?.service;

                    if (rec.data) {
                        if (!rec.data.originalSrc && previousSrc) {
                            rec.data.originalSrc = previousSrc;
                        }
                        rec.data.src = dataURL;
                        if (!rec.data.aiGenerated) {
                            rec.data.aiGenerated = {};
                        }
                        if (service) {
                            rec.data.aiGenerated[service] = dataURL;
                        }
                    }

                    if (rec.serializable) {
                        if (!rec.serializable.originalSrc && previousSrc) {
                            rec.serializable.originalSrc = previousSrc;
                        }
                        rec.serializable.src = dataURL;
                        if (!rec.serializable.aiGenerated) {
                            rec.serializable.aiGenerated = {};
                        }
                        if (service) {
                            rec.serializable.aiGenerated[service] = dataURL;
                        }
                    }
                }
                // 可选：记录一次历史，便于撤销/重做
                if (this.original?.historyManager?.recordAction) {
                    this.original.historyManager.recordAction();
                }
            } catch (_) { /* ignore */ }
        }

        // 为图像提供AI处理选项
        // 已移除：上传后悬浮提示入口

        // 为图像元素添加AI右键菜单
        // 已移除：右键菜单入口，仅保留属性面板内联入口

        // 显示图像AI菜单
        // 已移除：右键菜单构建

        // 使用AI处理图像
        // 已移除右键菜单触发的图像处理入口（仅保留属性面板内联入口）

        // 将图像元素转换为文件对象
        async imageElementToFile(imageElement) {
            const imgNode = imageElement && (imageElement.matches?.('img') ? imageElement : imageElement.querySelector('img'));
            const src = imgNode?.src || imageElement?.src;
            if (!src) throw new Error('未找到图像源');

            // DataURL 直接转 Blob
            if (src.startsWith('data:')) {
                const res = await fetch(src);
                const blob = await res.blob();
                return new File([blob], 'image.png', { type: blob.type || 'image/png' });
            }

            // 其他URL：尝试直接获取 Blob
            try {
                const res = await fetch(src, { mode: 'cors' });
                const blob = await res.blob();
                return new File([blob], 'image.png', { type: blob.type || 'image/png' });
            } catch (e) {
                // 退化到 Canvas（可能跨域失败）
                return new Promise((resolve, reject) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        ctx.drawImage(img, 0, 0);
                        canvas.toBlob((blob) => {
                            if (blob) resolve(new File([blob], 'image.png', { type: 'image/png' }));
                            else reject(new Error('无法转换图像'));
                        }, 'image/png');
                    };
                    img.onerror = () => reject(new Error('图像加载失败'));
                    img.src = src;
                });
            }
        }

        // 已移除：全局提示气泡与 toast，保持界面简洁
    }

    // 主初始化流程
    async function initializeAI() {
        try {
            console.log('⏳ 等待CardDesigner初始化...');

            const cardDesigner = await waitForCardDesigner();

            if (!cardDesigner) {
                console.warn('⚠️ CardDesigner未找到，AI增强跳过');
                return;
            }

            console.log('✅ CardDesigner已找到，开始AI增强');

            // 创建AI增强器
            const aiEnhancer = new AIEnhancer(cardDesigner);

            // 将AI增强器附加到全局，便于调试
            window.aiEnhancer = aiEnhancer;

            console.log('🎉 AI模块加载完成！');

        } catch (error) {
            console.error('❌ AI模块加载失败:', error);
        }
    }

    // 当DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAI);
    } else {
        // DOM已经加载完成
        initializeAI();
    }

})();
