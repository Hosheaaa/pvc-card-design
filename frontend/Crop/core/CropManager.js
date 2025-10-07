import { CropModal } from '../ui/CropModal.js';

const DEFAULT_ASSET_VERSION = '20241005T0900';

export class CropManager {
    constructor(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.assetVersion = window.__CROP_ASSET_VERSION__ || DEFAULT_ASSET_VERSION;
        this.sectionNode = null;
        this.buttonNode = null;
        this.modal = null;
        this.isOpening = false;
        this.observer = null;
        this.observerTarget = null;
        this.selectionPatched = false;
        this.languagePatched = false;
        this.propertiesPatched = false;
        this.stylesLoaded = false;

        this.i18n = {
            en: {
                button: 'Crop Image',
                buttonDisabledHint: 'Select an image element to enable cropping.',
                modal: {
                    title: 'Crop Image',
                    shapeTitle: 'Crop shape',
                    shapeRectangle: 'Rectangle',
                    shapeRounded: 'Rounded rectangle',
                    shapeCircle: 'Circle',
                    zoomTitle: 'Image zoom',
                    outlineTitle: 'Outline',
                    outlineToggle: 'Enable outline',
                    outlineColor: 'Color',
                    outlineWidth: 'Stroke width',
                    cancel: 'Cancel',
                    confirm: 'Apply crop',
                    loading: 'Loading image...'
                },
                selectImageHint: 'Please select an image on the card first.'
            },
            zh: {
                button: '裁剪图片',
                buttonDisabledHint: '请先在卡片上选择要裁剪的图片元素。',
                modal: {
                    title: '裁剪图片',
                    shapeTitle: '裁剪形状',
                    shapeRectangle: '直角矩形',
                    shapeRounded: '圆角矩形',
                    shapeCircle: '圆形',
                    zoomTitle: '图片缩放',
                    outlineTitle: '轮廓线',
                    outlineToggle: '启用轮廓线',
                    outlineColor: '颜色',
                    outlineWidth: '线条粗细',
                    cancel: '取消',
                    confirm: '应用裁剪',
                    loading: '加载图片...'
                },
                selectImageHint: '请先在卡片上选择需要裁剪的图片。'
            }
        };

        this.init();
    }

    init() {
        if (!this.cardDesigner) {
            console.warn('[CropManager] cardDesigner instance missing');
            return;
        }
        this.ensureStyles();
        this.patchSelectionHooks();
        this.patchLanguageHooks();
        this.patchPropertiesHook();
        this.setupObservers();
        this.injectCropTrigger();
        this.updateButtonState();
    }

    ensureStyles() {
        if (this.stylesLoaded) {
            return;
        }
        const existing = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(link => {
            return typeof link.href === 'string' && link.href.includes('Crop/styles/crop-modal.css');
        });
        if (existing) {
            this.stylesLoaded = true;
            return;
        }
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        const base = 'Crop/styles/crop-modal.css';
        link.href = this.assetVersion ? `${base}?v=${this.assetVersion}` : base;
        document.head.appendChild(link);
        this.stylesLoaded = true;
    }

    patchSelectionHooks() {
        if (this.selectionPatched) {
            return;
        }
        const designer = this.cardDesigner;
        const manager = this;
        const originalSelect = typeof designer.selectElement === 'function' ? designer.selectElement.bind(designer) : null;
        if (originalSelect) {
            designer.selectElement = function selectElementPatched(...args) {
                const result = originalSelect(...args);
                manager.defer(() => {
                    manager.updateButtonState();
                });
                return result;
            };
        }

        const originalDeselect = typeof designer.deselectElement === 'function' ? designer.deselectElement.bind(designer) : null;
        if (originalDeselect) {
            designer.deselectElement = function deselectElementPatched(...args) {
                const result = originalDeselect(...args);
                manager.defer(() => {
                    manager.updateButtonState();
                });
                return result;
            };
        }
        this.selectionPatched = true;
    }

