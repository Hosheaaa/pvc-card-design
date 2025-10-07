(function () {
    'use strict';

    if (window.__CROP_STANDALONE_INIT__) {
        return;
    }
    window.__CROP_STANDALONE_INIT__ = true;

    var VERSION = window.__CROP_ASSET_VERSION__ || '20241005T0900';
    window.__CROP_ASSET_VERSION__ = VERSION;

    var CARD_CORNER_RATIO = 12 / 500;

    function withVersion(path) {
        if (!VERSION) {
            return path;
        }
        return path.indexOf('?') >= 0 ? path + '&v=' + VERSION : path + '?v=' + VERSION;
    }

    function clamp(value, min, max) {
        if (isNaN(value)) {
            return min;
        }
        if (min > max) {
            return min;
        }
        if (value < min) {
            return min;
        }
        if (value > max) {
            return max;
        }
        return value;
    }

    function waitForCardDesigner(maxWaitMs) {
        return new Promise(function (resolve) {
            var start = Date.now();
            var timer = setInterval(function () {
                if (window.cardDesigner) {
                    clearInterval(timer);
                    resolve(window.cardDesigner);
                    return;
                }
                if (Date.now() - start > maxWaitMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    }

    function loadImage(src) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('Failed to load image for cropping')); };
            img.src = src;
        });
    }

    function ensureStyles(assetVersion) {
        var base = 'Crop/styles/crop-modal.css';
        var href = assetVersion ? base + '?v=' + assetVersion : base;
        var existing = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]')).some(function (link) {
            return typeof link.href === 'string' && link.href.indexOf('Crop/styles/crop-modal.css') !== -1;
        });
        if (existing) {
            return;
        }
        var linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href = href;
        document.head.appendChild(linkEl);
    }

    function CropModal(options) {
        this.element = options.element;
        this.baseSrc = options.baseSrc;
        this.existingConfig = options.existingConfig || {};
        this.i18n = options.i18n || {};
        this.onConfirm = options.onConfirm;
        this.onCancel = options.onCancel;

        this.overlay = null;
        this.modal = null;
        this.previewFrameEl = null;
        this.maskHoleEl = null;
        this.imageEl = null;
        this.viewportEl = null;
        this.loadingIndicator = null;
        this.viewportEl = null;

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
        this.outlineEnabled = !!(this.existingConfig.outline && this.existingConfig.outline.enabled);
        this.outlineColor = (this.existingConfig.outline && this.existingConfig.outline.color) || '#ffffff';
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
        this.maskHoleBoxShadow = '0 0 0 9999px ' + this.maskOverlayColor;
        this.maskHoleBorderStyle = '2px solid rgba(255, 255, 255, 0.65)';
    }

    CropModal.prototype.open = function () {
        var _this = this;
        return loadImage(this.baseSrc)
            .then(function (img) {
                _this.originalImage = img;
                _this.configureFrame();
                _this.buildModal();
                _this.attachEvents();
                _this.updateAllVisuals();
            })
            .catch(function (error) {
                console.error('[CropModal] Failed to open', error);
                _this.close();
                if (typeof _this.onCancel === 'function') {
                    _this.onCancel('error');
                }
            });
    };

    CropModal.prototype.configureFrame = function () {
        var fallbackWidth = 200;
        var fallbackHeight = 140;
        var numericWidth = parseFloat(this.element && this.element.style && this.element.style.width) || (this.element && this.element.offsetWidth) || fallbackWidth;
        var numericHeight = parseFloat(this.element && this.element.style && this.element.style.height) || (this.element && this.element.offsetHeight) || fallbackHeight;
        this.frameWidth = Math.max(20, numericWidth);
        this.frameHeight = Math.max(20, numericHeight);

        var naturalWidth = (this.originalImage && this.originalImage.naturalWidth) || this.frameWidth;
        var naturalHeight = (this.originalImage && this.originalImage.naturalHeight) || this.frameHeight;
        var safeNaturalWidth = Math.max(1, naturalWidth);
        var safeNaturalHeight = Math.max(1, naturalHeight);

        this.minScale = Math.max(this.frameWidth / safeNaturalWidth, this.frameHeight / safeNaturalHeight);
        this.minScale = Math.max(this.minScale, 0.1);
        this.minZoomScale = Math.max(this.minScale * 0.5, 0.1);
        this.maxZoomScale = Math.max(this.minScale + 2, this.minScale * 4);

        var existingScale = this.existingConfig.state && this.existingConfig.state.scale;
        var baseScale = (existingScale && isFinite(existingScale)) ? existingScale : this.minScale;
        this.state.scale = Math.min(this.maxZoomScale, Math.max(this.minZoomScale, baseScale));

        this.state.offsetX = (this.existingConfig.state && this.existingConfig.state.offsetX) || 0;
        this.state.offsetY = (this.existingConfig.state && this.existingConfig.state.offsetY) || 0;
        this.constrainOffsets();
    };

    CropModal.prototype.buildModal = function () {
        var _this = this;
        this.overlay = document.createElement('div');
        this.overlay.className = 'crop-modal-overlay';

        this.modal = document.createElement('div');
        this.modal.className = 'crop-modal';

        var header = document.createElement('div');
        header.className = 'crop-modal__header';

        this.titleEl = document.createElement('div');
        this.titleEl.className = 'crop-modal__title';
        header.appendChild(this.titleEl);

        var closeBtn = document.createElement('button');
        closeBtn.className = 'crop-modal__close';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', function () { _this.handleCancel(); });
        header.appendChild(closeBtn);

        var body = document.createElement('div');
        body.className = 'crop-modal__body';

        var previewPanel = document.createElement('div');
        previewPanel.className = 'crop-preview-panel';

        var previewStage = document.createElement('div');
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

        var maskLayer = document.createElement('div');
        maskLayer.className = 'crop-mask-layer';
        this.maskHoleEl = document.createElement('div');
        this.maskHoleEl.className = 'crop-mask-hole';
        maskLayer.appendChild(this.maskHoleEl);
        previewStage.appendChild(maskLayer);

        previewPanel.appendChild(previewStage);

        var controlsPanel = document.createElement('div');
        controlsPanel.className = 'crop-controls';

        var shapeGroup = document.createElement('div');
        shapeGroup.className = 'crop-control-group';
        this.shapeTitleEl = document.createElement('h4');
        shapeGroup.appendChild(this.shapeTitleEl);

        var shapeList = document.createElement('div');
        shapeList.className = 'crop-shape-list';

        var shapes = [
            { key: 'rectangle', labelKey: 'shapeRectangle' },
            { key: 'rounded', labelKey: 'shapeRounded' },
            { key: 'circle', labelKey: 'shapeCircle' }
        ];

        shapes.forEach(function (item) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'crop-shape-btn';
            btn.setAttribute('data-shape', item.key);

            var icon = document.createElement('div');
            icon.className = 'shape-icon';
            btn.appendChild(icon);

            var label = document.createElement('span');
            label.textContent = _this.getText(item.labelKey, item.key);
            btn.appendChild(label);

            btn.addEventListener('click', function () {
                _this.shape = item.key;
                _this.updateShapeButtons();
                _this.updateShapeVisuals();
                _this.updateOutlinePreview();
            });

            _this.shapeButtons.push(btn);
            shapeList.appendChild(btn);
        });

        shapeGroup.appendChild(shapeList);
        controlsPanel.appendChild(shapeGroup);

        var zoomGroup = document.createElement('div');
        zoomGroup.className = 'crop-control-group';
        this.zoomTitleEl = document.createElement('h4');
        zoomGroup.appendChild(this.zoomTitleEl);

        var zoomReadout = document.createElement('div');
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

        var outlineGroup = document.createElement('div');
        outlineGroup.className = 'crop-control-group';
        this.outlineTitleEl = document.createElement('h4');
        outlineGroup.appendChild(this.outlineTitleEl);

        var toggleRow = document.createElement('div');
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

        var colorGroup = document.createElement('div');
        colorGroup.className = 'crop-control-group';
        var colorLabel = document.createElement('label');
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

        var footer = document.createElement('div');
        footer.className = 'crop-modal__footer';

        this.cancelBtn = document.createElement('button');
        this.cancelBtn.type = 'button';
        this.cancelBtn.className = 'crop-btn crop-btn--secondary';
        this.cancelBtn.addEventListener('click', function () { _this.handleCancel(); });
        footer.appendChild(this.cancelBtn);

        this.confirmBtn = document.createElement('button');
        this.confirmBtn.type = 'button';
        this.confirmBtn.className = 'crop-btn crop-btn--primary';
        this.confirmBtn.addEventListener('click', function () { _this.handleConfirm(); });
        footer.appendChild(this.confirmBtn);

        this.modal.appendChild(header);
        this.modal.appendChild(body);
        this.modal.appendChild(footer);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        this.previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    };

    CropModal.prototype.attachEvents = function () {
        var _this = this;
        if (!this.imageEl) {
            return;
        }
        this.boundPointerMove = function (event) { _this.handlePointerMove(event); };
        this.boundPointerUp = function (event) { _this.handlePointerUp(event); };

        this.imageEl.addEventListener('pointerdown', function (event) { _this.handlePointerDown(event); });
        window.addEventListener('pointermove', this.boundPointerMove);
        window.addEventListener('pointerup', this.boundPointerUp);
        window.addEventListener('pointercancel', this.boundPointerUp);

        if (this.zoomInput) {
            this.zoomInput.addEventListener('input', function () { _this.handleZoomChange(); });
        }

        if (this.outlineCheckbox) {
            this.outlineCheckbox.addEventListener('change', function () {
                _this.outlineEnabled = !!_this.outlineCheckbox.checked;
                _this.updateOutlineControlsState();
                _this.updateOutlinePreview();
            });
        }

        if (this.outlineColorInput) {
            this.outlineColorInput.addEventListener('input', function () {
                _this.outlineColor = _this.outlineColorInput.value || '#ffffff';
                _this.updateOutlinePreview();
            });
        }

        this.boundKeydown = function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                _this.handleCancel();
            }
        };
        window.addEventListener('keydown', this.boundKeydown);

        if (this.overlay) {
            this.overlay.addEventListener('click', function (event) {
                if (event.target === _this.overlay) {
                    _this.handleCancel();
                }
            });
        }
    };

    CropModal.prototype.updateAllVisuals = function () {
        this.updateTexts();
        this.updateZoomRange();
        this.updatePreviewDimensions();
        this.updateShapeButtons();
        this.updateShapeVisuals();
        this.updateOutlineControlsState();
        this.updateOutlinePreview();
        this.updateZoomLabel();
        this.updateImageTransform();
        if (this.loadingIndicator && this.loadingIndicator.parentNode) {
            this.loadingIndicator.parentNode.removeChild(this.loadingIndicator);
            this.loadingIndicator = null;
        }
    };

    CropModal.prototype.updateTexts = function () {
        if (this.titleEl) {
            this.titleEl.textContent = this.getText('title', 'Crop Image');
        }
        if (this.shapeTitleEl) {
            this.shapeTitleEl.textContent = this.getText('shapeTitle', 'Crop shape');
        }
        if (this.zoomTitleEl) {
            this.zoomTitleEl.textContent = this.getText('zoomTitle', 'Image zoom');
        }
        if (this.outlineTitleEl) {
            this.outlineTitleEl.textContent = this.getText('outlineTitle', 'Outline');
        }
        if (this.outlineToggleLabelEl) {
            this.outlineToggleLabelEl.textContent = this.getText('outlineToggle', 'Enable outline');
        }
        if (this.cancelBtn) {
            this.cancelBtn.textContent = this.getText('cancel', 'Cancel');
        }
        if (this.confirmBtn) {
            this.confirmBtn.textContent = this.getText('confirm', 'Apply');
        }
        if (this.outlineOptionsEl) {
            var colorLabel = this.outlineOptionsEl.querySelector('label[for="cropOutlineColor"]');
            if (colorLabel) {
                colorLabel.textContent = this.getText('outlineColor', 'Color');
            }
        }
        this.shapeButtons.forEach(function (btn) {
            var key = btn.getAttribute('data-shape');
            var label = btn.querySelector('span');
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
        }, this);
    };

    CropModal.prototype.updateZoomRange = function () {
        if (!this.zoomInput) {
            return;
        }
        var minScale = this.minZoomScale || Math.max(this.minScale * 0.5, 0.1);
        var maxScale = this.maxZoomScale || Math.max(this.minScale + 2, this.minScale * 4);
        this.zoomInput.min = minScale.toFixed(2);
        this.zoomInput.max = maxScale.toFixed(2);
        this.state.scale = Math.min(maxScale, Math.max(minScale, this.state.scale));
        this.zoomInput.value = this.state.scale.toFixed(2);
    };

    CropModal.prototype.updatePreviewDimensions = function () {
        if (!this.previewFrameEl || !this.maskHoleEl) {
            return;
        }
        var maxWidth = 520;
        var maxHeight = 360;
        var widthScale = maxWidth / this.frameWidth;
        var heightScale = maxHeight / this.frameHeight;
        var scale = Math.min(4, widthScale, heightScale);
        this.previewScale = Math.max(scale, 0.25);
        var displayWidth = Math.round(this.frameWidth * this.previewScale);
        var displayHeight = Math.round(this.frameHeight * this.previewScale);
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        this.previewFrameEl.style.width = displayWidth + 'px';
        this.previewFrameEl.style.height = displayHeight + 'px';
        this.maskHoleEl.style.width = displayWidth + 'px';
        this.maskHoleEl.style.height = displayHeight + 'px';
        this.maskHoleEl.style.margin = '0';
    };

    CropModal.prototype.updateShapeButtons = function () {
        this.shapeButtons.forEach(function (btn) {
            btn.classList.toggle('active', btn.getAttribute('data-shape') === this.shape);
        }, this);
    };

    CropModal.prototype.updateShapeVisuals = function () {
        if (!this.previewFrameEl || !this.maskHoleEl || !this.viewportEl) {
            return;
        }

        this.viewportEl.style.width = this.displayWidth + 'px';
        this.viewportEl.style.height = this.displayHeight + 'px';

        this.maskHoleEl.style.width = this.displayWidth + 'px';
        this.maskHoleEl.style.height = this.displayHeight + 'px';
        this.maskHoleEl.style.margin = '0';
        this.maskHoleEl.style.boxShadow = this.maskHoleBoxShadow;
        this.maskHoleEl.style.background = 'transparent';
        this.maskHoleEl.style.borderRadius = '0';

        if (this.shape === 'rounded') {
            var radiusRounded = Math.max(0, this.getRoundedRadius() * this.previewScale);
            var radiusRoundedPx = radiusRounded + 'px';
            this.maskHoleEl.style.borderRadius = radiusRoundedPx;
        }

        if (this.shape === 'circle') {
            this.maskHoleEl.style.boxShadow = 'none';
            this.maskHoleEl.style.borderRadius = '0';
        }

        this.updateOutlinePreview();
    };

    CropModal.prototype.updateOutlineControlsState = function () {
        if (!this.outlineOptionsEl) {
            return;
        }
        var disabled = !this.outlineEnabled;
        this.outlineOptionsEl.style.opacity = disabled ? '0.45' : '1';
        if (this.outlineColorInput) {
            this.outlineColorInput.disabled = disabled;
        }
        this.outlineWidth = 2;
    };

    CropModal.prototype.updateOutlinePreview = function () {
        if (!this.maskHoleEl) {
            return;
        }

        var width = Math.max(1, Math.round(this.displayWidth));
        var height = Math.max(1, Math.round(this.displayHeight));
        if (!width || !height) {
            return;
        }

        if (this.shape === 'circle') {
            var diameter = Math.min(width, height);
            var radius = Math.max(0, diameter / 2);
            var outlineWidth = this.outlineEnabled ? this.outlineWidth : 0;
            var innerStop = Math.max(0, radius - outlineWidth);
            var overlay = this.maskOverlayColor;
            var color = this.outlineColor;
            this.maskHoleEl.style.boxShadow = 'none';
            this.maskHoleEl.style.background = this.outlineEnabled
                ? 'radial-gradient(circle at center, transparent ' + innerStop + 'px, ' + color + ' ' + innerStop + 'px, ' + color + ' ' + radius + 'px, ' + overlay + ' ' + radius + 'px)'
                : 'radial-gradient(circle at center, transparent ' + radius + 'px, ' + overlay + ' ' + radius + 'px)';
            this.maskHoleEl.style.border = 'none';
        } else {
            this.maskHoleEl.style.background = 'transparent';
            this.maskHoleEl.style.boxShadow = this.maskHoleBoxShadow;
            if (this.outlineEnabled) {
                this.maskHoleEl.style.border = '2px solid ' + this.outlineColor;
            } else {
                this.maskHoleEl.style.border = this.maskHoleBorderStyle;
            }
        }
    };

    CropModal.prototype.updateZoomLabel = function () {
        if (!this.zoomValueEl) {
            return;
        }
        var ratio = this.state.scale / this.minScale;
        var percent = clamp(Math.round(ratio * 100), 10, 800);
        this.zoomValueEl.textContent = percent + '%';
    };

    CropModal.prototype.updateImageTransform = function () {
        if (!this.imageEl || !this.originalImage) {
            return;
        }
        var effectiveScale = this.state.scale * this.previewScale;
        var displayWidth = this.originalImage.naturalWidth * effectiveScale;
        var displayHeight = this.originalImage.naturalHeight * effectiveScale;
        this.imageEl.style.width = displayWidth + 'px';
        this.imageEl.style.height = displayHeight + 'px';
        var offsetX = this.state.offsetX * this.previewScale;
        var offsetY = this.state.offsetY * this.previewScale;
        this.imageEl.style.transform = 'translate(-50%, -50%) translate(' + offsetX + 'px, ' + offsetY + 'px)';
    };

    CropModal.prototype.handlePointerDown = function (event) {
        if (event.button !== 0) {
            return;
        }
        event.preventDefault();
        this.dragging = true;
        this.dragStart = { x: event.clientX, y: event.clientY };
        this.dragStartOffset = { x: this.state.offsetX, y: this.state.offsetY };
        if (event.pointerId != null && this.imageEl && this.imageEl.setPointerCapture) {
            try {
                this.imageEl.setPointerCapture(event.pointerId);
            } catch (_) {}
        }
    };

    CropModal.prototype.handlePointerMove = function (event) {
        if (!this.dragging) {
            return;
        }
        var deltaX = (event.clientX - this.dragStart.x) / this.previewScale;
        var deltaY = (event.clientY - this.dragStart.y) / this.previewScale;
        this.state.offsetX = this.dragStartOffset.x + deltaX;
        this.state.offsetY = this.dragStartOffset.y + deltaY;
        this.constrainOffsets();
        this.updateImageTransform();
    };

    CropModal.prototype.handlePointerUp = function (event) {
        if (!this.dragging) {
            return;
        }
        this.dragging = false;
        if (event && event.pointerId != null && this.imageEl && this.imageEl.releasePointerCapture) {
            try {
                this.imageEl.releasePointerCapture(event.pointerId);
            } catch (_) {}
        }
    };

    CropModal.prototype.handleZoomChange = function () {
        if (!this.zoomInput) {
            return;
        }
        var newScale = parseFloat(this.zoomInput.value);
        if (!isFinite(newScale)) {
            return;
        }
        var minScale = this.minZoomScale || Math.max(this.minScale * 0.5, 0.1);
        var maxScale = this.maxZoomScale || Math.max(this.minScale + 2, this.minScale * 4);
        var previousScale = this.state.scale;
        this.state.scale = clamp(newScale, minScale, maxScale);
        if (this.state.scale !== previousScale) {
            this.constrainOffsets();
            this.updateImageTransform();
            this.updateOutlinePreview();
            this.updateZoomLabel();
        }
    };

    CropModal.prototype.constrainOffsets = function () {
        if (!this.originalImage) {
            return;
        }
        var naturalWidth = this.originalImage.naturalWidth;
        var naturalHeight = this.originalImage.naturalHeight;
        var imageWidth = naturalWidth * this.state.scale;
        var imageHeight = naturalHeight * this.state.scale;
        var maxOffsetX = Math.max(0, (imageWidth - this.frameWidth) / 2);
        var maxOffsetY = Math.max(0, (imageHeight - this.frameHeight) / 2);
        this.state.offsetX = clamp(this.state.offsetX, -maxOffsetX, maxOffsetX);
        this.state.offsetY = clamp(this.state.offsetY, -maxOffsetY, maxOffsetY);
    };

    CropModal.prototype.handleCancel = function () {
        if (typeof this.onCancel === 'function') {
            this.onCancel('cancel');
        }
        this.close();
    };

    CropModal.prototype.handleConfirm = function () {
        if (!this.originalImage) {
            this.handleCancel();
            return;
        }
        var result = this.generateResult();
        if (typeof this.onConfirm === 'function') {
            this.onConfirm(result);
        }
        this.close();
    };

    CropModal.prototype.generateResult = function () {
        var outputScale = (window.devicePixelRatio && isFinite(window.devicePixelRatio)) ? window.devicePixelRatio : 1;
        var canvas = document.createElement('canvas');
        var width = Math.max(1, Math.round(this.frameWidth * outputScale));
        var height = Math.max(1, Math.round(this.frameHeight * outputScale));
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        if (!ctx) {
            return null;
        }

        var naturalWidth = this.originalImage.naturalWidth;
        var naturalHeight = this.originalImage.naturalHeight;
        var cropWidth = this.frameWidth / this.state.scale;
        var cropHeight = this.frameHeight / this.state.scale;
        var rawLeft = (naturalWidth - cropWidth) / 2 - this.state.offsetX / this.state.scale;
        var rawTop = (naturalHeight - cropHeight) / 2 - this.state.offsetY / this.state.scale;
        var left = clamp(rawLeft, 0, naturalWidth - cropWidth);
        var top = clamp(rawTop, 0, naturalHeight - cropHeight);

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

        var dataUrl = canvas.toDataURL('image/png');
        return {
            dataUrl: dataUrl,
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
    };

    CropModal.prototype.applyMask = function (ctx, width, height, outputScale) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.beginPath();
        if (this.shape === 'circle') {
            var radius = Math.min(width, height) / 2;
            ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
        } else if (this.shape === 'rounded') {
            var radiusRounded = this.getRoundedRadius() * outputScale;
            this.drawRoundedRect(ctx, 0, 0, width, height, radiusRounded);
        } else {
            ctx.rect(0, 0, width, height);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };

    CropModal.prototype.applyOutline = function (ctx, width, height, outputScale) {
        if (!this.outlineEnabled || this.outlineWidth <= 0) {
            return;
        }
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.lineWidth = Math.max(1, this.outlineWidth * outputScale);
        ctx.strokeStyle = this.outlineColor;
        ctx.beginPath();
        if (this.shape === 'circle') {
            var radius = Math.min(width, height) / 2 - ctx.lineWidth / 2;
            ctx.arc(width / 2, height / 2, Math.max(0, radius), 0, Math.PI * 2);
        } else if (this.shape === 'rounded') {
            var radiusRounded = Math.max(0, this.getRoundedRadius() * outputScale - ctx.lineWidth / 2);
            this.drawRoundedRect(ctx, ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth, radiusRounded);
        } else {
            ctx.rect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    };

    CropModal.prototype.drawRoundedRect = function (ctx, x, y, width, height, radius) {
        var r = clamp(radius, 0, Math.min(width, height) / 2);
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + width - r, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + r);
        ctx.lineTo(x + width, y + height - r);
        ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        ctx.lineTo(x + r, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
    };

    CropModal.prototype.getRoundedRadius = function () {
        var baseRadius = this.frameWidth * CARD_CORNER_RATIO;
        return clamp(baseRadius, 2, Math.min(this.frameWidth, this.frameHeight) / 2);
    };

    CropModal.prototype.getText = function (key, fallback) {
        var value = this.i18n && this.i18n[key];
        if (typeof value === 'string') {
            return value;
        }
        return fallback;
    };

    CropModal.prototype.close = function () {
        if (this.destroyed) {
            return;
        }
        this.destroyed = true;
        try {
            window.removeEventListener('pointermove', this.boundPointerMove);
            window.removeEventListener('pointerup', this.boundPointerUp);
            window.removeEventListener('pointercancel', this.boundPointerUp);
            window.removeEventListener('keydown', this.boundKeydown);
        } catch (_) {}
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (document && document.body) {
            document.body.style.overflow = this.previousBodyOverflow;
        }
        this.overlay = null;
        this.modal = null;
        this.previewFrameEl = null;
        this.maskHoleEl = null;
        this.imageEl = null;
    };

    function CropManager(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.assetVersion = VERSION;
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

    CropManager.prototype.init = function () {
        if (!this.cardDesigner) {
            console.warn('[CropManager] cardDesigner instance missing');
            return;
        }
        ensureStyles(this.assetVersion);
        this.stylesLoaded = true;
        this.patchSelectionHooks();
        this.patchLanguageHooks();
        this.patchPropertiesHook();
        this.setupObservers();
        this.injectCropTrigger();
        this.updateButtonState();
    };

    CropManager.prototype.patchSelectionHooks = function () {
        if (this.selectionPatched) {
            return;
        }
        var designer = this.cardDesigner;
        var manager = this;
        var originalSelect = (designer && typeof designer.selectElement === 'function') ? designer.selectElement.bind(designer) : null;
        if (originalSelect) {
            designer.selectElement = function () {
                var result = originalSelect.apply(designer, arguments);
                manager.defer(function () {
                    manager.updateButtonState();
                });
                return result;
            };
        }

        var originalDeselect = (designer && typeof designer.deselectElement === 'function') ? designer.deselectElement.bind(designer) : null;
        if (originalDeselect) {
            designer.deselectElement = function () {
                var result = originalDeselect.apply(designer, arguments);
                manager.defer(function () {
                    manager.updateButtonState();
                });
                return result;
            };
        }
        this.selectionPatched = true;
    };

    CropManager.prototype.patchLanguageHooks = function () {
        if (this.languagePatched) {
            return;
        }
        var designer = this.cardDesigner;
        var manager = this;
        var originalUpdateLanguage = (designer && typeof designer.updateLanguage === 'function') ? designer.updateLanguage.bind(designer) : null;
        if (originalUpdateLanguage) {
            designer.updateLanguage = function () {
                var result = originalUpdateLanguage.apply(designer, arguments);
                manager.defer(function () {
                    manager.syncLanguage();
                });
                return result;
            };
        }
        this.languagePatched = true;
    };

    CropManager.prototype.patchPropertiesHook = function () {
        if (this.propertiesPatched) {
            return;
        }
        var designer = this.cardDesigner;
        var manager = this;
        var originalUpdateProperties = (designer && typeof designer.updatePropertiesPanel === 'function') ? designer.updatePropertiesPanel.bind(designer) : null;
        if (originalUpdateProperties) {
            designer.updatePropertiesPanel = function () {
                var result = originalUpdateProperties.apply(designer, arguments);
                manager.defer(function () {
                    manager.injectCropTrigger();
                    manager.updateButtonState();
                });
                return result;
            };
        }
        this.propertiesPatched = true;
    };

    CropManager.prototype.setupObservers = function () {
        var _this = this;
        var target = document.getElementById('imageProperties');
        if (!target) {
            setTimeout(function () { _this.setupObservers(); }, 400);
            return;
        }
        if (this.observer) {
            return;
        }
        this.observer = new MutationObserver(function () {
            _this.handleObservedMutations();
        });
        this.observerTarget = target;
        this.observer.observe(target, { childList: true, subtree: true });
    };

    CropManager.prototype.handleObservedMutations = function () {
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
    };

    CropManager.prototype.injectCropTrigger = function () {
        var panel = document.getElementById('imagePropertiesPanel');
        if (!panel) {
            return;
        }
        var existing = panel.querySelector('[data-crop-section="true"]');
        if (existing) {
            this.sectionNode = existing;
            this.buttonNode = existing.querySelector('.crop-trigger-btn');
            this.syncLanguage();
            return;
        }

        var section = document.createElement('div');
        section.className = 'property-section crop-trigger-section';
        section.setAttribute('data-crop-section', 'true');

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'crop-trigger-btn';
        var manager = this;
        button.addEventListener('click', function () { manager.handleOpenCropper(); });
        section.appendChild(button);

        this.sectionNode = section;
        this.buttonNode = button;
        var firstSection = Array.prototype.slice.call(panel.children).find(function (child) {
            return child.classList && child.classList.contains('property-section');
        });
        if (firstSection) {
            panel.insertBefore(section, firstSection);
        } else {
            panel.appendChild(section);
        }
        this.syncLanguage();
        this.updateButtonState();
    };

    CropManager.prototype.handleOpenCropper = function () {
        if (this.isOpening) {
            return;
        }
        var element = this.cardDesigner && this.cardDesigner.selectedElement;
        if (!element || !element.classList || !element.classList.contains('image-element')) {
            this.notify(this.getLangPack().selectImageHint);
            return;
        }

        var recordInfo = this.findElementRecord(element);
        if (!recordInfo) {
            this.notify('Unable to locate image data for cropping.');
            return;
        }

        var baseSrc = this.resolveBaseSource(recordInfo.record, element);
        if (!baseSrc) {
            this.notify('Original image data is missing, unable to crop.');
            return;
        }

        var existingConfig = (recordInfo.record.data && recordInfo.record.data.cropConfig) || (recordInfo.record.serializable && recordInfo.record.serializable.cropConfig) || null;
        this.isOpening = true;
        if (this.buttonNode) {
            this.buttonNode.disabled = true;
        }

        var manager = this;
        this.modal = new CropModal({
            element: element,
            baseSrc: baseSrc,
            existingConfig: existingConfig,
            i18n: this.getModalI18n(),
            onConfirm: function (result) {
                manager.applyCropResult(recordInfo, result);
                manager.handleModalClosed();
            },
            onCancel: function () {
                manager.handleModalClosed();
            }
        });
        this.modal.open();
    };

    CropManager.prototype.handleModalClosed = function () {
        this.modal = null;
        this.isOpening = false;
        this.updateButtonState();
    };

    CropManager.prototype.applyCropResult = function (recordInfo, result) {
        if (!result || !result.dataUrl || !recordInfo || !recordInfo.record) {
            return;
        }
        var element = recordInfo.record.element;
        var img = element && element.querySelector && element.querySelector('img');
        if (!img) {
            return;
        }

        var dataUrl = result.dataUrl;
        try {
            img.src = dataUrl;
        } catch (error) {
            console.warn('[CropManager] failed to update image src after crop', error);
            return;
        }

        var record = recordInfo.record;
        var recordData = record.data || (record.data = {});
        var recordSerializable = record.serializable || (record.serializable = {});
        var baseSrc = result.baseSrc || recordData.cropOriginalSrc || recordData.originalSrc || dataUrl;

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

        if (this.cardDesigner && typeof this.cardDesigner.updateElementSerializableData === 'function') {
            this.cardDesigner.updateElementSerializableData(element);
        }

        if (this.cardDesigner && this.cardDesigner.historyManager && typeof this.cardDesigner.historyManager.recordAction === 'function') {
            this.cardDesigner.historyManager.recordAction();
        }
        if (this.cardDesigner && typeof this.cardDesigner.updatePropertiesPanel === 'function') {
            this.cardDesigner.updatePropertiesPanel(element);
        }
    };

    CropManager.prototype.resolveBaseSource = function (record, element) {
        var img = element && element.querySelector && element.querySelector('img');
        var candidates = [
            record.data && record.data.cropOriginalSrc,
            record.serializable && record.serializable.cropOriginalSrc,
            img && img.dataset && img.dataset.originalSrc,
            img && img.getAttribute && img.getAttribute('data-original-src'),
            img && img.src,
            record.data && record.data.originalSrc,
            record.serializable && record.serializable.originalSrc
        ];
        for (var i = 0; i < candidates.length; i += 1) {
            var src = candidates[i];
            if (typeof src === 'string' && src.length > 0) {
                return src;
            }
        }
        return null;
    };

    CropManager.prototype.findElementRecord = function (element) {
        if (!element || !this.cardDesigner || !this.cardDesigner.elements) {
            return null;
        }
        var sides = Object.keys(this.cardDesigner.elements);
        for (var i = 0; i < sides.length; i += 1) {
            var side = sides[i];
            var list = this.cardDesigner.elements[side] || [];
            for (var j = 0; j < list.length; j += 1) {
                var entry = list[j];
                if (entry && entry.element === element) {
                    return { side: side, record: entry };
                }
            }
        }
        return null;
    };

    CropManager.prototype.updateButtonState = function () {
        var button = this.buttonNode;
        if (!button) {
            return;
        }
        var element = this.cardDesigner && this.cardDesigner.selectedElement;
        var isImage = !!(element && element.classList && element.classList.contains('image-element'));
        button.disabled = !isImage || this.isOpening;
        var label = this.getLangPack().button;
        button.innerHTML = '<span class="icon">✂️</span><span>' + label + '</span>';
        if (!isImage) {
            button.title = this.getLangPack().buttonDisabledHint;
        } else {
            button.title = '';
        }
    };

    CropManager.prototype.syncLanguage = function () {
        var button = this.buttonNode;
        if (!button) {
            return;
        }
        var label = this.getLangPack().button;
        button.innerHTML = '<span class="icon">✂️</span><span>' + label + '</span>';
        button.title = button.disabled ? this.getLangPack().buttonDisabledHint : '';
    };

    CropManager.prototype.getLangKey = function () {
        return (this.cardDesigner && this.cardDesigner.currentLanguage === 'zh') ? 'zh' : 'en';
    };

    CropManager.prototype.getLangPack = function () {
        var key = this.getLangKey();
        return this.i18n[key] || this.i18n.en;
    };

    CropManager.prototype.getModalI18n = function () {
        var pack = this.getLangPack();
        return pack.modal || this.i18n.en.modal;
    };

    CropManager.prototype.notify = function (message) {
        if (this.cardDesigner && this.cardDesigner.errorHandler && typeof this.cardDesigner.errorHandler.showNotification === 'function') {
            this.cardDesigner.errorHandler.showNotification(message, 'info', 3200);
            return;
        }
        console.warn('[CropManager]', message);
    };

    CropManager.prototype.defer = function (fn) {
        setTimeout(function () {
            try {
                fn();
            } catch (error) {
                console.warn('[CropManager] deferred task failed', error);
            }
        }, 0);
    };

    waitForCardDesigner(10000).then(function (designer) {
        if (!designer) {
            console.warn('[CropLoader-standalone] CardDesigner not found, crop module skipped.');
            return;
        }
        try {
            new CropManager(designer);
        } catch (error) {
            console.warn('[CropLoader-standalone] Failed to initialize crop module:', error);
        }
    });
})();
