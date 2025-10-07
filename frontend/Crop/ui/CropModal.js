const CARD_CORNER_RATIO = 12 / 500;

const clamp = (value, min, max) => {
    if (Number.isNaN(value)) {
        return min;
    }
    if (min > max) {
        return min;
    }
    return Math.max(min, Math.min(max, value));
};

export class CropModal {
    constructor({ element, baseSrc, existingConfig, i18n, onConfirm, onCancel }) {
        this.element = element;
        this.baseSrc = baseSrc;
        this.existingConfig = existingConfig || {};
        this.i18n = i18n || {};
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;

        this.overlay = null;
        this.modal = null;
        this.previewFrameEl = null;
        this.maskHoleEl = null;
        this.imageEl = null;
        this.viewportEl = null;
        this.loadingIndicator = null;

        this.shapeButtons = [];
        this.zoomInput = null;
        this.zoomValueEl = null;
        this.outlineCheckbox = null;
        this.outlineColorInput = null;
        this.outlineWidthInput = null;
        this.outlineOptionsEl = null;
        this.confirmBtn = null;
        this.cancelBtn = null;
        this.titleEl = null;
        this.shapeTitleEl = null;
        this.zoomTitleEl = null;
        this.outlineTitleEl = null;
        this.outlineToggleLabelEl = null;

        this.originalImage = null;
        this.frameWidth = 0;
        this.frameHeight = 0;
        this.previewScale = 1;
        this.minScale = 1;

        this.state = {
            scale: 1,
            offsetX: 0,
            offsetY: 0
        };
        this.minZoomScale = 0.1;
        this.maxZoomScale = 4;

        this.shape = this.existingConfig.shape || 'rectangle';
        this.outlineEnabled = this.existingConfig.outline?.enabled || false;
        this.outlineColor = this.existingConfig.outline?.color || '#ffffff';
        this.outlineWidth = 2;

        this.dragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragStartOffset = { x: 0, y: 0 };
        this.boundPointerMove = null;
        this.boundPointerUp = null;
        this.boundKeydown = null;
        this.destroyed = false;
        this.previousBodyOverflow = '';
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.maskOverlayColor = 'rgba(15, 23, 42, 0.6)';
        this.maskHoleBoxShadow = `0 0 0 9999px ${this.maskOverlayColor}`;
        this.maskHoleBorderStyle = '2px solid rgba(255, 255, 255, 0.65)';
    }