    patchLanguageHooks() {
        if (this.languagePatched) {
            return;
        }
        const designer = this.cardDesigner;
        const manager = this;
        const originalUpdateLanguage = typeof designer.updateLanguage === 'function' ? designer.updateLanguage.bind(designer) : null;
        if (originalUpdateLanguage) {
            designer.updateLanguage = function updateLanguagePatched(...args) {
                const result = originalUpdateLanguage(...args);
                manager.defer(() => {
                    manager.syncLanguage();
                });
                return result;
            };
        }
        this.languagePatched = true;
    }

    patchPropertiesHook() {
        if (this.propertiesPatched) {
            return;
        }
        const designer = this.cardDesigner;
        const manager = this;
        const originalUpdateProperties = typeof designer.updatePropertiesPanel === 'function' ? designer.updatePropertiesPanel.bind(designer) : null;
        if (originalUpdateProperties) {
            designer.updatePropertiesPanel = function updatePropertiesPanelPatched(...args) {
                const result = originalUpdateProperties(...args);
                manager.defer(() => {
                    manager.injectCropTrigger();
                    manager.updateButtonState();
                });
                return result;
            };
        }
        this.propertiesPatched = true;
    }

    setupObservers() {
        const target = document.getElementById('imageProperties');
        if (!target) {
            setTimeout(() => this.setupObservers(), 400);
            return;
        }
        if (this.observer) {
            return;
        }
        this.observer = new MutationObserver(() => {
            this.handleObservedMutations();
        });
        this.observerTarget = target;
        this.observer.observe(target, { childList: true, subtree: true });
    }

    handleObservedMutations() {
        if (!this.observer || !this.observerTarget) {
            return;
        }
        this.observer.disconnect();
        try {
            this.injectCropTrigger();
            this.updateButtonState();
        } finally {
            this.observer.observe(this.observerTarget, { childList: true, subtree: true });
        }
    }

    injectCropTrigger() {
        const panel = document.getElementById('imagePropertiesPanel');
        if (!panel) {
            return;
        }
        const existing = panel.querySelector('[data-crop-section="true"]');
        if (existing) {
            this.sectionNode = existing;
            this.buttonNode = existing.querySelector('.crop-trigger-btn');
            this.syncLanguage();
            return;
        }

        const section = document.createElement('div');
        section.className = 'property-section crop-trigger-section';
        section.dataset.cropSection = 'true';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'crop-trigger-btn';
        button.addEventListener('click', () => this.handleOpenCropper());
        section.appendChild(button);

        this.sectionNode = section;
        this.buttonNode = button;
        const firstSection = Array.from(panel.children).find(child => child.classList && child.classList.contains('property-section'));
        if (firstSection) {
            panel.insertBefore(section, firstSection);
        } else {
            panel.appendChild(section);
        }
        this.syncLanguage();
        this.updateButtonState();
    }

    handleOpenCropper() {
        if (this.isOpening) {
            return;
        }
        const element = this.cardDesigner?.selectedElement;
        if (!element || !element.classList.contains('image-element')) {
            this.notify(this.getLangPack().selectImageHint);
            return;
        }

        const recordInfo = this.findElementRecord(element);
        if (!recordInfo) {
            this.notify('Unable to locate image data for cropping.');
            return;
        }

        const baseSrc = this.resolveBaseSource(recordInfo.record, element);
        if (!baseSrc) {
            this.notify('Original image data is missing, unable to crop.');
            return;
        }

        const existingConfig = recordInfo.record.data?.cropConfig || recordInfo.record.serializable?.cropConfig || null;
        this.isOpening = true;
        this.buttonNode && (this.buttonNode.disabled = true);

        this.modal = new CropModal({
            element,
            baseSrc,
            existingConfig,
            i18n: this.getModalI18n(),
            onConfirm: (result) => {
                this.applyCropResult(recordInfo, result);
                this.handleModalClosed();
            },
            onCancel: () => {
                this.handleModalClosed();
            }
        });
        this.modal.open();
    }

    handleModalClosed() {
        this.modal = null;
        this.isOpening = false;
        this.updateButtonState();
    }

    applyCropResult(recordInfo, result) {
        if (!result || !result.dataUrl || !recordInfo || !recordInfo.record) {
            return;
        }
        const element = recordInfo.record.element;
        const img = element?.querySelector('img');
        if (!img) {
            return;
        }

        const dataUrl = result.dataUrl;
        try {
            img.src = dataUrl;
        } catch (error) {
            console.warn('[CropManager] failed to update image src after crop', error);
            return;
        }

        const record = recordInfo.record;
        const recordData = record.data || (record.data = {});
        const recordSerializable = record.serializable || (record.serializable = {});
        const baseSrc = result.baseSrc || recordData.cropOriginalSrc || recordData.originalSrc || dataUrl;

        if (!recordData.cropOriginalSrc) {
            recordData.cropOriginalSrc = baseSrc;
        }
        recordData.src = dataUrl;
        recordData.croppedSrc = dataUrl;
        recordData.cropConfig = result.cropConfig;

        if (!recordSerializable.cropOriginalSrc) {
            recordSerializable.cropOriginalSrc = baseSrc;
        }
        recordSerializable.src = dataUrl;
        recordSerializable.cropConfig = result.cropConfig;

        try {
            element.dataset.cropConfig = JSON.stringify(result.cropConfig);
        } catch (_) {
            element.dataset.cropConfig = '';
        }
        element.dataset.cropped = 'true';

        if (typeof this.cardDesigner.updateElementSerializableData === 'function') {
            this.cardDesigner.updateElementSerializableData(element);
        }

        this.cardDesigner.historyManager?.recordAction?.();
        this.cardDesigner.updatePropertiesPanel?.(element);
    }

    resolveBaseSource(record, element) {
        const img = element?.querySelector('img');
        const candidates = [
            record.data?.cropOriginalSrc,
            record.serializable?.cropOriginalSrc,
            img?.dataset?.originalSrc,
            img?.getAttribute?.('data-original-src'),
            img?.src,
            record.data?.originalSrc,
            record.serializable?.originalSrc
        ];
        return candidates.find(src => typeof src === 'string' && src.length > 0) || null;
    }

    findElementRecord(element) {
        if (!element || !this.cardDesigner?.elements) {
            return null;
        }
        const sides = Object.keys(this.cardDesigner.elements);
        for (const side of sides) {
            const list = this.cardDesigner.elements[side] || [];
            const found = list.find(entry => entry && entry.element === element);
            if (found) {
                return { side, record: found };
            }
        }
        return null;
    }

    updateButtonState() {
        const button = this.buttonNode;
        if (!button) {
            return;
        }
        const element = this.cardDesigner?.selectedElement;
        const isImage = !!(element && element.classList && element.classList.contains('image-element'));
        button.disabled = !isImage || this.isOpening;
        const label = this.getLangPack().button;
        button.innerHTML = `<span class="icon">✂️</span><span>${label}</span>`;
        if (!isImage) {
            button.title = this.getLangPack().buttonDisabledHint;
        } else {
            button.title = '';
        }
    }

    syncLanguage() {
        const section = this.sectionNode;
        const button = this.buttonNode;
        if (!section || !button) {
            return;
        }
        const label = this.getLangPack().button;
        button.innerHTML = `<span class="icon">✂️</span><span>${label}</span>`;
        button.title = button.disabled ? this.getLangPack().buttonDisabledHint : '';
    }

    getLangKey() {
        return this.cardDesigner?.currentLanguage === 'zh' ? 'zh' : 'en';
    }

    getLangPack() {
        const key = this.getLangKey();
        return this.i18n[key] || this.i18n.en;
    }

    getModalI18n() {
        const pack = this.getLangPack();
        return pack.modal || this.i18n.en.modal;
    }

    notify(message) {
        if (this.cardDesigner?.errorHandler?.showNotification) {
            this.cardDesigner.errorHandler.showNotification(message, 'info', 3200);
            return;
        }
        console.warn('[CropManager]', message);
    }

    defer(fn) {
        setTimeout(() => {
            try {
                fn();
            } catch (error) {
                console.warn('[CropManager] deferred task failed', error);
            }
        }, 0);
    }
}