    async open() {
        try {
            if (!this.baseSrc) {
                throw new Error('No base image src for crop modal');
            }

            this.originalImage = await this.loadImage(this.baseSrc);
            this.configureFrame();
            this.buildModal();
            this.attachEvents();
            this.updateAllVisuals();
        } catch (error) {
            console.error('[CropModal] Failed to open', error);
            this.close();
            if (typeof this.onCancel === 'function') {
                this.onCancel('error');
            }
        }
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image for cropping'));
            img.src = src;
        });
    }

    configureFrame() {
        const fallbackWidth = 200;
        const fallbackHeight = 140;
        const numericWidth = parseFloat(this.element?.style?.width) || this.element?.offsetWidth || fallbackWidth;
        const numericHeight = parseFloat(this.element?.style?.height) || this.element?.offsetHeight || fallbackHeight;
        this.frameWidth = Math.max(20, numericWidth);
        this.frameHeight = Math.max(20, numericHeight);

        const naturalWidth = this.originalImage?.naturalWidth || this.originalImage?.width || this.frameWidth;
        const naturalHeight = this.originalImage?.naturalHeight || this.originalImage?.height || this.frameHeight;
        const safeNaturalWidth = Math.max(1, naturalWidth);
        const safeNaturalHeight = Math.max(1, naturalHeight);

        this.minScale = Math.max(this.frameWidth / safeNaturalWidth, this.frameHeight / safeNaturalHeight);
        this.minScale = Math.max(this.minScale, 0.1);
        this.minZoomScale = Math.max(this.minScale * 0.5, 0.1);
        this.maxZoomScale = Math.max(this.minScale + 2, this.minScale * 4);

        const existingScale = this.existingConfig.state?.scale;
        const baseScale = existingScale && Number.isFinite(existingScale) ? existingScale : this.minScale;
        this.state.scale = clamp(baseScale, this.minZoomScale, this.maxZoomScale);

        this.state.offsetX = this.existingConfig.state?.offsetX || 0;
        this.state.offsetY = this.existingConfig.state?.offsetY || 0;
        this.constrainOffsets();
    }

    buildModal() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'crop-modal-overlay';

        this.modal = document.createElement('div');
        this.modal.className = 'crop-modal';

        const header = document.createElement('div');
        header.className = 'crop-modal__header';

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'crop-modal__title';
        header.appendChild(this.titleEl);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'crop-modal__close';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => this.handleCancel());
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'crop-modal__body';

        const previewPanel = document.createElement('div');
        previewPanel.className = 'crop-preview-panel';

        const previewStage = document.createElement('div');
        previewStage.className = 'crop-preview-stage';

        this.previewFrameEl = document.createElement('div');
        this.previewFrameEl.className = 'crop-preview-frame';

        this.imageEl = document.createElement('img');
        this.imageEl.src = this.baseSrc;
        this.imageEl.alt = 'Crop preview';
        this.imageEl.draggable = false;

        this.viewportEl = document.createElement('div');
        this.viewportEl.className = 'crop-viewport';
        this.viewportEl.appendChild(this.imageEl);

        this.previewFrameEl.appendChild(this.viewportEl);

        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.className = 'crop-preview-loading';
        this.loadingIndicator.textContent = this.getText('loading', 'Loading image...');
        previewStage.appendChild(this.loadingIndicator);

        previewStage.appendChild(this.previewFrameEl);

        const maskLayer = document.createElement('div');
        maskLayer.className = 'crop-mask-layer';
        this.maskHoleEl = document.createElement('div');
        this.maskHoleEl.className = 'crop-mask-hole';
        maskLayer.appendChild(this.maskHoleEl);
        previewStage.appendChild(maskLayer);

        previewPanel.appendChild(previewStage);

        const controlsPanel = document.createElement('div');
        controlsPanel.className = 'crop-controls';

        const shapeGroup = document.createElement('div');
        shapeGroup.className = 'crop-control-group';
        this.shapeTitleEl = document.createElement('h4');
        shapeGroup.appendChild(this.shapeTitleEl);

        const shapeList = document.createElement('div');
        shapeList.className = 'crop-shape-list';

        const shapes = [
            { key: 'rectangle', icon: '▭', labelKey: 'shapeRectangle' },
            { key: 'rounded', icon: '▢', labelKey: 'shapeRounded' },
            { key: 'circle', icon: '◯', labelKey: 'shapeCircle' }
        ];

        shapes.forEach(({ key, labelKey }) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'crop-shape-btn';
            btn.dataset.shape = key;

            const icon = document.createElement('div');
            icon.className = 'shape-icon';
            btn.appendChild(icon);

            const label = document.createElement('span');
            label.textContent = this.getText(labelKey, key);
            btn.appendChild(label);

            btn.addEventListener('click', () => {
                this.shape = key;
                this.updateShapeButtons();
                this.updateShapeVisuals();
                this.updateOutlinePreview();
            });

            this.shapeButtons.push(btn);
            shapeList.appendChild(btn);
        });

        shapeGroup.appendChild(shapeList);
        controlsPanel.appendChild(shapeGroup);

        const zoomGroup = document.createElement('div');
        zoomGroup.className = 'crop-control-group';
        this.zoomTitleEl = document.createElement('h4');
        zoomGroup.appendChild(this.zoomTitleEl);

        const zoomReadout = document.createElement('div');
        zoomReadout.className = 'crop-zoom-readout';
        zoomReadout.appendChild(document.createElement('span'));
        this.zoomValueEl = document.createElement('span');
        zoomReadout.appendChild(this.zoomValueEl);
        zoomGroup.appendChild(zoomReadout);

        this.zoomInput = document.createElement('input');
        this.zoomInput.type = 'range';
        this.zoomInput.step = '0.01';
        zoomGroup.appendChild(this.zoomInput);
        controlsPanel.appendChild(zoomGroup);

        const outlineGroup = document.createElement('div');
        outlineGroup.className = 'crop-control-group';
        this.outlineTitleEl = document.createElement('h4');
        outlineGroup.appendChild(this.outlineTitleEl);

        const toggleRow = document.createElement('div');
        toggleRow.className = 'crop-toggle';
        this.outlineToggleLabelEl = document.createElement('label');
        this.outlineToggleLabelEl.htmlFor = 'cropOutlineToggle';
        toggleRow.appendChild(this.outlineToggleLabelEl);

        this.outlineCheckbox = document.createElement('input');
        this.outlineCheckbox.type = 'checkbox';
        this.outlineCheckbox.id = 'cropOutlineToggle';
        this.outlineCheckbox.checked = this.outlineEnabled;
        toggleRow.appendChild(this.outlineCheckbox);
        outlineGroup.appendChild(toggleRow);

        this.outlineOptionsEl = document.createElement('div');
        this.outlineOptionsEl.className = 'crop-outline-options';

        const colorGroup = document.createElement('div');
        colorGroup.className = 'crop-control-group';
        const colorLabel = document.createElement('label');
        colorLabel.htmlFor = 'cropOutlineColor';
        colorGroup.appendChild(colorLabel);
        this.outlineColorInput = document.createElement('input');
        this.outlineColorInput.type = 'color';
        this.outlineColorInput.id = 'cropOutlineColor';
        this.outlineColorInput.value = this.outlineColor;
        colorGroup.appendChild(this.outlineColorInput);
        this.outlineOptionsEl.appendChild(colorGroup);

        this.outlineWidthInput = null;

        outlineGroup.appendChild(this.outlineOptionsEl);
        controlsPanel.appendChild(outlineGroup);

        body.appendChild(previewPanel);
        body.appendChild(controlsPanel);

        const footer = document.createElement('div');
        footer.className = 'crop-modal__footer';

        this.cancelBtn = document.createElement('button');
        this.cancelBtn.type = 'button';
        this.cancelBtn.className = 'crop-btn crop-btn--secondary';
        this.cancelBtn.addEventListener('click', () => this.handleCancel());
        footer.appendChild(this.cancelBtn);

        this.confirmBtn = document.createElement('button');
        this.confirmBtn.type = 'button';
        this.confirmBtn.className = 'crop-btn crop-btn--primary';
        this.confirmBtn.addEventListener('click', () => this.handleConfirm());
        footer.appendChild(this.confirmBtn);

        this.modal.appendChild(header);
        this.modal.appendChild(body);
        this.modal.appendChild(footer);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }

    attachEvents() {
        if (!this.imageEl) {
            return;
        }
        this.boundPointerMove = (event) => this.handlePointerMove(event);
        this.boundPointerUp = (event) => this.handlePointerUp(event);

        this.imageEl.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        window.addEventListener('pointermove', this.boundPointerMove);
        window.addEventListener('pointerup', this.boundPointerUp);
        window.addEventListener('pointercancel', this.boundPointerUp);

        if (this.zoomInput) {
            this.zoomInput.addEventListener('input', () => this.handleZoomChange());
        }

        if (this.outlineCheckbox) {
            this.outlineCheckbox.addEventListener('change', () => {
                this.outlineEnabled = !!this.outlineCheckbox.checked;
                this.updateOutlineControlsState();
                this.updateOutlinePreview();
            });
        }

        if (this.outlineColorInput) {
            this.outlineColorInput.addEventListener('input', () => {
                this.outlineColor = this.outlineColorInput.value || '#ffffff';
                this.updateOutlinePreview();
            });
        }

        this.boundKeydown = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.handleCancel();
            }
        };
        window.addEventListener('keydown', this.boundKeydown);

        this.overlay.addEventListener('click', (event) => {
            if (event.target === this.overlay) {
                this.handleCancel();
            }
        });
    }

    updateAllVisuals() {
        this.updateTexts();
        this.updateZoomRange();
        this.updatePreviewDimensions();
        this.updateShapeButtons();
        this.updateShapeVisuals();
        this.updateOutlineControlsState();
        this.updateOutlinePreview();
        this.updateZoomLabel();
        this.updateImageTransform();
        if (this.loadingIndicator) {
            this.loadingIndicator.remove();
            this.loadingIndicator = null;
        }
    }

    updateTexts() {
        this.titleEl.textContent = this.getText('title', 'Crop Image');
        this.shapeTitleEl.textContent = this.getText('shapeTitle', 'Crop shape');
        this.zoomTitleEl.textContent = this.getText('zoomTitle', 'Image zoom');
        this.outlineTitleEl.textContent = this.getText('outlineTitle', 'Outline');
        this.outlineToggleLabelEl.textContent = this.getText('outlineToggle', 'Enable outline');
        this.cancelBtn.textContent = this.getText('cancel', 'Cancel');
        this.confirmBtn.textContent = this.getText('confirm', 'Apply');

        const colorLabel = this.outlineOptionsEl?.querySelector('label[for="cropOutlineColor"]');
        if (colorLabel) {
            colorLabel.textContent = this.getText('outlineColor', 'Color');
        }
        this.shapeButtons.forEach((btn) => {
            const key = btn.dataset.shape;
            const label = btn.querySelector('span');
            if (!label) {
                return;
            }
            if (key === 'rectangle') {
                label.textContent = this.getText('shapeRectangle', 'Rectangle');
            } else if (key === 'rounded') {
                label.textContent = this.getText('shapeRounded', 'Rounded');
            } else if (key === 'circle') {
                label.textContent = this.getText('shapeCircle', 'Circle');
            }
        });
    }

    updateZoomRange() {
        if (!this.zoomInput) {
            return;
        }
        const minScale = this.minZoomScale || Math.max(this.minScale * 0.5, 0.1);
        const maxScale = this.maxZoomScale || Math.max(this.minScale + 2, this.minScale * 4);
        this.zoomInput.min = minScale.toFixed(2);
        this.zoomInput.max = maxScale.toFixed(2);
        this.state.scale = clamp(this.state.scale, minScale, maxScale);
        this.zoomInput.value = this.state.scale.toFixed(2);
    }

    updatePreviewDimensions() {
        if (!this.previewFrameEl || !this.maskHoleEl) {
            return;
        }
        const maxWidth = 520;
        const maxHeight = 360;
        const widthScale = maxWidth / this.frameWidth;
        const heightScale = maxHeight / this.frameHeight;
        const scale = Math.min(4, widthScale, heightScale);
        this.previewScale = Math.max(scale, 0.25);
        const displayWidth = Math.round(this.frameWidth * this.previewScale);
        const displayHeight = Math.round(this.frameHeight * this.previewScale);
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        this.previewFrameEl.style.width = `${displayWidth}px`;
        this.previewFrameEl.style.height = `${displayHeight}px`;
        this.maskHoleEl.style.width = `${displayWidth}px`;
        this.maskHoleEl.style.height = `${displayHeight}px`;
        this.maskHoleEl.style.margin = '0';
    }

    updateShapeButtons() {
        this.shapeButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.shape === this.shape);
        });
    }

    updateShapeVisuals() {
        if (!this.previewFrameEl || !this.maskHoleEl || !this.viewportEl) {
            return;
        }
        this.viewportEl.style.width = `${this.displayWidth}px`;
        this.viewportEl.style.height = `${this.displayHeight}px`;

        this.maskHoleEl.style.width = `${this.displayWidth}px`;
        this.maskHoleEl.style.height = `${this.displayHeight}px`;
        this.maskHoleEl.style.margin = '0';
        this.maskHoleEl.style.boxShadow = this.maskHoleBoxShadow;
        this.maskHoleEl.style.background = 'transparent';
        this.maskHoleEl.style.borderRadius = '0';

        if (this.shape === 'rounded') {
            const radius = Math.max(0, this.getRoundedRadius() * this.previewScale);
            const radiusPx = `${radius}px`;
            this.maskHoleEl.style.borderRadius = radiusPx;
        }

        if (this.shape === 'circle') {
            this.maskHoleEl.style.boxShadow = 'none';
            this.maskHoleEl.style.borderRadius = '0';
        }

        this.updateOutlinePreview();
    }

    updateOutlineControlsState() {
        if (!this.outlineOptionsEl) {
            return;
        }
        const disabled = !this.outlineEnabled;
        this.outlineOptionsEl.style.opacity = disabled ? '0.45' : '1';
        this.outlineColorInput.disabled = disabled;
    }

    updateOutlinePreview() {
        if (!this.maskHoleEl) {
            return;
        }

        const width = Math.max(1, Math.round(this.displayWidth));
        const height = Math.max(1, Math.round(this.displayHeight));
        if (!width || !height) {
            return;
        }

        if (this.shape === 'circle') {
            const diameter = Math.min(width, height);
            const radius = Math.max(0, diameter / 2);
            const outlineWidth = this.outlineEnabled ? this.outlineWidth : 0;
            const innerStop = Math.max(0, radius - outlineWidth);
            const overlay = this.maskOverlayColor;
            const color = this.outlineColor;
            this.maskHoleEl.style.boxShadow = 'none';
            this.maskHoleEl.style.background = this.outlineEnabled
                ? `radial-gradient(circle at center, transparent ${innerStop}px, ${color} ${innerStop}px, ${color} ${radius}px, ${overlay} ${radius}px)`
                : `radial-gradient(circle at center, transparent ${radius}px, ${overlay} ${radius}px)`;
            this.maskHoleEl.style.border = 'none';
        } else {
            this.maskHoleEl.style.background = 'transparent';
            this.maskHoleEl.style.boxShadow = this.maskHoleBoxShadow;
            if (this.outlineEnabled) {
                this.maskHoleEl.style.border = `2px solid ${this.outlineColor}`;
            } else {
                this.maskHoleEl.style.border = this.maskHoleBorderStyle;
            }
        }
    }

    updateZoomLabel() {
        if (!this.zoomValueEl) {
            return;
        }
        const ratio = this.state.scale / this.minScale;
        const percent = clamp(Math.round(ratio * 100), 10, 800);
        this.zoomValueEl.textContent = `${percent}%`;
    }

    updateImageTransform() {
        if (!this.imageEl || !this.originalImage) {
            return;
        }
        const effectiveScale = this.state.scale * this.previewScale;
        const displayWidth = this.originalImage.naturalWidth * effectiveScale;
        const displayHeight = this.originalImage.naturalHeight * effectiveScale;
        this.imageEl.style.width = `${displayWidth}px`;
        this.imageEl.style.height = `${displayHeight}px`;
        const offsetX = this.state.offsetX * this.previewScale;
        const offsetY = this.state.offsetY * this.previewScale;
        this.imageEl.style.transform = `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`;
    }

    handlePointerDown(event) {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        this.dragging = true;
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.dragStartOffset = { x: this.state.offsetX, y: this.state.offsetY };
        if (event.pointerId != null && this.imageEl.setPointerCapture) {
            try {
                this.imageEl.setPointerCapture(event.pointerId);
            } catch (_) {
                // Ignore capture errors on unsupported browsers
            }
        }
    }

    handlePointerMove(event) {
        if (!this.dragging) {
            return;
        }
        const deltaX = (event.clientX - this.dragStart.x) / this.previewScale;
        const deltaY = (event.clientY - this.dragStart.y) / this.previewScale;
        this.state.offsetX = this.dragStartOffset.x + deltaX;
        this.state.offsetY = this.dragStartOffset.y + deltaY;
        this.constrainOffsets();
        this.updateImageTransform();
    }

    handlePointerUp(event) {
        if (!this.dragging) {
            return;
        }
        this.dragging = false;
        if (event?.pointerId != null && this.imageEl?.releasePointerCapture) {
            try {
                this.imageEl.releasePointerCapture(event.pointerId);
            } catch (_) {
                // Ignore
            }
        }
    }

    handleZoomChange() {
        if (!this.zoomInput) {
            return;
        }
        const newScale = parseFloat(this.zoomInput.value);
        if (!Number.isFinite(newScale)) {
            return;
        }
        const minScale = this.minZoomScale || Math.max(this.minScale * 0.5, 0.1);
        const maxScale = this.maxZoomScale || Math.max(this.minScale + 2, this.minScale * 4);
        const previousScale = this.state.scale;
        this.state.scale = clamp(newScale, minScale, maxScale);
        if (this.state.scale !== previousScale) {
            this.constrainOffsets();
            this.updateImageTransform();
            this.updateOutlinePreview();
            this.updateZoomLabel();
        }
    }

    constrainOffsets() {
        if (!this.originalImage) {
            return;
        }
        const naturalWidth = this.originalImage.naturalWidth;
        const naturalHeight = this.originalImage.naturalHeight;
        const imageWidth = naturalWidth * this.state.scale;
        const imageHeight = naturalHeight * this.state.scale;
        const maxOffsetX = Math.max(0, (imageWidth - this.frameWidth) / 2);
        const maxOffsetY = Math.max(0, (imageHeight - this.frameHeight) / 2);
        this.state.offsetX = clamp(this.state.offsetX, -maxOffsetX, maxOffsetX);
        this.state.offsetY = clamp(this.state.offsetY, -maxOffsetY, maxOffsetY);
    }

    handleCancel() {
        if (typeof this.onCancel === 'function') {
            this.onCancel('cancel');
        }
        this.close();
    }

    handleConfirm() {
        if (!this.originalImage) {
            this.handleCancel();
            return;
        }
        const result = this.generateResult();
        if (typeof this.onConfirm === 'function') {
            this.onConfirm(result);
        }
        this.close();
    }

    generateResult() {
        const outputScale = window.devicePixelRatio && Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
        const canvas = document.createElement('canvas');
        const width = Math.max(1, Math.round(this.frameWidth * outputScale));
        const height = Math.max(1, Math.round(this.frameHeight * outputScale));
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        const naturalWidth = this.originalImage.naturalWidth;
        const naturalHeight = this.originalImage.naturalHeight;
        const cropWidth = this.frameWidth / this.state.scale;
        const cropHeight = this.frameHeight / this.state.scale;
        const rawLeft = (naturalWidth - cropWidth) / 2 - this.state.offsetX / this.state.scale;
        const rawTop = (naturalHeight - cropHeight) / 2 - this.state.offsetY / this.state.scale;
        const left = clamp(rawLeft, 0, naturalWidth - cropWidth);
        const top = clamp(rawTop, 0, naturalHeight - cropHeight);

        ctx.drawImage(
            this.originalImage,
            left,
            top,
            cropWidth,
            cropHeight,
            0,
            0,
            width,
            height
        );

        this.applyMask(ctx, width, height, outputScale);
        this.applyOutline(ctx, width, height, outputScale);

        const dataUrl = canvas.toDataURL('image/png');
        return {
            dataUrl,
            baseSrc: this.baseSrc,
            cropConfig: {
                shape: this.shape,
                outline: {
                    enabled: this.outlineEnabled,
                    color: this.outlineColor,
                    width: this.outlineWidth
                },
                state: {
                    scale: this.state.scale,
                    offsetX: this.state.offsetX,
                    offsetY: this.state.offsetY
                },
                frame: {
                    width: this.frameWidth,
                    height: this.frameHeight
                },
                natural: {
                    width: naturalWidth,
                    height: naturalHeight
                },
                deviceScale: outputScale,
                minScale: this.minScale
            }
        };
    }

    applyMask(ctx, width, height, outputScale) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        if (this.shape === 'circle') {
            const radius = Math.min(width, height) / 2;
            ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        } else if (this.shape === 'rounded') {
            const radius = this.getRoundedRadius() * outputScale;
            this.drawRoundedRect(ctx, 0, 0, width, height, radius);
        } else {
            ctx.rect(0, 0, width, height);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    applyOutline(ctx, width, height, outputScale) {
        if (!this.outlineEnabled || this.outlineWidth <= 0) {
            return;
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = Math.max(1, this.outlineWidth * outputScale);
        ctx.strokeStyle = this.outlineColor;
        ctx.beginPath();
        if (this.shape === 'circle') {
            const radius = Math.min(width, height) / 2 - ctx.lineWidth / 2;
            ctx.arc(width / 2, height / 2, Math.max(0, radius), 0, Math.PI * 2);
        } else if (this.shape === 'rounded') {
            const radius = Math.max(0, this.getRoundedRadius() * outputScale - ctx.lineWidth / 2);
            this.drawRoundedRect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth, radius);
        } else {
            ctx.rect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        const r = clamp(radius, 0, Math.min(width, height) / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    }

    getRoundedRadius() {
        const baseRadius = this.frameWidth * CARD_CORNER_RATIO;
        return clamp(baseRadius, 2, Math.min(this.frameWidth, this.frameHeight) / 2);
    }

    getText(key, fallback) {
        const value = this.i18n?.[key];
        if (typeof value === 'string') {
            return value;
        }
        return fallback;
    }

    close() {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        try {
            window.removeEventListener('pointermove', this.boundPointerMove);
            window.removeEventListener('pointerup', this.boundPointerUp);
            window.removeEventListener('pointercancel', this.boundPointerUp);
            window.removeEventListener('keydown', this.boundKeydown);
        } catch (_) {
            // ignore
        }
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (document?.body) {
            document.body.style.overflow = this.previousBodyOverflow;
        }
        this.overlay = null;
        this.modal = null;
        this.previewFrameEl = null;
        this.maskHoleEl = null;
        this.imageEl = null;
    }
}
