// Error Handler for comprehensive error management
class ErrorHandler {
    constructor(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.errorLog = [];
    }

    handleError(error, context = '', showToUser = true) {
        const errorInfo = {
            message: error.message || error,
            context: context,
            timestamp: new Date().toISOString(),
            stack: error.stack || ''
        };
        
        this.errorLog.push(errorInfo);
        console.error(`[CardDesigner Error] ${context}:`, error);
        
        if (showToUser) {
            this.showUserFriendlyError(errorInfo);
        }
        
        return errorInfo;
    }

    showUserFriendlyError(errorInfo) {
        const isZh = this.cardDesigner && this.cardDesigner.currentLanguage === 'zh';
        let userMessage = '';
        
        // Don't show errors during initialization to avoid confusing users
        if (errorInfo.context.includes('initialization') || 
            errorInfo.context.includes('setup') ||
            errorInfo.context.includes('FeatureSelector') ||
            errorInfo.context.includes('WorkflowGuide') ||
            errorInfo.context.includes('MaterialRenderer')) {
            console.warn('Initialization error (not shown to user):', errorInfo.message);
            return;
        }
        
        // Map technical errors to user-friendly messages
        if (errorInfo.message.includes('Failed to fetch') || errorInfo.message.includes('Network')) {
            userMessage = isZh ? '网络连接失败，请检查网络后重试' : 'Network connection failed, please check your connection and try again';
        } else if (errorInfo.message.includes('File too large')) {
            userMessage = isZh ? '文件过大，请选择较小的图片文件' : 'File too large, please select a smaller image file';
        } else if (errorInfo.message.includes('Invalid file type')) {
            userMessage = isZh ? '不支持的文件类型，请选择图片文件' : 'Unsupported file type, please select an image file';
        } else if (errorInfo.context.includes('drag') || errorInfo.context.includes('drop')) {
            userMessage = isZh ? '拖拽操作失败，请重试' : 'Drag operation failed, please try again';
        } else if (errorInfo.context.includes('material') || errorInfo.context.includes('canvas')) {
            userMessage = isZh ? '材质渲染失败，请刷新页面重试' : 'Material rendering failed, please refresh the page and try again';
        } else {
            userMessage = isZh ? '操作失败，请重试' : 'Operation failed, please try again';
        }
        
        // Notification removed as requested
    }

    showNotification(message, type = 'info', duration = 5000) {
        // Create or get notification container
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4caf50' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
            pointer-events: auto;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        notification.textContent = message;

        container.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);

        // Auto remove
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    validateImageFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }
        
        if (!file.type.startsWith('image/')) {
            throw new Error('Invalid file type - must be an image');
        }
        
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            throw new Error('File too large - maximum size is 10MB');
        }
        
        return true;
    }

    validateElementPosition(element, container) {
        if (!element || !container) {
            throw new Error('Invalid element or container');
        }
        
        const elementRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Check if element is completely outside container
        if (elementRect.right < containerRect.left || 
            elementRect.left > containerRect.right ||
            elementRect.bottom < containerRect.top || 
            elementRect.top > containerRect.bottom) {
            return false;
        }
        
        return true;
    }
}

// 材料效果渲染器
class MaterialRenderer {
    constructor() {
        this.canvases = {
            front: null,
            back: null
        };
        this.contexts = {
            front: null,
            back: null
        };
        this.init();
    }

    init() {
        try {
            // 初始化Canvas元素
            this.canvases.front = document.getElementById('frontMaterialCanvas');
            this.canvases.back = document.getElementById('backMaterialCanvas');
            
            if (this.canvases.front) {
                const context = this.canvases.front.getContext('2d');
                if (context) {
                    this.contexts.front = context;
                    this.setupCanvas(this.canvases.front, this.contexts.front);
                } else {
                    console.warn('Failed to get 2D context for front canvas');
                }
            } else {
                console.warn('Front material canvas not found');
            }
            
            if (this.canvases.back) {
                const context = this.canvases.back.getContext('2d');
                if (context) {
                    this.contexts.back = context;
                    this.setupCanvas(this.canvases.back, this.contexts.back);
                } else {
                    console.warn('Failed to get 2D context for back canvas');
                }
            } else {
                console.warn('Back material canvas not found');
            }
            
        } catch (error) {
            console.error('Error initializing MaterialRenderer:', error);
        }
    }

    setupCanvas(canvas, context) {
        try {
            if (!canvas || !context) return;
            
            // Get parent element dimensions
            const parent = canvas.parentElement;
            if (!parent) return;
            
            const rect = parent.getBoundingClientRect();
            
            // Only update if dimensions have changed
            if (canvas.width !== rect.width || canvas.height !== rect.height) {
                canvas.width = Math.max(1, rect.width);
                canvas.height = Math.max(1, rect.height);
                
                // Set high quality rendering
                context.imageSmoothingEnabled = true;
                if (context.imageSmoothingQuality) {
                    context.imageSmoothingQuality = 'high';
                }
            }
            
        } catch (error) {
            console.error('Error setting up canvas:', error);
        }
    }

    renderMaterial(material, side = 'front') {
        try {
            const canvas = this.canvases[side];
            const context = this.contexts[side];
            
            if (!canvas || !context) {
                console.warn(`Canvas or context not found for side: ${side}`);
                return;
            }

            // Ensure canvas is properly sized
            this.setupCanvas(canvas, context);

            // Validate canvas dimensions
            if (canvas.width <= 0 || canvas.height <= 0) {
                console.warn(`Invalid canvas dimensions for ${side}: ${canvas.width}x${canvas.height}`);
                return;
            }

            // Clear previous effects
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            if (!material) {
                return; // No material selected yet
            }
            
            // Save context state before rendering
            context.save();
            
            try {
                switch (material) {
                    case 'pvc':
                        this.renderPVCEffect(canvas, context);
                        break;
                    case 'wood':
                        this.renderWoodEffect(canvas, context);
                        break;
                    case 'metal':
                        this.renderMetalEffect(canvas, context, side);
                        break;
                    default:
                        console.warn(`Unknown material type: ${material}`);
                        // Clear effects for unknown materials
                        context.clearRect(0, 0, canvas.width, canvas.height);
                        break;
                }
            } finally {
                // Always restore context state
                context.restore();
            }
            
        } catch (error) {
            console.error('Error rendering material:', error);
            // Try to clear the canvas on error to prevent corrupted state
            try {
                const canvas = this.canvases[side];
                const context = this.contexts[side];
                if (canvas && context) {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }
            } catch (clearError) {
                console.error('Error clearing canvas after render error:', clearError);
            }
        }
    }

    renderPVCEffect(canvas, context) {
        try {
            if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) return;
            
            // PVC光泽效果
            const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, 'rgba(255,255,255,0.1)');
            gradient.addColorStop(0.3, 'rgba(255,255,255,0.25)');
            gradient.addColorStop(0.7, 'rgba(255,255,255,0.15)');
            gradient.addColorStop(1, 'rgba(255,255,255,0.05)');
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // 添加细微的反射条纹
            for (let i = 0; i < canvas.width; i += 40) {
                const stripeGradient = context.createLinearGradient(i, 0, i + 20, canvas.height);
                stripeGradient.addColorStop(0, 'rgba(255,255,255,0.08)');
                stripeGradient.addColorStop(0.5, 'rgba(255,255,255,0.02)');
                stripeGradient.addColorStop(1, 'rgba(255,255,255,0.08)');
                
                context.fillStyle = stripeGradient;
                context.fillRect(i, 0, 2, canvas.height);
            }
        } catch (error) {
            console.error('Error rendering PVC effect:', error);
        }
    }

    renderWoodEffect(canvas, context) {
        try {
            if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) return;
            
            // 木质纹理基底
            const woodBase = context.createLinearGradient(0, 0, canvas.width, 0);
            woodBase.addColorStop(0, 'rgba(139,115,85,0.15)');
            woodBase.addColorStop(0.25, 'rgba(210,180,140,0.2)');
            woodBase.addColorStop(0.5, 'rgba(218,165,32,0.25)');
            woodBase.addColorStop(0.75, 'rgba(139,115,85,0.2)');
            woodBase.addColorStop(1, 'rgba(210,180,140,0.15)');
            
            context.fillStyle = woodBase;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // 木纹纹理
            for (let y = 0; y < canvas.height; y += 8) {
                const grainIntensity = Math.sin(y * 0.1) * 0.1 + 0.1;
                const grainGradient = context.createLinearGradient(0, y, canvas.width, y);
                grainGradient.addColorStop(0, `rgba(139,115,85,${grainIntensity})`);
                grainGradient.addColorStop(0.5, `rgba(101,67,33,${grainIntensity * 1.5})`);
                grainGradient.addColorStop(1, `rgba(139,115,85,${grainIntensity})`);
                
                context.fillStyle = grainGradient;
                context.fillRect(0, y, canvas.width, 2);
            }
            
            // 添加木质光泽
            const maxRadius = Math.max(canvas.width, canvas.height);
            const woodShine = context.createRadialGradient(
                canvas.width * 0.3, canvas.height * 0.3, 0,
                canvas.width * 0.7, canvas.height * 0.7, maxRadius
            );
            woodShine.addColorStop(0, 'rgba(255,255,255,0.1)');
            woodShine.addColorStop(0.6, 'rgba(255,255,255,0.05)');
            woodShine.addColorStop(1, 'rgba(0,0,0,0.1)');
            
            context.fillStyle = woodShine;
            context.fillRect(0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.error('Error rendering wood effect:', error);
        }
    }

    renderMetalEffect(canvas, context, side) {
        try {
            if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) return;
            
            // 金属材质对背面特殊处理
            if (side === 'back') {
                // 背面是塑料材质，使用PVC效果
                this.renderPVCEffect(canvas, context);
                return;
            }
            
            // 金属基底
            const metalBase = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            metalBase.addColorStop(0, 'rgba(44,62,80,0.3)');
            metalBase.addColorStop(0.5, 'rgba(52,73,94,0.4)');
            metalBase.addColorStop(1, 'rgba(44,62,80,0.3)');
            
            context.fillStyle = metalBase;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // 金属反射效果
            const reflection1 = context.createRadialGradient(
                canvas.width * 0.3, canvas.height * 0.4, 0,
                canvas.width * 0.3, canvas.height * 0.4, canvas.width * 0.6
            );
            reflection1.addColorStop(0, 'rgba(255,255,255,0.15)');
            reflection1.addColorStop(0.5, 'rgba(255,255,255,0.08)');
            reflection1.addColorStop(1, 'rgba(255,255,255,0)');
            
            context.fillStyle = reflection1;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            const reflection2 = context.createRadialGradient(
                canvas.width * 0.7, canvas.height * 0.6, 0,
                canvas.width * 0.7, canvas.height * 0.6, canvas.width * 0.4
            );
            reflection2.addColorStop(0, 'rgba(255,255,255,0.08)');
            reflection2.addColorStop(0.8, 'rgba(255,255,255,0.03)');
            reflection2.addColorStop(1, 'rgba(255,255,255,0)');
            
            context.fillStyle = reflection2;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // 金属划痕效果
            context.save();
            context.strokeStyle = 'rgba(255,255,255,0.1)';
            context.lineWidth = 1;
            
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                const length = Math.random() * 50 + 20;
                const angle = Math.random() * Math.PI;
                
                context.beginPath();
                context.moveTo(x, y);
                context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
                context.stroke();
            }
            
            context.restore();
        } catch (error) {
            console.error('Error rendering metal effect:', error);
        }
    }

    updateCanvasSize() {
        // 响应式更新Canvas尺寸
        Object.keys(this.canvases).forEach(side => {
            const canvas = this.canvases[side];
            if (canvas) {
                this.setupCanvas(canvas, this.contexts[side]);
            }
        });
    }
}

// 多语言配置
const translations = {
    en: {
        'title': 'PVC Card Design Platform',
        'save': 'Submit Design',
        'preview': 'Preview',
        'material-selection': 'Material Selection',
        'material-pvc': 'Standard PVC',
        'material-wood': 'Wood Material',
        'material-metal': 'Metal Material',
        'template-selection': 'Template Selection',
        'template-blank': 'Blank Template',
        'template-blue': 'Blue Semi-Custom',
        'template-pink': 'Pink Semi-Custom',
        'card-settings': 'Card Settings',
        'front': 'Front',
        'back': 'Back',
        'metal-warning': 'Metal card back is plastic material',
        'metal-warning-front': 'Metal card front is metal material, only supports engraving design',
        'single-color-warning': 'This material only supports monochrome engraving design',
        'semi-custom-title': 'Semi-Custom Mode',
        'semi-custom-desc': 'You can only edit: Name, Job Title, and Logo',
        'semi-custom-back-locked': 'Back side is locked and cannot be edited',
        'metal-back-title': 'Metal Back Side',
        'metal-back-desc': 'Metal card back is plastic material and cannot be edited',
        'user-info-title': 'Submit Your Design',
        'user-info-desc': 'Please provide your information to receive your design:',
        'name-label': 'Name *',
        'email-label': 'Email *',
        'phone-label': 'Phone (Optional)',
        'notes-label': 'Special Requirements or Notes (Optional)',
        'submit-design': 'Submit Design',
        'name-required': 'Name is required',
        'email-required': 'Email is required',
        'email-invalid': 'Please enter a valid email address',
        'design-tools': 'Design Tools',
        'upload-image': 'Upload Image',
        'add-text': 'Add Text',
        'add-shape': 'Add Shape',
        'delete-element': 'Delete Element',
        'drop-zone-text1': 'Drag or click to upload image',
        'drop-zone-text2': 'Or use the tools on the right to add elements',
        'properties': 'Properties',
        'select-element': 'Select an element to edit properties',
        'text-edit': 'Text Edit',
        'text-content': 'Text Content:',
        'text-placeholder': 'Enter text content...',
        'font-family': 'Font:',
        'font-size': 'Font Size:',
        'color': 'Color:',
        'style': 'Style:',
        'alignment': 'Alignment:',
        'confirm': 'Confirm',
        'cancel': 'Cancel',
        'select-shape': 'Select Shape',
        'rectangle': 'Rectangle',
        'circle': 'Circle',
        'fill-settings': 'Fill Settings',
        'enable-fill': 'Enable Fill',
        'stroke-settings': 'Stroke Settings',
        'enable-stroke': 'Enable Stroke',
        'thickness': 'Thickness:',
        'stroke-style': 'Style:',
        'confirm-add': 'Confirm Add',
        'text-content-prop': 'Text Content:',
        'font-size-prop': 'Font Size:',
        'color-prop': 'Color:',
        'width-prop': 'Width:',
        'height-prop': 'Height:',
        'fill-color-prop': 'Fill Color:',
        'size-prop': 'Size:',
        'workflow-title': 'Quick Start Guide',
        'step1-title': 'Choose Your Material',
        'step1-desc': 'Select the material for your card. Different materials have different features and limitations.',
        'step2-title': 'Select a Template',
        'step2-desc': 'Choose a template as your starting point. You can customize everything later.',
        'step3-title': 'Add Your Content',
        'step3-desc': 'Use the design tools to add text, images, or shapes to your card.',
        'step4-title': 'Preview and Submit',
        'step4-desc': 'Review your design and submit it for production when ready.',
        'skip': 'Skip Guide',
        'next': 'Next',
        'finish': 'Finish Guide',
        'material': 'Material',
        'template': 'Template', 
        'image': 'Image',
        'text': 'Text',
        'shape': 'Shape',
        'select-image': 'Select Image',
        'add-text-element': 'Add Text Element',
        'opacity': 'Opacity',
        'fill-color': 'Fill Color',
        'stroke-color': 'Stroke Color',
        'upload-your-image': 'Upload Your Image',
        'upload-hint': 'Drag & drop or click to browse',
        'add-qr-code': 'Add QR Code',
        'qr-code': 'QR Code',
        'qr-code-management': 'QR Code Management',
        'qr-required-notice': 'For proper card functionality, we will generate an exclusive QR code for your card',
        'qr-main-notice': 'QR code is required for PVC full customization cards. We will generate an exclusive QR code for your card.',
        'qr-added-status': 'QR code has been added to your card',
        'remove-qr': 'Remove QR Code',
        'qr-missing-warning': 'QR code not added yet',
        'add-now': 'Add Now',
        'dimensions': 'Dimensions',
        'width': 'Width',
        'height': 'Height',
        'lock-aspect': 'Lock Aspect Ratio',
        'position': 'Position',
        'x-position': 'X',
        'y-position': 'Y',
        'appearance': 'Appearance',
        'rotation': 'Rotation',
        'delete-image': 'Delete Image',
        'text-hint': 'Click to add a new text element',
        'content': 'Content',
        'typography': 'Typography',
        'font-family': 'Font',
        'style': 'Style',
        'delete-text': 'Delete Text',
        'shape-hint': 'Click to add a shape to your design',
        'stroke-width': 'Stroke Width',
        'delete-shape': 'Delete Shape'
    },
    zh: {
        'title': 'PVC卡片定制设计平台',
        'save': '提交设计',
        'preview': '预览',
        'material-selection': '材质选择',
        'material-pvc': '普通PVC',
        'material-wood': '木质材质',
        'material-metal': '金属材质',
        'template-selection': '模板选择',
        'template-blank': '空白模板',
        'template-blue': '蓝色半定制',
        'template-pink': '粉色半定制',
        'card-settings': '卡片设置',
        'front': '正面',
        'back': '背面',
        'metal-warning': '金属卡片背面为塑料材质',
        'metal-warning-front': '金属卡片正面为金属材质,该材质仅支持雕刻设计',
        'single-color-warning': '该材质仅支持单色雕刻设计',
        'semi-custom-title': '半定制模式',
        'semi-custom-desc': '您只能编辑：姓名、职位和Logo',
        'semi-custom-back-locked': '背面已锁定，无法编辑',
        'metal-back-title': '金属背面',
        'metal-back-desc': '金属卡片背面为塑料材质，无法编辑',
        'user-info-title': '提交您的设计',
        'user-info-desc': '请填写您的信息以接收设计：',
        'name-label': '姓名 *',
        'email-label': '邮箱 *',
        'phone-label': '电话（选填）',
        'notes-label': '特殊要求或备注（选填）',
        'submit-design': '提交设计',
        'name-required': '请输入姓名',
        'email-required': '请输入邮箱',
        'email-invalid': '请输入有效的邮箱地址',
        'design-tools': '设计工具',
        'upload-image': '上传图片',
        'add-qr-code': '添加二维码',
        'qr-code': '二维码',
        'qr-code-management': '二维码管理',
        'qr-required-notice': '为了卡片的正常使用，我们会为你的卡片生成一个专属二维码',
        'qr-main-notice': 'PVC全定制卡片需要添加二维码。我们将为您的卡片生成专属二维码。',
        'qr-added-status': '二维码已添加到您的卡片',
        'remove-qr': '移除二维码',
        'qr-missing-warning': '尚未添加二维码',
        'add-now': '立即添加',
        'add-text': '添加文字',
        'add-shape': '添加形状',
        'delete-element': '删除元素',
        'drop-zone-text1': '拖拽或点击上传图片',
        'drop-zone-text2': '或使用右侧工具添加元素',
        'properties': '属性设置',
        'select-element': '选择元素以编辑属性',
        'text-edit': '文字编辑',
        'text-content': '文字内容:',
        'text-placeholder': '输入文字内容...',
        'font-family': '字体:',
        'font-size': '字号:',
        'color': '颜色:',
        'style': '样式:',
        'alignment': '对齐:',
        'confirm': '确认',
        'cancel': '取消',
        'select-shape': '选择形状',
        'rectangle': '矩形',
        'circle': '圆形',
        'fill-settings': '填充设置',
        'enable-fill': '启用填充',
        'stroke-settings': '轮廓设置',
        'enable-stroke': '启用轮廓',
        'thickness': '粗细:',
        'stroke-style': '样式:',
        'confirm-add': '确认添加',
        'text-content-prop': '文字内容:',
        'font-size-prop': '字体大小:',
        'color-prop': '颜色:',
        'width-prop': '宽度:',
        'height-prop': '高度:',
        'fill-color-prop': '填充颜色:',
        'size-prop': '大小:',
        'workflow-title': '快速入门引导',
        'step1-title': '选择您的材质',
        'step1-desc': '为您的卡片选择材质。不同材质有不同的特性和限制。',
        'step2-title': '选择模板',
        'step2-desc': '选择一个模板作为起点。您稍后可以自定义所有内容。',
        'step3-title': '添加您的内容',
        'step3-desc': '使用设计工具为您的卡片添加文字、图片或形状。',
        'step4-title': '预览并提交',
        'step4-desc': '检查您的设计，准备好后提交生产。',
        'skip': '跳过引导',
        'next': '下一步',
        'finish': '完成引导',
        'material': '材质',
        'template': '模板',
        'image': '图片', 
        'text': '文字',
        'shape': '形状',
        'select-image': '选择图片',
        'add-text-element': '添加文字元素',
        'opacity': '透明度',
        'fill-color': '填充颜色',
        'stroke-color': '描边颜色',
        'upload-your-image': '上传您的图片',
        'upload-hint': '拖拽上传或点击浏览',
        'dimensions': '尺寸',
        'width': '宽度',
        'height': '高度',
        'lock-aspect': '锁定宽高比',
        'position': '位置',
        'x-position': 'X坐标',
        'y-position': 'Y坐标',
        'appearance': '外观',
        'rotation': '旋转',
        'delete-image': '删除图片',
        'text-hint': '点击添加新的文字元素',
        'content': '内容',
        'typography': '排版',
        'font-family': '字体',
        'style': '样式',
        'delete-text': '删除文字',
        'shape-hint': '点击添加形状到您的设计',
        'stroke-width': '边框宽度',
        'delete-shape': '删除形状'
    }
};

// 工作流程引导系统
class WorkflowGuide {
    constructor(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.currentStep = 0;
        this.totalSteps = 4;
        this.isActive = false;
        
        this.steps = [
            {
                title: 'step1-title',
                description: 'step1-desc',
                targetSelector: '[data-feature="material"]',
                action: 'select-material'
            },
            {
                title: 'step2-title', 
                description: 'step2-desc',
                targetSelector: '[data-feature="template"]',
                action: 'select-template'
            },
            {
                title: 'step3-title',
                description: 'step3-desc', 
                targetSelector: '[data-feature="image"]',
                action: 'use-tools'
            },
            {
                title: 'step4-title',
                description: 'step4-desc',
                targetSelector: '#saveBtn',
                action: 'preview-submit'
            }
        ];
        
        this.init();
    }
    
    init() {
        // Force disable the workflow guide completely to fix blocking issue
        this.hide();
        localStorage.setItem('pvc-card-guide-seen', 'true');
        return;
        
        this.setupEventListeners();
        
        const guideSeen = localStorage.getItem('pvc-card-guide-seen');
        if (guideSeen) {
            this.hide();
        } else {
            this.start();
        }
    }
    
    setupEventListeners() {
        try {
            // Check if workflow elements exist before setting up listeners
            const nextStep = document.getElementById('nextStep');
            const skipWorkflow = document.getElementById('skipWorkflow');
            const guideOverlay = document.getElementById('guideOverlay');
            
            if (!nextStep || !skipWorkflow || !guideOverlay) {
                console.warn('Workflow guide elements not found, skipping setup');
                return;
            }
            
            // 下一步按钮
            nextStep.addEventListener('click', () => {
                this.nextStep();
            });
            
            // 跳过引导
            skipWorkflow.addEventListener('click', () => {
                this.skip();
            });
            
            // 点击覆盖层关闭
            guideOverlay.addEventListener('click', () => {
                this.nextStep();
            });
        } catch (error) {
            console.warn('WorkflowGuide setup failed:', error);
        }
    }
    
    start() {
        this.isActive = true;
        this.currentStep = 0;
        this.showOverlay();
        this.updateStep();
        this.highlightTarget();
    }
    
    nextStep() {
        this.currentStep++;
        
        if (this.currentStep >= this.totalSteps) {
            this.complete();
            return;
        }
        
        this.updateStep();
        this.highlightTarget();
    }
    
    updateStep() {
        try {
            const step = this.steps[this.currentStep];
            const progress = ((this.currentStep + 1) / this.totalSteps) * 100;
            
            // 更新内容
            const stepTitle = document.getElementById('stepTitle');
            if (stepTitle) {
                stepTitle.setAttribute('data-translate', step.title);
            }
            
            const stepDescription = document.getElementById('stepDescription');
            if (stepDescription) {
                stepDescription.setAttribute('data-translate', step.description);
            }
            
            // 更新进度
            const progressFill = document.getElementById('progressFill');
            if (progressFill) {
                progressFill.style.width = `${progress}%`;
            }
            
            const progressText = document.getElementById('progressText');
            if (progressText) {
                progressText.textContent = `${this.currentStep + 1}/${this.totalSteps}`;
            }
            
            // 更新按钮文本
            const nextBtn = document.getElementById('nextStep');
            if (nextBtn) {
                if (this.currentStep === this.totalSteps - 1) {
                    nextBtn.setAttribute('data-translate', 'finish');
                } else {
                    nextBtn.setAttribute('data-translate', 'next');
                }
            }
            
            // 重新翻译文本
            this.cardDesigner.updateLanguage();
        } catch (error) {
            console.warn('WorkflowGuide updateStep failed:', error);
        }
    }
    
    highlightTarget() {
        try {
            // 清除之前的高亮
            this.clearHighlight();
            
            const step = this.steps[this.currentStep];
            const target = document.querySelector(step.targetSelector);
            
            if (target) {
                target.classList.add('guide-highlight');
                
                // 确保目标元素可见
                this.ensureVisible(target);
                
                // 显示引导覆盖层
                const guideOverlay = document.getElementById('guideOverlay');
                if (guideOverlay) {
                    guideOverlay.classList.add('active');
                }
            }
        } catch (error) {
            console.warn('WorkflowGuide highlightTarget failed:', error);
        }
    }
    
    ensureVisible(element) {
        // 如果是下拉菜单内容，先展开它
        const dropdown = element.closest('.dropdown-section');
        if (dropdown) {
            const header = dropdown.querySelector('.dropdown-header');
            const content = dropdown.querySelector('.dropdown-content');
            if (header && content && !content.style.display) {
                header.click();
            }
        }
        
        // 滚动到可见区域
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }
    
    clearHighlight() {
        try {
            document.querySelectorAll('.guide-highlight').forEach(el => {
                el.classList.remove('guide-highlight');
            });
            
            const guideOverlay = document.getElementById('guideOverlay');
            if (guideOverlay) {
                guideOverlay.classList.remove('active');
            }
        } catch (error) {
            console.warn('WorkflowGuide clearHighlight failed:', error);
        }
    }
    
    complete() {
        this.isActive = false;
        this.clearHighlight();
        this.hide();
        
        // 标记用户已看过引导
        localStorage.setItem('pvc-card-guide-seen', 'true');
    }
    
    skip() {
        this.complete();
    }
    
    showOverlay() {
        try {
            const workflowOverlay = document.getElementById('workflowOverlay');
            if (workflowOverlay) {
                workflowOverlay.classList.remove('hidden');
            }
        } catch (error) {
            console.warn('WorkflowGuide showOverlay failed:', error);
        }
    }
    
    hide() {
        try {
            const workflowOverlay = document.getElementById('workflowOverlay');
            if (workflowOverlay) {
                workflowOverlay.classList.add('hidden');
            }
        } catch (error) {
            console.warn('WorkflowGuide hide failed:', error);
        }
    }
    
    // 重置引导状态（用于调试）
    reset() {
        localStorage.removeItem('pvc-card-guide-seen');
        this.start();
    }
}

// 功能选择器管理器
class FeatureSelector {
    constructor(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.currentFeature = 'material';
        this.init();
    }

    init() {
        try {
            // Delay initialization to ensure DOM is ready
            setTimeout(() => {
                this.setupEventListeners();
                this.showFeature('material'); // 默认显示材质功能
            }, 200);
        } catch (error) {
            console.error('FeatureSelector init failed:', error);
            this.cardDesigner.errorHandler.handleError(error, 'FeatureSelector initialization', false);
        }
    }

    setupEventListeners() {
        try {
            // Setup event listeners for feature tabs
            const featureTabs = document.querySelectorAll('.feature-tab');
            
            if (featureTabs.length === 0) {
                console.warn('No feature tabs found - feature selector may not work');
                return;
            }
            
            featureTabs.forEach((tab, index) => {
                // Clear any existing event listeners
                const newTab = tab.cloneNode(true);
                tab.parentNode.replaceChild(newTab, tab);
                
                // Add click event listener
                newTab.addEventListener('click', (e) => {
                    try {
                        e.preventDefault();
                        e.stopPropagation();
                        const feature = e.currentTarget.dataset.feature;
                        
                        if (feature) {
                            this.selectFeature(feature);
                        }
                    } catch (error) {
                        console.error('Error in feature tab click:', error);
                    }
                });
                
                // Add visual feedback
                newTab.addEventListener('mouseenter', () => {
                    if (!newTab.classList.contains('active')) {
                        newTab.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
                        newTab.style.cursor = 'pointer';
                    }
                });
                
                newTab.addEventListener('mouseleave', () => {
                    if (!newTab.classList.contains('active')) {
                        newTab.style.backgroundColor = '';
                    }
                });
                
                // Ensure tab is clickable
                newTab.style.pointerEvents = 'auto';
                newTab.style.cursor = 'pointer';
            });
                
            console.log('Feature tabs setup completed successfully');
            
        } catch (error) {
            console.error('Error setting up FeatureSelector event listeners:', error);
            this.cardDesigner.errorHandler.handleError(error, 'FeatureSelector setup', false);
        }
    }

    selectFeature(feature) {
        try {
            console.log(`Selecting feature: ${feature}`);
            this.currentFeature = feature;
            
            // 更新标签状态
            document.querySelectorAll('.feature-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            const selectedTab = document.querySelector(`[data-feature="${feature}"]`);
            if (selectedTab) {
                selectedTab.classList.add('active');
            } else {
                console.warn(`Feature tab not found: ${feature}`);
            }
            
            // 显示对应的属性面板
            this.showFeature(feature);
        } catch (error) {
            console.error('Error selecting feature:', error);
        }
    }

    showFeature(feature) {
        // 隐藏所有属性内容
        document.querySelectorAll('.property-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // 显示选定的属性内容
        const targetContent = document.getElementById(`${feature}Properties`);
        if (targetContent) {
            targetContent.classList.add('active');
        }
        
        // 触发特定功能的初始化逻辑
        this.initializeFeature(feature);
    }

    initializeFeature(feature) {
        switch (feature) {
            case 'material':
                // 材质功能已经在CardDesigner中处理
                break;
            case 'template':
                // 模板功能已经在CardDesigner中处理
                break;
            case 'image':
                this.initializeImageFeature();
                break;
            case 'text':
                this.initializeTextFeature();
                break;
            case 'shape':
                this.initializeShapeFeature();
                break;
        }
    }

    initializeImageFeature() {
        // 显示图片控件
        const controls = document.querySelector('#imageProperties .image-properties');
        if (controls && this.cardDesigner.selectedElement && 
            this.cardDesigner.selectedElement.classList.contains('image-element')) {
            controls.style.display = 'block';
        }
    }

    initializeTextFeature() {
        // 显示文字控件
        const controls = document.querySelector('#textProperties .text-properties');
        if (controls && this.cardDesigner.selectedElement && 
            this.cardDesigner.selectedElement.classList.contains('text-element')) {
            controls.style.display = 'block';
        }
    }

    initializeShapeFeature() {
        // 显示形状控件
        const controls = document.querySelector('#shapeProperties .shape-properties');
        if (controls && this.cardDesigner.selectedElement && 
            this.cardDesigner.selectedElement.classList.contains('shape-element')) {
            controls.style.display = 'block';
        }
    }
}

// 操作历史管理器
class HistoryManager {
    constructor(cardDesigner) {
        this.cardDesigner = cardDesigner;
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        // 保存初始状态
        this.saveState();
    }

    setupEventListeners() {
        // Undo按钮
        document.getElementById('undoBtn').addEventListener('click', () => {
            this.undo();
        });

        // Redo按钮
        document.getElementById('redoBtn').addEventListener('click', () => {
            this.redo();
        });
    }

    saveState() {
        try {
            // Create deep copy of current state
            const state = {
                elements: this.deepCopyElements(this.cardDesigner.elements),
                material: this.cardDesigner.currentMaterial,
                template: this.cardDesigner.currentTemplate,
                side: this.cardDesigner.currentSide,
                timestamp: Date.now()
            };

            // 移除当前索引后的所有状态（如果用户在历史中间做了新操作）
            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1);
            }

            // Check if state is different from last saved state
            if (this.history.length > 0) {
                const lastState = this.history[this.history.length - 1];
                if (this.statesEqual(state, lastState)) {
                    return; // Don't save duplicate states
                }
            }

            // 添加新状态
            this.history.push(state);
            
            // 限制历史大小
            if (this.history.length > this.maxHistorySize) {
                this.history.shift();
            } else {
                this.currentIndex++;
            }

            this.updateButtons();
            
        } catch (error) {
            this.cardDesigner.errorHandler.handleError(error, 'save history state', false);
        }
    }

    deepCopyElements(elements) {
        try {
            const copy = { front: [], back: [] };
            
            ['front', 'back'].forEach(side => {
                if (elements[side]) {
                    copy[side] = elements[side].map(elementData => {
                        // Create a safe copy without DOM references
                        return {
                            type: elementData.type,
                            serializable: elementData.serializable ? JSON.parse(JSON.stringify(elementData.serializable)) : null,
                            id: elementData.id || Date.now() + Math.random()
                        };
                    });
                }
            });
            
            return copy;
        } catch (error) {
            this.cardDesigner.errorHandler.handleError(error, 'deep copy elements', false);
            return { front: [], back: [] };
        }
    }

    statesEqual(state1, state2) {
        try {
            return JSON.stringify(state1.elements) === JSON.stringify(state2.elements) &&
                   state1.material === state2.material &&
                   state1.template === state2.template &&
                   state1.side === state2.side;
        } catch (error) {
            return false;
        }
    }

    undo() {
        if (this.canUndo()) {
            this.currentIndex--;
            this.restoreState(this.history[this.currentIndex]);
            this.updateButtons();
        }
    }

    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            this.restoreState(this.history[this.currentIndex]);
            this.updateButtons();
        }
    }

    restoreState(state) {
        try {
            // Clear current selection
            this.cardDesigner.deselectElement();
            
            // Restore design state
            this.cardDesigner.elements = this.deepCopyElements(state.elements);
            this.cardDesigner.currentMaterial = state.material;
            this.cardDesigner.currentTemplate = state.template;
            this.cardDesigner.currentSide = state.side;

            // Update UI to reflect restored state
            if (state.material) {
                document.querySelectorAll('.material-option').forEach(option => {
                    option.classList.remove('active');
                });
                const materialElement = document.querySelector(`[data-material="${state.material}"]`);
                if (materialElement) {
                    materialElement.classList.add('active');
                }
                
                // Update material warnings and restrictions
                this.cardDesigner.updateMaterialWarnings();
                this.cardDesigner.updateTemplateRestrictions();
            }

            if (state.template) {
                document.querySelectorAll('.template-item').forEach(item => {
                    item.classList.remove('active');
                });
                const templateElement = document.querySelector(`[data-template="${state.template}"]`);
                if (templateElement) {
                    templateElement.classList.add('active');
                }
            }

            // Update menu visibility
            this.cardDesigner.updateMenuVisibility();

            // Re-render elements and apply effects
            this.cardDesigner.renderElements();
            
            // Apply material effects
            if (state.material) {
                this.cardDesigner.applyMaterial();
                
                // Re-render material effects
                if (this.cardDesigner.materialRenderer) {
                    setTimeout(() => {
                        this.cardDesigner.materialRenderer.renderMaterial(state.material, 'front');
                        this.cardDesigner.materialRenderer.renderMaterial(state.material, 'back');
                    }, 50);
                }
            }
            
            // Switch to correct side
            this.cardDesigner.switchSide(state.side);
            
            // Show feedback
            const action = this.currentIndex < this.history.length - 1 ? 'redo' : 'undo';
            const message = this.cardDesigner.currentLanguage === 'zh' 
                ? (action === 'undo' ? '撤销完成' : '重做完成')
                : (action === 'undo' ? 'Undo completed' : 'Redo completed');
            // Notification removed as requested
            
        } catch (error) {
            this.cardDesigner.errorHandler.handleError(error, 'restore state');
        }
    }

    canUndo() {
        return this.currentIndex > 0;
    }

    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }

    updateButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        undoBtn.disabled = !this.canUndo();
        redoBtn.disabled = !this.canRedo();
    }

    // 在重要操作后调用
    recordAction() {
        setTimeout(() => this.saveState(), 100);
    }

    // Validate and fix application state
    validateState() {
        try {
            // Ensure elements structure exists
            if (!this.cardDesigner.elements) {
                this.cardDesigner.elements = { front: [], back: [] };
            }
            
            if (!this.cardDesigner.elements.front) {
                this.cardDesigner.elements.front = [];
            }
            
            if (!this.cardDesigner.elements.back) {
                this.cardDesigner.elements.back = [];
            }
            
            // Clean up invalid elements
            ['front', 'back'].forEach(side => {
                this.cardDesigner.elements[side] = this.cardDesigner.elements[side].filter(elementData => {
                    if (!elementData || !elementData.element) {
                        return false;
                    }
                    
                    // Check if element still exists in DOM
                    if (!document.contains(elementData.element)) {
                        return false;
                    }
                    
                    return true;
                });
            });
            
            return true;
        } catch (error) {
            this.cardDesigner.errorHandler.handleError(error, 'validate application state', false);
            return false;
        }
    }
}

class CardDesigner {
    constructor() {
        this.currentSide = 'front';
        this.currentMaterial = null; // 初始为null，等待用户选择
        this.currentTemplate = null; // 初始为null，等待用户选择
        this.selectedElement = null;
        this.draggedElement = null;
        this.isResizing = false;
        this.isRotating = false;
        this.elements = {
            front: [],
            back: []
        };
        this.resizeHandle = null;
        this.rotateHandle = null;
        this.lastMousePos = { x: 0, y: 0 };
        this.restrictedMaterials = ['wood', 'metal']; // 限制材质
        this.currentLanguage = 'en'; // 默认语言为英文
        this.serverUrl = 'http://13.214.160.245:3000'; // 服务器地址
        this.isSubmitting = false; // 防止重复提交
        
        // 半定制模式状态
        this.isSemiCustomMode = false; // 是否为半定制模式
        // 半定制背面锁定状态由isSemiCustomMode和currentSide共同决定
        
        // Error handling and state management
        this.errorHandler = new ErrorHandler(this);
        this.isDragging = false;
        this.dragStartPos = { x: 0, y: 0 };
        this.elementStartPos = { x: 0, y: 0 };
        
        // 初始化材料渲染器
        this.materialRenderer = null;
        
        // 初始化工作流程引导
        this.workflowGuide = null;
        
        // 初始化功能选择器
        this.featureSelector = null;
        
        // 初始化历史管理器
        this.historyManager = null;
        
        this.init();
    }

    init() {
        try {
            // Initialize core functionality first
            this.setupEventListeners();
            this.setupDragDrop();
            
            // Initialize language system
            this.updateLanguage();
            
            // Initialize material renderer with error handling
            try {
                this.materialRenderer = new MaterialRenderer();
                // Ensure canvas resize on window resize
                window.addEventListener('resize', () => {
                    if (this.materialRenderer) {
                        this.materialRenderer.updateCanvasSize();
                    }
                });
            } catch (error) {
                console.warn('MaterialRenderer initialization failed:', error);
                this.materialRenderer = null;
            }
            
            // Initialize history manager early for state tracking
            try {
                this.historyManager = new HistoryManager(this);
            } catch (error) {
                console.warn('HistoryManager initialization failed:', error);
                this.historyManager = null;
            }
            
            // Initialize UI components with delay to ensure DOM is ready
            setTimeout(() => {
                try {
                    console.log('Initializing FeatureSelector...');
                    this.featureSelector = new FeatureSelector(this);
                    console.log('FeatureSelector initialized successfully');
                } catch (error) {
                    console.warn('FeatureSelector initialization failed:', error);
                    this.featureSelector = null;
                }
                
                try {
                    console.log('Initializing WorkflowGuide...');
                    this.workflowGuide = new WorkflowGuide(this);
                    console.log('WorkflowGuide initialized successfully');
                } catch (error) {
                    console.warn('WorkflowGuide initialization failed:', error);
                    this.workflowGuide = null;
                }
            }, 300); // Increased delay to ensure DOM is fully ready
            
            // Update UI state
            this.updateMaterialWarnings();
            this.updateMenuVisibility();
            
            // Set initial state
            this.switchSide('front');
            
            // Initialize element rendering
            this.renderElements();
            
            // Set up periodic state validation
            setInterval(() => {
                this.validateAndRepairState();
            }, 30000); // Validate every 30 seconds
            
            // Don't show success message on startup to avoid confusion
            console.log('CardDesigner initialized successfully');
            
        } catch (error) {
            this.errorHandler.handleError(error, 'CardDesigner initialization');
        }
    }

    setupEventListeners() {
        // 新界面不再需要下拉菜单系统

        // 语言切换
        document.getElementById('langBtn').addEventListener('click', () => {
            this.toggleLanguage();
        });

        // 正反面切换
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSide(e.target.dataset.side);
            });
        });

        // 材质选择
        document.querySelectorAll('.material-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectMaterial(e.currentTarget.dataset.material);
            });
        });

        // 模板选择
        document.querySelectorAll('.template-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.selectTemplate(e.currentTarget.dataset.template);
            });
        });

        // 工具按钮（在新界面的属性面板中）
        const uploadImageBtn = document.getElementById('uploadImageBtn');
        if (uploadImageBtn) {
            uploadImageBtn.addEventListener('click', () => {
                this.uploadImage();
            });
        }

        // 二维码按钮
        const addQRBtn = document.getElementById('addQRBtn');
        if (addQRBtn) {
            addQRBtn.addEventListener('click', () => {
                this.addQRCode();
            });
        }
        
        // 主要的QR码添加按钮（新的QR码面板中）
        const mainAddQRBtn = document.getElementById('mainAddQRBtn');
        if (mainAddQRBtn) {
            mainAddQRBtn.addEventListener('click', () => {
                this.addQRCode();
            });
        }
        
        // 横幅中的QR码添加按钮
        const bannerAddQRBtn = document.getElementById('bannerAddQRBtn');
        if (bannerAddQRBtn) {
            bannerAddQRBtn.addEventListener('click', () => {
                // 添加QR码并自动切换到QR码标签页
                this.addQRCode();
                if (this.featureSelector) {
                    this.featureSelector.selectFeature('qrcode');
                }
            });
        }
        
        // QR码移除按钮
        const removeQRBtn = document.getElementById('removeQRBtn');
        if (removeQRBtn) {
            removeQRBtn.addEventListener('click', () => {
                this.removeQRCode();
            });
        }

        const addTextBtn = document.getElementById('addTextBtn');
        if (addTextBtn) {
            addTextBtn.addEventListener('click', () => {
                this.addText();
            });
        }

        // 形状按钮（在属性面板中，有多个）
        document.querySelectorAll('.shape-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.addShape(e);
            });
        });

        // Fallback feature tab handling in case FeatureSelector fails
        setTimeout(() => {
            const featureTabs = document.querySelectorAll('.feature-tab');
            featureTabs.forEach(tab => {
                if (!tab.onclick && !tab.hasAttribute('data-listener-added')) {
                    console.log('Adding fallback listener to feature tab:', tab.dataset.feature);
                    tab.addEventListener('click', (e) => {
                        e.preventDefault();
                        const feature = e.currentTarget.dataset.feature;
                        console.log('Fallback feature tab clicked:', feature);
                        
                        // Update active state
                        featureTabs.forEach(t => t.classList.remove('active'));
                        e.currentTarget.classList.add('active');
                        
                        // Show corresponding property panel
                        document.querySelectorAll('.property-content').forEach(content => {
                            content.classList.remove('active');
                        });
                        
                        const targetContent = document.getElementById(`${feature}Properties`);
                        if (targetContent) {
                            targetContent.classList.add('active');
                        }
                    });
                    tab.setAttribute('data-listener-added', 'true');
                }
            });
        }, 500);

        // Delete buttons are now specific to each element type in property panels
        const deleteImageBtn = document.getElementById('deleteImageBtn');
        if (deleteImageBtn) {
            deleteImageBtn.addEventListener('click', () => {
                if (this.selectedElement) {
                    this.deleteElement(this.selectedElement);
                }
            });
        }
        
        const deleteTextBtn = document.getElementById('deleteTextBtn');
        if (deleteTextBtn) {
            deleteTextBtn.addEventListener('click', () => {
                if (this.selectedElement) {
                    this.deleteElement(this.selectedElement);
                }
            });
        }
        
        const deleteShapeBtn = document.getElementById('deleteShapeBtn');
        if (deleteShapeBtn) {
            deleteShapeBtn.addEventListener('click', () => {
                if (this.selectedElement) {
                    this.deleteElement(this.selectedElement);
                }
            });
        }

        // 形状悬浮窗系统
        this.setupShapePopup();

        // 文件输入
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files[0]);
        });

        // 文字编辑模态框
        this.setupTextModal();
        
        // 设置删除元素功能
        this.setupDeleteElement();

        // 键盘事件
        document.addEventListener('keydown', (e) => {
            try {
                // Delete key
                if (e.key === 'Delete' && this.selectedElement) {
                    this.deleteElement(this.selectedElement);
                }
                
                // Undo/Redo shortcuts
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        if (this.historyManager) {
                            this.historyManager.undo();
                        }
                    } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
                        e.preventDefault();
                        if (this.historyManager) {
                            this.historyManager.redo();
                        }
                    }
                }
                
                // Escape key to deselect
                if (e.key === 'Escape') {
                    this.deselectElement();
                }
                
            } catch (error) {
                this.errorHandler.handleError(error, 'keyboard event handler', false);
            }
        });

        // 点击空白处取消选择
        document.addEventListener('click', (e) => {
            try {
                // Check if click is on a draggable element or its children
                const clickedElement = e.target.closest('.draggable-element');
                const clickedProperties = e.target.closest('.properties-panel');
                const clickedModal = e.target.closest('.modal');
                const clickedPopup = e.target.closest('.shape-popup');
                
                // Don't deselect if clicking on element, properties panel, modals, or popups
                if (!clickedElement && !clickedProperties && !clickedModal && !clickedPopup) {
                    this.deselectElement();
                }
            } catch (error) {
                this.errorHandler.handleError(error, 'document click handler', false);
            }
        });
    }

    setupDropdownSystem() {
        // 默认只显示材质选择
        this.showOnlyMaterialSelection();
        
        // 下拉菜单点击事件
        document.querySelectorAll('.dropdown-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const dropdown = e.currentTarget.dataset.dropdown;
                const section = e.currentTarget.parentElement;
                
                // 切换当前菜单
                section.classList.toggle('active');
            });
        });
    }

    showOnlyMaterialSelection() {
        // 隐藏所有菜单
        document.querySelectorAll('.dropdown-section').forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });
        
        // 只显示材质选择
        const materialSection = document.querySelector('[data-dropdown="material"]').parentElement;
        if (materialSection) {
            materialSection.style.display = 'block';
            materialSection.classList.add('active');
        }
    }

    updateMenuVisibility() {
        const materialSelected = this.currentMaterial !== null;
        const templateSelected = this.currentTemplate !== null;
        
        // 根据选择状态显示对应菜单
        const templateSection = document.querySelector('[data-dropdown="template"]');
        const cardSection = document.querySelector('[data-dropdown="card"]');
        const toolsSection = document.querySelector('[data-dropdown="tools"]');
        
        if (materialSelected) {
            // 材质选择后显示并自动展开模板选择
            if (templateSection) {
                templateSection.parentElement.style.display = 'block';
                templateSection.parentElement.classList.add('active');
            }
            
            if (templateSelected) {
                // 模板选择后显示并自动展开卡片设置
                if (cardSection) {
                    cardSection.parentElement.style.display = 'block';
                    cardSection.parentElement.classList.add('active');
                }
                
                // 卡片设置后显示并自动展开设计工具
                if (toolsSection) {
                    toolsSection.parentElement.style.display = 'block';
                    toolsSection.parentElement.classList.add('active');
                }
            } else {
                if (cardSection) {
                    cardSection.parentElement.style.display = 'none';
                    cardSection.parentElement.classList.remove('active');
                }
                if (toolsSection) {
                    toolsSection.parentElement.style.display = 'none';
                    toolsSection.parentElement.classList.remove('active');
                }
            }
        } else {
            if (templateSection) {
                templateSection.parentElement.style.display = 'none';
                templateSection.parentElement.classList.remove('active');
            }
            if (cardSection) {
                cardSection.parentElement.style.display = 'none';
                cardSection.parentElement.classList.remove('active');
            }
            if (toolsSection) {
                toolsSection.parentElement.style.display = 'none';
                toolsSection.parentElement.classList.remove('active');
            }
        }
    }

    updateTemplateRestrictions() {
        const templateItems = document.querySelectorAll('.template-item');
        
        templateItems.forEach(item => {
            const template = item.dataset.template;
            
            if (this.currentMaterial === 'pvc') {
                // PVC材质：显示blank, blue, pink模板
                if (['blank', 'blue', 'pink'].includes(template)) {
                    item.classList.remove('hidden', 'disabled');
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                } else {
                    item.classList.add('hidden');
                }
            } else if (this.restrictedMaterials.includes(this.currentMaterial)) {
                // 限制材质（wood, metal）只能选择空白模板
                if (template === 'blank') {
                    item.classList.remove('hidden', 'disabled');
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                } else {
                    item.classList.add('disabled');
                    item.style.opacity = '0.3';
                    item.style.pointerEvents = 'none';
                }
            } else {
                // 其他材质只显示空白模板
                if (['blank'].includes(template)) {
                    item.classList.remove('hidden', 'disabled');
                    item.style.opacity = '1';
                    item.style.pointerEvents = 'auto';
                } else {
                    item.classList.add('hidden');
                }
            }
        });
    }

    updateMaterialWarnings() {
        const materialWarning = document.getElementById('materialWarning');
        const materialWarningText = materialWarning.querySelector('.warning-text');
        const singleColorWarning = document.getElementById('singleColorWarning');
        
        // 金属材质警告 - 根据当前面显示不同内容
        if (this.currentMaterial === 'metal') {
            materialWarning.style.display = 'block';
            
            if (this.currentSide === 'front') {
                materialWarningText.textContent = this.getText('metal-warning-front');
            } else {
                materialWarningText.textContent = this.getText('metal-warning');
            }
        } else {
            materialWarning.style.display = 'none';
        }
        
        // 单色雕刻警告 - 金属背面除外
        const showSingleColorWarning = this.restrictedMaterials.includes(this.currentMaterial) && 
                                     !(this.currentMaterial === 'metal' && this.currentSide === 'back');
        
        if (showSingleColorWarning) {
            singleColorWarning.style.display = 'block';
        } else {
            singleColorWarning.style.display = 'none';
        }
    }

    // 语言切换功能
    toggleLanguage() {
        this.currentLanguage = this.currentLanguage === 'en' ? 'zh' : 'en';
        this.updateLanguage();
    }
    
    getText(key) {
        return translations[this.currentLanguage][key] || key;
    }
    
    updateLanguage() {
        // 更新语言切换按钮文本
        const langBtn = document.getElementById('langBtn');
        langBtn.textContent = this.currentLanguage === 'en' ? '中文' : 'English';
        
        // 更新HTML文档语言属性
        document.documentElement.lang = this.currentLanguage === 'zh' ? 'zh-CN' : 'en';
        
        // 更新所有带有data-translate属性的元素
        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            const translatedText = this.getText(key);
            
            // Special handling for toggle buttons to prevent overflow
            if (element.classList.contains('toggle-btn')) {
                // Use shorter text for toggle buttons and ensure proper styling
                if (key === 'front') {
                    element.textContent = this.currentLanguage === 'zh' ? '正面' : 'Front';
                } else if (key === 'back') {
                    element.textContent = this.currentLanguage === 'zh' ? '背面' : 'Back';
                } else {
                    element.textContent = translatedText;
                }
                
                // Ensure button has proper styling to handle text
                element.style.whiteSpace = 'nowrap';
                element.style.overflow = 'hidden';
                element.style.textOverflow = 'ellipsis';
                element.style.minWidth = 'auto';
                element.style.width = 'auto';
                element.style.flex = '1';
                element.style.textAlign = 'center';
            } else {
                element.textContent = translatedText;
            }
        });
        
        // 更新placeholder属性
        document.querySelectorAll('[data-translate-placeholder]').forEach(element => {
            const key = element.getAttribute('data-translate-placeholder');
            element.placeholder = this.getText(key);
        });
        
        // 更新页面标题
        document.title = this.getText('title');
        
        // 重新更新警告信息（确保使用正确语言）
        this.updateMaterialWarnings();
        
        // 如果当前有选中的元素，更新属性面板
        if (this.selectedElement) {
            this.updatePropertiesPanel(this.selectedElement);
        }
    }

    setupDragDrop() {
        const cardFront = document.getElementById('cardFront');
        const cardBack = document.getElementById('cardBack');

        [cardFront, cardBack].forEach(card => {
            if (!card) {
                this.errorHandler.handleError(new Error('Card element not found'), 'setupDragDrop');
                return;
            }

            // File drag and drop handlers
            card.addEventListener('dragover', (e) => {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'copy';
                    
                    const dropZone = card.querySelector('.drop-zone');
                    if (dropZone) {
                        dropZone.classList.add('dragover');
                    }
                } catch (error) {
                    this.errorHandler.handleError(error, 'dragover event', false);
                }
            });

            card.addEventListener('dragenter', (e) => {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                } catch (error) {
                    this.errorHandler.handleError(error, 'dragenter event', false);
                }
            });

            card.addEventListener('dragleave', (e) => {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Only remove dragover if we're actually leaving the card area
                    if (!card.contains(e.relatedTarget)) {
                        const dropZone = card.querySelector('.drop-zone');
                        if (dropZone) {
                            dropZone.classList.remove('dragover');
                        }
                    }
                } catch (error) {
                    this.errorHandler.handleError(error, 'dragleave event', false);
                }
            });

            card.addEventListener('drop', (e) => {
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const dropZone = card.querySelector('.drop-zone');
                    if (dropZone) {
                        dropZone.classList.remove('dragover');
                    }
                    
                    // 检查是否应该阻止拖拽上传（半定制模式或木质/金属材质的背面）
                    const shouldBlock = (this.isSemiCustomMode && this.currentSide === 'back') ||
                                      (this.currentMaterial === 'metal' && this.currentSide === 'back') ||
                                      (this.currentMaterial === 'wood' && this.currentSide === 'back');
                    
                    if (shouldBlock) {
                        // 显示阻止信息
                        const message = this.currentLanguage === 'zh' 
                            ? '当前状态下不允许拖拽上传图片' 
                            : 'Drag and drop upload is not allowed in current state';
                        alert(message);
                        return;
                    }
                    
                    const files = e.dataTransfer?.files;
                    if (files && files.length > 0) {
                        // Validate that it's an image file
                        const file = files[0];
                        if (file.type.startsWith('image/')) {
                            this.handleFileSelect(file);
                        } else {
                            throw new Error('Invalid file type - only images are supported');
                        }
                    } else {
                        throw new Error('No files found in drop event');
                    }
                } catch (error) {
                    this.errorHandler.handleError(error, 'file drop');
                }
            });

            card.addEventListener('click', (e) => {
                try {
                    if (e.target.classList.contains('drop-zone') || 
                        e.target.closest('.drop-zone')) {
                        
                        // 检查是否应该阻止上传（半定制模式或木质/金属材质的背面）
                        const shouldBlock = (this.isSemiCustomMode && this.currentSide === 'back') ||
                                          (this.currentMaterial === 'metal' && this.currentSide === 'back') ||
                                          (this.currentMaterial === 'wood' && this.currentSide === 'back');
                        
                        if (shouldBlock) {
                            // 显示阻止信息
                            const message = this.currentLanguage === 'zh' 
                                ? '当前状态下不允许上传图片' 
                                : 'Image upload is not allowed in current state';
                            alert(message);
                            return;
                        }
                        
                        this.uploadImage();
                    }
                } catch (error) {
                    this.errorHandler.handleError(error, 'drop zone click');
                }
            });
        });
    }

    switchSide(side) {
        this.currentSide = side;
        
        // 更新按钮状态
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-side="${side}"]`).classList.add('active');

        // 更新卡片显示 - 简单切换逻辑
        document.querySelectorAll('.card').forEach(card => {
            card.classList.remove('active');
        });
        document.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`).classList.add('active');

        // 重新应用材质效果以确保不丢失
        this.applyMaterial();
        
        // 确保半定制背景正确显示（模板已在applyTemplate中应用到两面）
        if (this.currentTemplate && ['blue', 'pink'].includes(this.currentTemplate)) {
            // 重新应用当前面的半定制模板（确保显示正确）
            this.applySemiCustomTemplate(this.currentTemplate, side);
        }

        // 更新材质警告（金属背面需要重新计算）
        this.updateMaterialWarnings();
        
        // 更新半定制编辑限制
        this.updateEditingRestrictions();

        // 取消选择
        this.deselectElement();
    }

    selectMaterial(material) {
        try {
            if (!material) {
                throw new Error('No material specified');
            }

            this.currentMaterial = material;
            
            // 更新材质选择状态
            document.querySelectorAll('.material-option').forEach(option => {
                option.classList.remove('active');
            });
            const materialElement = document.querySelector(`[data-material="${material}"]`);
            if (materialElement) {
                materialElement.classList.add('active');
            }

            // 更新菜单可见性
            this.updateMenuVisibility();
            
            // 更新警告信息
            this.updateMaterialWarnings();
            
            // 更新模板限制
            this.updateTemplateRestrictions();
            
            // 渲染材料效果 - 确保Canvas已准备好
            if (this.materialRenderer) {
                // 延迟渲染以确保DOM更新完成
                setTimeout(() => {
                    try {
                        this.materialRenderer.renderMaterial(material, 'front');
                        this.materialRenderer.renderMaterial(material, 'back');
                    } catch (renderError) {
                        this.errorHandler.handleError(renderError, 'material rendering', false);
                    }
                }, 50);
            }

            // 应用材质样式
            this.applyMaterial();

            // 记录操作历史
            if (this.historyManager) {
                this.historyManager.recordAction();
            }
            
            // 如果是限制材质，自动选择空白模板
            if (this.restrictedMaterials.includes(material)) {
                this.selectTemplate('blank');
            }

            // 显示成功消息
            const message = this.currentLanguage === 'zh' 
                ? `已选择${material === 'pvc' ? 'PVC' : material === 'wood' ? '木质' : '金属'}材质`
                : `${material.toUpperCase()} material selected`;
            // Notification removed as requested

        } catch (error) {
            this.errorHandler.handleError(error, 'material selection');
        }
        
        // 更新二维码UI
        this.updateQRCodeUI();
    }

    selectTemplate(template) {
        this.currentTemplate = template;
        
        // 更新模板选择状态
        document.querySelectorAll('.template-item').forEach(item => {
            item.classList.remove('active');
        });
        const templateElement = document.querySelector(`[data-template="${template}"]`);
        if (templateElement) {
            templateElement.classList.add('active');
        }

        // 更新菜单可见性
        this.updateMenuVisibility();

        this.applyTemplate();
        
        // 记录操作历史
        if (this.historyManager) {
            this.historyManager.recordAction();
        }
        
        // 更新二维码UI
        this.updateQRCodeUI();
    }

    // 更新二维码UI的显示/隐藏
    updateQRCodeUI() {
        // 获取所有QR码相关的UI元素
        const qrTab = document.getElementById('qrTab');
        const qrStatusBanner = document.getElementById('qrStatusBanner');
        const qrAddSection = document.getElementById('qrAddSection');
        const qrStatusSection = document.getElementById('qrStatusSection');
        // 旧的Image面板中的元素已经被移除
        
        // 检查是否为PVC全定制模式
        const isPVCFullCustom = this.currentMaterial === 'pvc' && this.currentTemplate === 'blank';
        
        if (isPVCFullCustom) {
            // 显示QR码工具栏标签
            if (qrTab) {
                qrTab.style.display = 'flex';
                // 添加脉冲动画以吸引注意
                qrTab.classList.add('pulse-animation');
            }
            
            // 检查是否已经有QR码
            const hasQRCode = this.hasQRCodeOnCard();
            
            if (hasQRCode) {
                // 已有QR码：隐藏横幅和添加按钮，显示状态信息
                if (qrStatusBanner) qrStatusBanner.style.display = 'none';
                if (qrAddSection) qrAddSection.style.display = 'none';
                if (qrStatusSection) qrStatusSection.style.display = 'block';
                if (qrTab) qrTab.classList.remove('pulse-animation');
            } else {
                // 未有QR码：显示横幅和添加按钮，隐藏状态信息
                if (qrStatusBanner) qrStatusBanner.style.display = 'block';
                if (qrAddSection) qrAddSection.style.display = 'block';
                if (qrStatusSection) qrStatusSection.style.display = 'none';
            }
            
            // 旧的Image面板中的元素已经被移除，不再需要管理
            
        } else {
            // 非PVC全定制模式：隐藏所有QR码相关UI
            if (qrTab) {
                qrTab.style.display = 'none';
                qrTab.classList.remove('pulse-animation');
            }
            if (qrStatusBanner) qrStatusBanner.style.display = 'none';
            if (qrAddSection) qrAddSection.style.display = 'none';
            if (qrStatusSection) qrStatusSection.style.display = 'none';
            
            // 隐藏旧的按钮和提示信息
            // 旧的Image面板中的元素已经被移除，不需要操作
        }
    }

    applyMaterial() {
        if (!this.currentMaterial) return;
        
        const cards = document.querySelectorAll('.card');
        cards.forEach(card => {
            // 移除所有材质类
            card.classList.remove('material-pvc', 'material-wood', 'material-metal');
            
            // 保存当前状态
            const isActive = card.classList.contains('active');
            const sideClass = card.id === 'cardFront' ? 'front-side' : 'back-side';
            const side = card.id === 'cardFront' ? 'front' : 'back';
            
            // *** 关键修复：清理所有现有的背景图片 ***
            const content = card.querySelector('.card-content');
            if (content) {
                // 移除所有可能的背景图片
                const existingBackgrounds = content.querySelectorAll('.material-background, .template-background');
                existingBackgrounds.forEach(bg => bg.remove());
            }
            
            // 重新设置所有类
            card.className = `card ${sideClass}`;
            
            // 对于金属和木质材质，使用模板背景而不是CSS渲染效果
            if (this.currentMaterial === 'metal') {
                this.applyMetalTemplate(card, side);
            } else if (this.currentMaterial === 'wood') {
                this.applyWoodTemplate(card, side);
            } else {
                // PVC材质保持原有逻辑
                if (this.materialRenderer) {
                    this.materialRenderer.renderMaterial(this.currentMaterial, side);
                }
                card.classList.add(`material-${this.currentMaterial}`);
            }
            
            // 恢复active状态
            if (isActive) {
                card.classList.add('active');
            }
        });
    }

    applyMetalTemplate(card, side) {
        const content = card.querySelector('.card-content');
        
        // 移除现有背景图片
        const existingBg = content.querySelector('.material-background');
        if (existingBg) {
            existingBg.remove();
        }
        
        // 创建背景图片元素
        const backgroundImg = document.createElement('div');
        backgroundImg.className = 'material-background';
        backgroundImg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            pointer-events: none;
            z-index: 0;
            border-radius: 12px;
        `;
        
        // 设置背景图片路径（添加缓存破坏参数）
        const timestamp = new Date().getTime();
        const imagePath = side === 'front' 
            ? `PVC_templates/Blank_template/Metal.jpg?t=${timestamp}`
            : `PVC_templates/Blank_template/Metal_back.jpg?t=${timestamp}`;
        backgroundImg.style.backgroundImage = `url('${imagePath}')`;
        
        // 调试日志
        console.log(`应用金属模板背景: ${side}面, 路径: ${imagePath}`);
        
        // 测试图片是否能加载
        const testImg = new Image();
        testImg.onload = () => {
            console.log(`✅ 金属模板图片加载成功: ${imagePath}`);
        };
        testImg.onerror = () => {
            console.error(`❌ 金属模板图片加载失败: ${imagePath}`);
        };
        testImg.src = imagePath;
        
        // 插入背景图片
        content.insertBefore(backgroundImg, content.firstChild);
        
        // 添加材质类用于其他样式
        card.classList.add('material-metal');
    }

    applyWoodTemplate(card, side) {
        // 木质材质暂时保持原有CSS效果，后续可以添加模板支持
        if (this.materialRenderer) {
            this.materialRenderer.renderMaterial('wood', side);
        }
        card.classList.add('material-wood');
    }

    applyTemplate() {
        if (!this.currentTemplate) return;
        
        const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
        const content = currentCard.querySelector('.card-content');
        
        // 清除现有模板样式和半定制状态
        content.className = 'card-content';
        content.classList.add(`template-${this.currentTemplate}`);
        
        // 移除现有背景图片
        const existingBg = content.querySelector('.template-background');
        if (existingBg) {
            existingBg.remove();
        }

        // 应用模板特定样式
        switch (this.currentTemplate) {
            case 'blue':
            case 'pink':
                // 为正面和背面都应用半定制模板
                this.applySemiCustomTemplate(this.currentTemplate, 'front');
                this.applySemiCustomTemplate(this.currentTemplate, 'back');
                this.setSemiCustomMode(true);
                // *** 关键修复：PVC半定制模板不调用applyMaterial()避免清除模板背景 ***
                // 但是仍然需要应用PVC材质类
                if (this.currentMaterial === 'pvc') {
                    const cards = document.querySelectorAll('.card');
                    cards.forEach(card => {
                        card.classList.add('material-pvc');
                    });
                }
                break;
            default:
                content.style.background = 'transparent';
                this.setSemiCustomMode(false);
                // 重新应用材质效果
                this.applyMaterial();
        }
        
        // 重新渲染元素以应用新的显示/隐藏规则
        this.renderElements();
    }

    applySemiCustomTemplate(template, side) {
        const currentCard = document.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`);
        const content = currentCard.querySelector('.card-content');
        
        // 移除现有的模板背景
        const existingBg = content.querySelector('.template-background');
        if (existingBg) {
            existingBg.remove();
        }
        
        // 创建背景图片元素
        const backgroundImg = document.createElement('div');
        backgroundImg.className = 'template-background';
        backgroundImg.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            background-repeat: no-repeat;
            pointer-events: none;
            z-index: 0;
        `;
        
        // 设置背景图片路径（添加缓存破坏参数）
        const timestamp = new Date().getTime();
        let imagePath;
        if (side === 'back') {
            // 背面使用压缩版本（包含QR码）
            imagePath = `PVC_templates/${template.charAt(0).toUpperCase() + template.slice(1)}_${side}_compressed.jpg?t=${timestamp}`;
        } else {
            // 正面使用原来的路径
            imagePath = `PVC_templates/Blank_template/${template.charAt(0).toUpperCase() + template.slice(1)}_${side}.jpg?t=${timestamp}`;
        }
        backgroundImg.style.backgroundImage = `url('${imagePath}')`;
        
        // 调试日志
        console.log(`应用模板背景: ${side}面, 路径: ${imagePath}`);
        
        // 测试图片是否能加载
        const testImg = new Image();
        testImg.onload = () => {
            console.log(`✅ 模板图片加载成功: ${imagePath}`);
        };
        testImg.onerror = () => {
            console.error(`❌ 模板图片加载失败: ${imagePath}`);
        };
        testImg.src = imagePath;
        
        // 插入背景图片
        content.insertBefore(backgroundImg, content.firstChild);
        
        // 半定制模板背景应用完成，状态由setSemiCustomMode统一管理
    }

    setSemiCustomMode(enabled) {
        this.isSemiCustomMode = enabled;
        
        if (enabled) {
            document.body.classList.add('semi-custom-mode');
        } else {
            document.body.classList.remove('semi-custom-mode');
        }
        
        this.updateEditingRestrictions();
    }

    updateEditingRestrictions() {
        // 确定是否应该限制编辑
        // PVC半定制模板（blue/pink）或者木质/金属材质的背面都应该被限制
        const shouldRestrict = (this.isSemiCustomMode && this.currentSide === 'back') || 
                              (this.currentMaterial === 'metal' && this.currentSide === 'back') ||
                              (this.currentMaterial === 'wood' && this.currentSide === 'back');
        
        // 禁用/启用工具按钮
        const toolButtons = document.querySelectorAll('.feature-tab:not([data-feature="material"])');
        const actionButtons = document.querySelectorAll('.action-btn');
        
        toolButtons.forEach(btn => {
            if (shouldRestrict) {
                btn.classList.add('disabled');
                btn.style.opacity = '0.3';
                btn.style.pointerEvents = 'none';
            } else {
                btn.classList.remove('disabled');
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });
        
        actionButtons.forEach(btn => {
            if (shouldRestrict) {
                btn.classList.add('disabled');
                btn.style.opacity = '0.3';
                btn.style.pointerEvents = 'none';
            } else {
                btn.classList.remove('disabled');
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        });

        // 🔧 修复半定制模板背面bug：禁用/启用属性面板中的添加文字和形状按钮
        const addTextBtn = document.getElementById('addTextBtn');
        const addShapeSection = document.getElementById('addShapeSection');
        const shapeButtons = document.querySelectorAll('.shape-btn');
        
        if (addTextBtn) {
            if (shouldRestrict) {
                addTextBtn.classList.add('disabled');
                addTextBtn.style.opacity = '0.3';
                addTextBtn.style.pointerEvents = 'none';
                addTextBtn.style.cursor = 'not-allowed';
            } else {
                addTextBtn.classList.remove('disabled');
                addTextBtn.style.opacity = '1';
                addTextBtn.style.pointerEvents = 'auto';
                addTextBtn.style.cursor = 'pointer';
            }
        }
        
        if (addShapeSection) {
            if (shouldRestrict) {
                addShapeSection.style.opacity = '0.3';
                addShapeSection.style.pointerEvents = 'none';
            } else {
                addShapeSection.style.opacity = '1';
                addShapeSection.style.pointerEvents = 'auto';
            }
        }
        
        shapeButtons.forEach(btn => {
            if (shouldRestrict) {
                btn.classList.add('disabled');
                btn.style.opacity = '0.3';
                btn.style.pointerEvents = 'none';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.classList.remove('disabled');
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
                btn.style.cursor = 'pointer';
            }
        });
        
        // 🔧 同时禁用/启用图片上传按钮
        const uploadImageBtn = document.getElementById('uploadImageBtn');
        const uploadSection = document.getElementById('uploadSection');
        
        if (uploadImageBtn) {
            if (shouldRestrict) {
                uploadImageBtn.classList.add('disabled');
                uploadImageBtn.style.opacity = '0.3';
                uploadImageBtn.style.pointerEvents = 'none';
                uploadImageBtn.style.cursor = 'not-allowed';
            } else {
                uploadImageBtn.classList.remove('disabled');
                uploadImageBtn.style.opacity = '1';
                uploadImageBtn.style.pointerEvents = 'auto';
                uploadImageBtn.style.cursor = 'pointer';
            }
        }
        
        if (uploadSection) {
            if (shouldRestrict) {
                uploadSection.style.opacity = '0.3';
                uploadSection.style.pointerEvents = 'none';
            } else {
                uploadSection.style.opacity = '1';
                uploadSection.style.pointerEvents = 'auto';
            }
        }
        
        console.log(`🔒 编辑限制更新: shouldRestrict=${shouldRestrict}, 当前面=${this.currentSide}, 半定制模式=${this.isSemiCustomMode}`);

        // 控制drop-zone提示文字的显示/隐藏
        this.updateDropZoneVisibility(shouldRestrict);

        // 显示相应的说明信息
        if (this.isSemiCustomMode && this.currentSide === 'front') {
            this.showSemiCustomInstructions();
        } else if (this.currentMaterial === 'metal' && this.currentSide === 'back') {
            this.showMetalBackInstructions();
        } else {
            this.hideSemiCustomInstructions();
            this.hideMetalBackInstructions();
        }
    }

    updateDropZoneVisibility(shouldRestrict) {
        const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
        const dropZone = currentCard?.querySelector('.drop-zone');
        
        if (dropZone) {
            if (shouldRestrict) {
                // 隐藏drop-zone提示文字
                dropZone.style.opacity = '0';
                dropZone.style.pointerEvents = 'none';
            } else {
                // 显示drop-zone提示文字
                dropZone.style.opacity = '1';
                dropZone.style.pointerEvents = 'auto';
            }
        }
    }

    showSemiCustomInstructions() {
        // 在属性面板中显示半定制说明
        const instructionDiv = document.getElementById('semi-custom-instructions') || this.createSemiCustomInstructions();
        instructionDiv.style.display = 'block';
    }

    hideSemiCustomInstructions() {
        const instructionDiv = document.getElementById('semi-custom-instructions');
        if (instructionDiv) {
            instructionDiv.style.display = 'none';
        }
    }

    createSemiCustomInstructions() {
        const instructionDiv = document.createElement('div');
        instructionDiv.id = 'semi-custom-instructions';
        instructionDiv.className = 'semi-custom-instructions';
        instructionDiv.innerHTML = `
            <div class="instruction-content">
                <h4 data-translate="semi-custom-title">Semi-Custom Mode</h4>
                <p data-translate="semi-custom-desc">You can only edit: Name, Job Title, and Logo</p>
                <p data-translate="semi-custom-back-locked">Back side is locked and cannot be edited</p>
            </div>
        `;
        instructionDiv.style.cssText = `
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
            font-size: 0.9rem;
        `;
        
        // 插入到属性面板顶部
        const propertiesPanel = document.querySelector('.properties-panel');
        if (propertiesPanel) {
            propertiesPanel.insertBefore(instructionDiv, propertiesPanel.firstChild);
        }
        
        return instructionDiv;
    }

    showMetalBackInstructions() {
        const instructionDiv = document.getElementById('metal-back-instructions') || this.createMetalBackInstructions();
        instructionDiv.style.display = 'block';
    }

    hideMetalBackInstructions() {
        const instructionDiv = document.getElementById('metal-back-instructions');
        if (instructionDiv) {
            instructionDiv.style.display = 'none';
        }
    }

    createMetalBackInstructions() {
        const instructionDiv = document.createElement('div');
        instructionDiv.id = 'metal-back-instructions';
        instructionDiv.className = 'metal-back-instructions';
        instructionDiv.innerHTML = `
            <div class="instruction-content">
                <h4 data-translate="metal-back-title">Metal Back Side</h4>
                <p data-translate="metal-back-desc">Metal card back is plastic material and cannot be edited</p>
            </div>
        `;
        instructionDiv.style.cssText = `
            background: #d1ecf1;
            border-left: 4px solid #17a2b8;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 4px;
            font-size: 0.9rem;
        `;
        
        // 插入到属性面板顶部
        const propertiesPanel = document.querySelector('.properties-panel');
        if (propertiesPanel) {
            propertiesPanel.insertBefore(instructionDiv, propertiesPanel.firstChild);
        }
        
        return instructionDiv;
    }

    uploadImage() {
        // 🔧 检查是否在受限制的模式下（半定制模板背面或其他限制材质背面）
        const shouldRestrict = (this.isSemiCustomMode && this.currentSide === 'back') || 
                              (this.currentMaterial === 'metal' && this.currentSide === 'back') ||
                              (this.currentMaterial === 'wood' && this.currentSide === 'back');
        
        if (shouldRestrict) {
            const message = this.currentLanguage === 'zh' 
                ? '当前模式下背面不允许上传图片' 
                : 'Image upload is not allowed on the back side in this mode';
            alert(message);
            console.log('🚫 阻止在受限制模式下上传图片');
            return;
        }
        
        document.getElementById('fileInput').click();
    }

    // 添加二维码
    addQRCode() {
        console.log('🔄 Starting addQRCode process...');
        console.log(`Current material: ${this.currentMaterial}, template: ${this.currentTemplate}, side: ${this.currentSide}`);
        
        try {
            // 检查是否为PVC全定制模式
            if (this.currentMaterial !== 'pvc' || this.currentTemplate !== 'blank') {
                const message = this.currentLanguage === 'zh' 
                    ? '二维码功能仅在PVC全定制模式下可用' 
                    : 'QR code feature is only available in PVC full customization mode';
                console.log('❌ Not in PVC full customization mode');
                alert(message);
                return;
            }

            // 检查当前面是否已有二维码
            if (this.hasQRCodeOnCurrentSide()) {
                const message = this.currentLanguage === 'zh' 
                    ? '当前面已有二维码，每面只能添加一个二维码' 
                    : 'QR code already exists on current side, only one QR code per side allowed';
                alert(message);
                return;
            }

            // 创建二维码元素
            const qrElement = {
                type: 'image',
                id: `qr_${Date.now()}`,
                isQRCode: true, // 标记为二维码元素
                x: 300, // 默认位置
                y: 200,
                width: 80,  // 默认尺寸
                height: 80,
                src: 'QR_Website.png',
                rotation: 0,
                opacity: 1
            };

            // 添加到当前面的元素列表
            if (!this.elements[this.currentSide]) {
                this.elements[this.currentSide] = [];
            }
            this.elements[this.currentSide].push(qrElement);

            console.log('📦 QR element created:', qrElement);
            console.log(`🎯 Adding to side: ${this.currentSide}`);
            
            // 渲染二维码
            this.renderQRCode(qrElement);

            // 选中新添加的二维码 - 在renderQRCode中设置

            // 显示成功消息
            const message = this.currentLanguage === 'zh' 
                ? '二维码已添加到卡片' 
                : 'QR code added to card';
            
            console.log('✅ ' + message);
            
            // 更新QR码UI状态
            this.updateQRCodeUI();
            
        } catch (error) {
            console.error('添加二维码失败:', error);
            const message = this.currentLanguage === 'zh' 
                ? '添加二维码失败，请重试' 
                : 'Failed to add QR code, please try again';
            alert(message);
        }
    }

    // 移除二维码
    removeQRCode() {
        try {
            // 移除所有QR码元素
            const qrElements = document.querySelectorAll('.qr-element');
            qrElements.forEach(element => {
                element.remove();
            });
            
            // 从元素数据中移除QR码
            ['front', 'back'].forEach(side => {
                if (this.elements[side]) {
                    this.elements[side] = this.elements[side].filter(element => !element.isQRCode);
                }
            });
            
            // 更新UI
            this.updateQRCodeUI();
            
            // 显示成功消息
            const message = this.currentLanguage === 'zh' 
                ? '二维码已移除' 
                : 'QR code removed';
            console.log('✅ ' + message);
            
            // 记录历史操作
            if (this.historyManager) {
                this.historyManager.recordAction();
            }
            
        } catch (error) {
            console.error('移除二维码失败:', error);
            const message = this.currentLanguage === 'zh' 
                ? '移除二维码失败，请重试' 
                : 'Failed to remove QR code, please try again';
            alert(message);
        }
    }

    // 检查当前面是否已有二维码
    hasQRCodeOnCurrentSide() {
        // 检查DOM中是否有二维码元素
        const containerId = `card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`;
        const container = document.getElementById(containerId);
        if (container) {
            const qrElements = container.querySelectorAll('.qr-element');
            return qrElements.length > 0;
        }
        return false;
    }

    // 检查整个卡片是否有二维码（正面或背面）
    hasQRCodeOnCard() {
        // 优先检查elements数据，因为DOM可能还未渲染
        const frontElements = this.elements.front || [];
        const backElements = this.elements.back || [];
        
        const hasQRInData = [...frontElements, ...backElements].some(element => 
            element && (element.isQRCode === true || element.serializable?.isQRCode === true)
        );
        
        if (hasQRInData) {
            return true;
        }
        
        // 备用检查：检查DOM容器
        const frontContainer = document.getElementById('cardFront');
        const backContainer = document.getElementById('cardBack');
        
        const frontQR = frontContainer ? frontContainer.querySelectorAll('.qr-element').length > 0 : false;
        const backQR = backContainer ? backContainer.querySelectorAll('.qr-element').length > 0 : false;
        
        return frontQR || backQR;
    }

    // 渲染二维码元素
    renderQRCode(element) {
        try {
            // 使用与普通图片相同的容器查找逻辑
            const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
            if (!currentCard) {
                throw new Error(`Card element not found for side: ${this.currentSide}`);
            }

            const container = currentCard.querySelector('.card-content');
            if (!container) {
                throw new Error('Card content element not found');
            }
            
            // 隐藏drop-zone（与普通图片相同的逻辑）
            const dropZone = container.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.display = 'none';
            }

            console.log(`🎯 Looking for card content container`);
            console.log('📦 Container found:', container);

            // 创建二维码容器元素
            const qrContainer = document.createElement('div');
            qrContainer.id = element.id;
            qrContainer.className = 'draggable-element image-element qr-element';
            qrContainer.style.position = 'absolute';
            qrContainer.style.left = element.x + 'px';
            qrContainer.style.top = element.y + 'px';
            qrContainer.style.width = element.width + 'px';
            qrContainer.style.height = element.height + 'px';
            qrContainer.style.cursor = 'move';
            qrContainer.style.zIndex = '9999'; // 确保QR码在最顶层
            
            // 添加QR码特定标识
            qrContainer.setAttribute('data-element-type', 'qrcode');
            qrContainer.setAttribute('data-is-qr', 'true');
            
            // 创建二维码图片元素
            const imgElement = document.createElement('img');
            imgElement.src = element.src;
            imgElement.draggable = false;
            imgElement.style.width = '100%';
            imgElement.style.height = '100%';
            imgElement.style.objectFit = 'contain';

            // 添加图片加载检测
            imgElement.onload = () => {
                console.log(`✅ QR code image loaded successfully: ${element.src}`);
            };
            
            imgElement.onerror = () => {
                console.error(`❌ QR code image failed to load: ${element.src}`);
                // 尝试使用相对路径
                imgElement.src = './QR_Website.png';
            };

            // 将图片添加到容器中
            qrContainer.appendChild(imgElement);
            
            // 添加拖拽和缩放功能
            this.addDragHandles(qrContainer);

            // 添加到卡片容器
            container.appendChild(qrContainer);

            // 选中新创建的二维码元素
            this.selectElement(qrContainer);

            // 拖拽和缩放功能由addDragHandles处理

            console.log(`二维码已渲染: ${element.id}`);

        } catch (error) {
            console.error('渲染二维码失败:', error);
            throw error;
        }
    }

    handleFileSelect(file) {
        try {
            if (!file) {
                throw new Error('No file selected');
            }
            
            // Validate file first
            this.errorHandler.validateImageFile(file);
            
            // Show loading indicator
            this.showLoadingIndicator();
            
            // 检查文件大小
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                const message = this.currentLanguage === 'zh' 
                    ? '图片文件过大，正在压缩处理...' 
                    : 'Image file too large, compressing...';
                
                // 显示压缩提示
                this.showCompressionMessage(message);
                
                // 压缩图片
                this.compressImage(file, (compressedDataUrl) => {
                    this.hideCompressionMessage();
                    this.hideLoadingIndicator();
                    
                    if (compressedDataUrl) {
                        this.addImageElement(compressedDataUrl);
                    } else {
                        throw new Error('Image compression failed');
                    }
                });
            } else {
                const reader = new FileReader();
                
                reader.onload = (e) => {
                    try {
                        this.hideLoadingIndicator();
                        
                        if (e.target?.result) {
                            this.addImageElement(e.target.result);
                        } else {
                            throw new Error('Failed to read file data');
                        }
                    } catch (error) {
                        this.errorHandler.handleError(error, 'file reader onload');
                    }
                };
                
                reader.onerror = (e) => {
                    this.hideLoadingIndicator();
                    this.errorHandler.handleError(new Error('Failed to read file'), 'file reader error');
                };
                
                reader.onabort = (e) => {
                    this.hideLoadingIndicator();
                    this.errorHandler.handleError(new Error('File reading was aborted'), 'file reader abort');
                };
                
                reader.readAsDataURL(file);
            }
        } catch (error) {
            this.hideLoadingIndicator();
            this.errorHandler.handleError(error, 'file selection');
        }
    }

    // Show loading indicator
    showLoadingIndicator() {
        try {
            let indicator = document.getElementById('loadingIndicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'loadingIndicator';
                indicator.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 20px;
                    border-radius: 8px;
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                `;
                
                const spinner = document.createElement('div');
                spinner.style.cssText = `
                    width: 20px;
                    height: 20px;
                    border: 2px solid #ffffff40;
                    border-top: 2px solid #ffffff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                `;
                
                // Add CSS animation
                if (!document.getElementById('spinnerStyle')) {
                    const style = document.createElement('style');
                    style.id = 'spinnerStyle';
                    style.textContent = `
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                indicator.appendChild(spinner);
                
                const text = document.createElement('span');
                text.textContent = this.currentLanguage === 'zh' ? '正在处理图片...' : 'Processing image...';
                indicator.appendChild(text);
                
                document.body.appendChild(indicator);
            }
            
            indicator.style.display = 'flex';
            
        } catch (error) {
            console.error('Error showing loading indicator:', error);
        }
    }

    // Hide loading indicator
    hideLoadingIndicator() {
        try {
            const indicator = document.getElementById('loadingIndicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        } catch (error) {
            console.error('Error hiding loading indicator:', error);
        }
    }

    // 显示压缩提示
    showCompressionMessage(message) {
        let messageDiv = document.getElementById('compressionMessage');
        if (!messageDiv) {
            messageDiv = document.createElement('div');
            messageDiv.id = 'compressionMessage';
            messageDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 15px 20px;
                border-radius: 5px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                font-size: 14px;
            `;
            document.body.appendChild(messageDiv);
        }
        messageDiv.textContent = message;
        messageDiv.style.display = 'block';
    }

    // 隐藏压缩提示
    hideCompressionMessage() {
        const messageDiv = document.getElementById('compressionMessage');
        if (messageDiv) {
            messageDiv.style.display = 'none';
        }
    }

    // 压缩图片
    compressImage(file, callback) {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                try {
                    // 计算目标尺寸
                    const maxWidth = 1200;
                    const maxHeight = 1200;
                    let { width, height } = img;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    // 绘制压缩后的图片
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 获取压缩后的数据URL
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    
                    // 验证压缩结果
                    if (!compressedDataUrl || compressedDataUrl === 'data:,') {
                        throw new Error('Image compression produced invalid result');
                    }
                    
                    // 计算压缩率
                    const originalSize = file.size;
                    const compressedSize = compressedDataUrl.length * 0.75; // 大约的字节数
                    const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                    
                    console.log(`图片压缩完成: ${originalSize}B -> ${compressedSize.toFixed(0)}B (压缩${compressionRatio}%)`);
                    
                    callback(compressedDataUrl);
                } catch (error) {
                    this.errorHandler.handleError(error, 'image compression processing');
                    callback(null);
                }
            };
            
            img.onerror = (error) => {
                this.errorHandler.handleError(new Error('Failed to load image for compression'), 'image compression load');
                callback(null);
            };
            
            const objectUrl = URL.createObjectURL(file);
            img.src = objectUrl;
            
            // Clean up object URL after a delay to prevent memory leaks
            setTimeout(() => {
                URL.revokeObjectURL(objectUrl);
            }, 1000);
            
        } catch (error) {
            this.errorHandler.handleError(error, 'image compression setup');
            callback(null);
        }
    }

    addImageElement(src) {
        try {
            if (!src) {
                throw new Error('No image source provided');
            }

            // Validate image source
            if (typeof src !== 'string' || !src.startsWith('data:image/')) {
                throw new Error('Invalid image source format');
            }

            // 检查单色限制 - 金属背面除外（支持喷涂技艺）
            const showSingleColorWarning = this.restrictedMaterials.includes(this.currentMaterial) && 
                                         !(this.currentMaterial === 'metal' && this.currentSide === 'back');
            
            if (showSingleColorWarning) {
                const message = this.currentLanguage === 'zh' 
                    ? '该材质仅支持单色雕刻设计，上传的图片将被转换为单色效果。是否继续？'
                    : 'This material only supports monochrome engraving design. The uploaded image will be converted to monochrome effect. Continue?';
                const proceed = confirm(message);
                if (!proceed) {
                    return;
                }
            }

            const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
            if (!currentCard) {
                throw new Error(`Card element not found for side: ${this.currentSide}`);
            }

            const content = currentCard.querySelector('.card-content');
            if (!content) {
                throw new Error('Card content element not found');
            }
            
            // 隐藏drop-zone
            const dropZone = content.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.display = 'none';
            }

            const imageElement = document.createElement('div');
            imageElement.className = 'draggable-element image-element';
            imageElement.style.left = '50px';
            imageElement.style.top = '50px';
            imageElement.style.width = '150px';
            imageElement.style.height = '100px';
            imageElement.style.position = 'absolute';
            imageElement.style.cursor = 'move';
            
            const img = document.createElement('img');
            img.src = src;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'fill';
            img.style.pointerEvents = 'none'; // Prevent image from interfering with drag events
            
            // Handle image load errors
            img.onerror = () => {
                this.errorHandler.handleError(new Error('Failed to load image'), 'image element creation');
                if (imageElement.parentNode) {
                    imageElement.parentNode.removeChild(imageElement);
                }
            };
            
            // 如果是限制材质，应用单色滤镜 - 金属背面除外
            const shouldApplyFilter = this.restrictedMaterials.includes(this.currentMaterial) && 
                                    !(this.currentMaterial === 'metal' && this.currentSide === 'back');
            
            if (shouldApplyFilter) {
                if (this.currentMaterial === 'wood') {
                    img.style.filter = 'sepia(1) saturate(0.5) hue-rotate(15deg) brightness(0.8)';
                } else if (this.currentMaterial === 'metal') {
                    img.style.filter = 'grayscale(1) contrast(1.5) brightness(0.7)';
                }
            }
            
            imageElement.appendChild(img);
            this.addDragHandles(imageElement);
            content.appendChild(imageElement);

            // 添加到元素列表
            const elementData = {
                element: imageElement,
                type: 'image',
                data: { src },
                // 存储序列化友好的数据
                serializable: {
                    type: 'image',
                    src: src,
                    position: {
                        left: imageElement.style.left,
                        top: imageElement.style.top,
                        width: imageElement.style.width,
                        height: imageElement.style.height
                    }
                }
            };

            this.elements[this.currentSide].push(elementData);
            this.selectElement(imageElement);
            
            // Record action for undo/redo
            if (this.historyManager) {
                this.historyManager.recordAction();
            }

            // Show success notification
            const message = this.currentLanguage === 'zh' ? '图片添加成功' : 'Image added successfully';
            // Notification removed as requested

        } catch (error) {
            this.errorHandler.handleError(error, 'add image element');
        }
    }

    addText() {
        try {
            // 🔧 检查是否在受限制的模式下（半定制模板背面或其他限制材质背面）
            const shouldRestrict = (this.isSemiCustomMode && this.currentSide === 'back') || 
                                  (this.currentMaterial === 'metal' && this.currentSide === 'back') ||
                                  (this.currentMaterial === 'wood' && this.currentSide === 'back');
            
            if (shouldRestrict) {
                const message = this.currentLanguage === 'zh' 
                    ? '当前模式下背面不允许添加文字元素' 
                    : 'Text elements cannot be added to the back side in this mode';
                alert(message);
                console.log('🚫 阻止在受限制模式下添加文字');
                return;
            }
            
            // 直接创建默认文字元素，无需弹窗
            const defaultText = this.currentLanguage === 'zh' ? '双击编辑文字' : 'Double click to edit';
            const defaultStyles = {
                fontSize: '16px',
                color: '#000000',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'normal',
                textAlign: 'left',
                left: '50px',
                top: '50px'
            };
            
            this.addTextElement(defaultText, defaultStyles);
            
            // 记录操作用于撤销/重做
            if (this.historyManager) {
                this.historyManager.recordAction();
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'add text', true);
        }
    }

    addTextElement(text, styles = {}) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text content provided');
            }

            const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
            if (!currentCard) {
                throw new Error(`Card element not found for side: ${this.currentSide}`);
            }

            const content = currentCard.querySelector('.card-content');
            if (!content) {
                throw new Error('Card content element not found');
            }
            
            // 隐藏drop-zone
            const dropZone = content.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.display = 'none';
            }

            const textElement = document.createElement('div');
            textElement.className = 'draggable-element text-element';
            textElement.style.left = '50px';
            textElement.style.top = '50px';
            textElement.style.minWidth = '100px';
            textElement.style.minHeight = '30px';
            textElement.style.position = 'absolute';
            textElement.style.cursor = 'move';
            textElement.style.fontSize = '16px';
            textElement.style.color = '#000000';
            textElement.style.fontFamily = 'Arial, sans-serif';
            textElement.style.userSelect = 'none';
            textElement.textContent = text;
            
            // 应用样式
            if (styles && typeof styles === 'object') {
                Object.assign(textElement.style, styles);
            }
            
            // 如果是限制材质，应用单色限制 - 金属背面除外
            const shouldApplyColorRestriction = this.restrictedMaterials.includes(this.currentMaterial) && 
                                              !(this.currentMaterial === 'metal' && this.currentSide === 'back');
            
            if (shouldApplyColorRestriction) {
                if (this.currentMaterial === 'wood') {
                    textElement.style.color = '#8B4513'; // 木质色调
                } else if (this.currentMaterial === 'metal') {
                    textElement.style.color = '#333333'; // 金属雕刻色
                }
            }
            
            this.addDragHandles(textElement);
            content.appendChild(textElement);

            // 添加到元素列表
            const elementData = {
                element: textElement,
                type: 'text',
                data: { text, styles },
                // 存储序列化友好的数据
                serializable: {
                    type: 'text',
                    text: text,
                    styles: styles,
                    position: {
                        left: textElement.style.left,
                        top: textElement.style.top,
                        minWidth: textElement.style.minWidth,
                        minHeight: textElement.style.minHeight
                    }
                }
            };

            this.elements[this.currentSide].push(elementData);
            this.selectElement(textElement);
            
            // Record action for undo/redo
            if (this.historyManager) {
                this.historyManager.recordAction();
            }

            // Show success notification
            const message = this.currentLanguage === 'zh' ? '文字添加成功' : 'Text added successfully';
            // Notification removed as requested

        } catch (error) {
            this.errorHandler.handleError(error, 'add text element');
        }
    }

    addShape(event) {
        // 🔧 检查是否在受限制的模式下（半定制模板背面或其他限制材质背面）
        const shouldRestrict = (this.isSemiCustomMode && this.currentSide === 'back') || 
                              (this.currentMaterial === 'metal' && this.currentSide === 'back') ||
                              (this.currentMaterial === 'wood' && this.currentSide === 'back');
        
        if (shouldRestrict) {
            const message = this.currentLanguage === 'zh' 
                ? '当前模式下背面不允许添加形状元素' 
                : 'Shape elements cannot be added to the back side in this mode';
            alert(message);
            console.log('🚫 阻止在受限制模式下添加形状');
            return;
        }
        
        this.showShapePopup(event);
    }

    setupShapePopup() {
        this.currentShapeType = 'rectangle';
        this.mouseClickPosition = { x: 0, y: 0 };
        
        // 形状选择事件
        document.querySelectorAll('.shape-option').forEach(option => {
            option.addEventListener('click', (e) => {
                this.selectShapeType(e.currentTarget.dataset.shape);
            });
        });
        
        // 属性控制事件
        document.getElementById('popupEnableFill').addEventListener('change', () => {
            this.updateShapePreview();
        });
        
        document.getElementById('popupFillColor').addEventListener('change', () => {
            this.updateShapePreview();
        });
        
        document.getElementById('popupEnableStroke').addEventListener('change', () => {
            this.updateShapePreview();
        });
        
        document.getElementById('popupStrokeColor').addEventListener('change', () => {
            this.updateShapePreview();
        });
        
        document.getElementById('popupStrokeWidth').addEventListener('input', (e) => {
            document.getElementById('popupStrokeWidthValue').textContent = e.target.value + 'px';
            this.updateShapePreview();
        });
        
        document.getElementById('popupStrokeStyle').addEventListener('change', () => {
            this.updateShapePreview();
        });
        
        // 按钮事件
        document.getElementById('confirmShape').addEventListener('click', () => {
            this.createShapeFromPopup();
        });
        
        document.getElementById('cancelShape').addEventListener('click', () => {
            this.hideShapePopup();
        });
        
        // 点击外部关闭
        document.getElementById('shapePopup').addEventListener('click', (e) => {
            if (e.target === document.getElementById('shapePopup')) {
                this.hideShapePopup();
            }
        });
        
        // 初始化选择第一个形状
        document.querySelector('.shape-option').classList.add('active');
        
        // 初始化预览
        this.updateShapePreview();
    }
    
    showShapePopup(event) {
        // 保存点击位置
        this.mouseClickPosition = { x: event.clientX, y: event.clientY };
        
        const popup = document.getElementById('shapePopup');
        const popupContent = popup.querySelector('.shape-popup-content');
        
        // 显示弹窗
        popup.style.display = 'flex';
        
        // 计算位置
        const rect = popupContent.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        
        let x = this.mouseClickPosition.x - rect.width / 2;
        let y = this.mouseClickPosition.y - rect.height / 2;
        
        // 边界检查
        if (x < 20) x = 20;
        if (x + rect.width > windowWidth - 20) x = windowWidth - rect.width - 20;
        if (y < 20) y = 20;
        if (y + rect.height > windowHeight - 20) y = windowHeight - rect.height - 20;
        
        popupContent.style.left = x + 'px';
        popupContent.style.top = y + 'px';
        popupContent.style.position = 'fixed';
        
        // 动画效果
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
    }
    
    hideShapePopup() {
        const popup = document.getElementById('shapePopup');
        popup.classList.remove('show');
        setTimeout(() => {
            popup.style.display = 'none';
        }, 300);
    }
    
    selectShapeType(shapeType) {
        this.currentShapeType = shapeType;
        
        // 更新选择状态
        document.querySelectorAll('.shape-option').forEach(option => {
            option.classList.remove('active');
        });
        document.querySelector(`[data-shape="${shapeType}"]`).classList.add('active');
        
        this.updateShapePreview();
    }
    
    updateShapePreview() {
        const preview = document.getElementById('previewShape');
        const properties = this.getShapePropertiesFromPopup();
        
        this.applyShapeStyleToElement(preview, this.currentShapeType, properties);
    }
    
    getShapePropertiesFromPopup() {
        return {
            fillColor: document.getElementById('popupFillColor').value,
            enableFill: document.getElementById('popupEnableFill').checked,
            strokeColor: document.getElementById('popupStrokeColor').value,
            enableStroke: document.getElementById('popupEnableStroke').checked,
            strokeWidth: parseInt(document.getElementById('popupStrokeWidth').value),
            strokeStyle: document.getElementById('popupStrokeStyle').value,
            opacity: 1
        };
    }
    
    createShapeFromPopup() {
        const properties = this.getShapePropertiesFromPopup();
        this.addShapeElement(this.currentShapeType, properties);
        this.hideShapePopup();
    }

    addShapeElement(shapeType, properties) {
        const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
        const content = currentCard.querySelector('.card-content');
        
        // 隐藏drop-zone
        const dropZone = content.querySelector('.drop-zone');
        if (dropZone) {
            dropZone.style.display = 'none';
        }

        const shapeElement = document.createElement('div');
        shapeElement.className = 'draggable-element shape-element';
        shapeElement.style.left = '50px';
        shapeElement.style.top = '50px';
        shapeElement.style.width = '80px';
        shapeElement.style.height = '80px';
        shapeElement.style.opacity = properties.opacity;
        
        const shapeContent = document.createElement('div');
        shapeContent.className = 'shape-content';
        
        // 应用形状样式
        this.applyShapeStyleToElement(shapeContent, shapeType, properties);
        
        shapeElement.appendChild(shapeContent);
        this.addDragHandles(shapeElement);
        content.appendChild(shapeElement);

        // 添加到元素列表
        this.elements[this.currentSide].push({
            element: shapeElement,
            type: 'shape',
            data: { shapeType, properties },
            // 存储序列化友好的数据
            serializable: {
                type: 'shape',
                shapeType: shapeType,
                properties: properties,
                position: {
                    left: shapeElement.style.left,
                    top: shapeElement.style.top,
                    width: shapeElement.style.width,
                    height: shapeElement.style.height
                }
            }
        });

        this.selectElement(shapeElement);
    }

    applyShapeStyleToElement(element, shapeType, properties) {
        // 重置样式
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.background = 'transparent';
        element.style.border = 'none';
        element.style.borderRadius = '0';
        element.style.clipPath = 'none';
        element.style.borderLeft = '';
        element.style.borderRight = '';
        element.style.borderBottom = '';
        element.style.boxShadow = 'none';
        element.style.filter = 'none';
        
        // 映射虚线样式
        const strokeStyleMap = {
            '实线': 'solid',
            '虚线': 'dashed', 
            '点线': 'dotted',
            'solid': 'solid',
            'dashed': 'dashed',
            'dotted': 'dotted'
        };
        const borderStyle = strokeStyleMap[properties.strokeStyle] || 'solid';
        
        // 应用填充
        if (properties.enableFill) {
            element.style.background = properties.fillColor;
        }
        
        // 应用描边
        if (properties.enableStroke) {
            element.style.border = `${properties.strokeWidth}px ${borderStyle} ${properties.strokeColor}`;
        }
        
        // 应用形状特定样式
        switch (shapeType) {
            case 'circle':
                element.style.borderRadius = '50%';
                break;
            case 'rectangle':
            default:
                element.style.borderRadius = '8px';
                break;
        }
    }

    addDragHandles(element) {
        // 添加拖拽功能
        element.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) {
                return;
            }
            
            e.preventDefault();
            this.selectElement(element);
            this.startDrag(e, element);
        });

        // 添加调整大小手柄 - 角落把手(等比例) + 边缘把手(独立拉伸)
        const resizeHandles = [
            // 角落把手 - 等比例缩放
            'top-left', 'top-right', 'bottom-left', 'bottom-right',
            // 边缘把手 - 独立拉伸
            'top', 'right', 'bottom', 'left'
        ];
        resizeHandles.forEach(position => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.startResize(e, element, position);
            });
            element.appendChild(handle);
        });

        // 添加旋转手柄
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.startRotate(e, element);
        });
        element.appendChild(rotateHandle);

        // 单击编辑文字，但需要延迟以避免与drag冲突
        if (element.classList.contains('text-element')) {
            let clickTimeout;
            element.addEventListener('click', (e) => {
                // 如果正在拖拽，则不触发编辑
                if (this.isDragging) return;
                
                // 延迟执行，如果在这个时间内开始拖拽则取消
                clickTimeout = setTimeout(() => {
                    if (!this.isDragging) {
                        this.editText(element);
                    }
                }, 150); // 150ms延迟足够区分点击和拖拽
            });
            
            // 当开始拖拽时取消文本编辑
            element.addEventListener('mousedown', () => {
                if (clickTimeout) {
                    clearTimeout(clickTimeout);
                    clickTimeout = null;
                }
            });
        }
    }

    selectElement(element) {
        try {
            if (!element) {
                throw new Error('No element provided for selection');
            }

            // Prevent selecting the same element twice
            if (this.selectedElement === element) {
                return;
            }

            // Deselect current element first
            this.deselectElement();
            
            this.selectedElement = element;
            element.classList.add('selected');
            
            // 特殊处理QR码元素：确保选中时在最顶层
            if (element.classList.contains('qr-element') || element.hasAttribute('data-is-qr')) {
                element.style.zIndex = '10000'; // QR码选中时的最高优先级
                console.log('🔄 QR码元素已选中，设置最高z-index:', element.style.zIndex);
            } else {
                // 普通元素选中时的z-index提升
                const currentZIndex = parseInt(getComputedStyle(element).zIndex) || 0;
                element.style.zIndex = Math.max(currentZIndex + 100, 100);
            }
            
            // 显示调整手柄
            const handles = element.querySelectorAll('.resize-handle, .rotate-handle');
            handles.forEach(handle => {
                if (handle) {
                    handle.style.display = 'block';
                }
            });

            // Enable appropriate delete button based on element type
            if (element.classList.contains('image-element')) {
                const deleteBtn = document.getElementById('deleteImageBtn');
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.style.opacity = '1';
                }
            } else if (element.classList.contains('text-element')) {
                const deleteBtn = document.getElementById('deleteTextBtn');
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.style.opacity = '1';
                }
            } else if (element.classList.contains('shape-element')) {
                const deleteBtn = document.getElementById('deleteShapeBtn');
                if (deleteBtn) {
                    deleteBtn.disabled = false;
                    deleteBtn.style.opacity = '1';
                }
            }

            // Update properties panel
            this.updatePropertiesPanel(element);
            
            // Visual feedback with improved styling
            element.style.outline = '2px solid #007bff';
            element.style.outlineOffset = '2px';
            element.style.boxShadow = '0 0 10px rgba(0, 123, 255, 0.3)';
            
            // Bring element to front during selection
            element.style.zIndex = '100';
            
            // Show selection feedback message
            const elementType = element.classList.contains('text-element') ? 'text' : 
                               element.classList.contains('image-element') ? 'image' : 'shape';
            const message = this.currentLanguage === 'zh' 
                ? `已选择${elementType === 'text' ? '文字' : elementType === 'image' ? '图片' : '形状'}元素`
                : `${elementType.charAt(0).toUpperCase() + elementType.slice(1)} element selected`;
            // Notification removed as requested
            
        } catch (error) {
            this.errorHandler.handleError(error, 'element selection', false);
        }
    }

    deselectElement() {
        try {
            if (this.selectedElement) {
                this.selectedElement.classList.remove('selected');
                
                // Remove visual feedback
                this.selectedElement.style.outline = '';
                this.selectedElement.style.outlineOffset = '';
                this.selectedElement.style.boxShadow = '';
                
                // 特殊处理QR码元素：取消选中时恢复到正确的z-index
                if (this.selectedElement.classList.contains('qr-element') || this.selectedElement.hasAttribute('data-is-qr')) {
                    this.selectedElement.style.zIndex = '9999'; // QR码元素恢复到高优先级
                    console.log('🔄 QR码元素取消选中，恢复到z-index: 9999');
                } else {
                    this.selectedElement.style.zIndex = ''; // 普通元素清除z-index
                }
                
                // 隐藏调整手柄
                const handles = this.selectedElement.querySelectorAll('.resize-handle, .rotate-handle');
                handles.forEach(handle => {
                    if (handle) {
                        handle.style.display = 'none';
                    }
                });
                
                this.selectedElement = null;
            }
            
            // Disable all delete buttons
            ['deleteImageBtn', 'deleteTextBtn', 'deleteShapeBtn'].forEach(btnId => {
                const deleteBtn = document.getElementById(btnId);
                if (deleteBtn) {
                    deleteBtn.disabled = true;
                    deleteBtn.style.opacity = '0.5';
                }
            });
            
            // Update properties panel
            this.updatePropertiesPanel(null);
            
        } catch (error) {
            this.errorHandler.handleError(error, 'element deselection', false);
        }
    }

    updatePropertiesPanel(element) {
        // Hide all property panels first
        const imagePropertiesPanel = document.getElementById('imagePropertiesPanel');
        const textPropertiesPanel = document.getElementById('textPropertiesPanel');
        const shapePropertiesPanel = document.getElementById('shapePropertiesPanel');
        const uploadSection = document.getElementById('uploadSection');
        const textHint = document.getElementById('addTextSection');
        const shapeHint = document.getElementById('addShapeSection');
        
        // Hide all specific property panels
        [imagePropertiesPanel, textPropertiesPanel, shapePropertiesPanel].forEach(panel => {
            if (panel) panel.style.display = 'none';
        });
        
        // Show default hint panels
        [uploadSection, textHint, shapeHint].forEach(panel => {
            if (panel) panel.style.display = 'block';
        });
        
        if (!element) {
            // Show the appropriate hint panel based on current feature
            const currentFeature = this.featureSelector?.currentFeature || 'material';
            if (currentFeature === 'image' && uploadSection) {
                uploadSection.style.display = 'block';
            } else if (currentFeature === 'text' && textHint) {
                textHint.style.display = 'block';
            } else if (currentFeature === 'shape' && shapeHint) {
                shapeHint.style.display = 'block';
            }
            return;
        }
        
        // Show and populate the appropriate property panel based on element type
        if (element.classList.contains('image-element') && imagePropertiesPanel) {
            // Hide upload section and show image properties
            if (uploadSection) uploadSection.style.display = 'none';
            imagePropertiesPanel.style.display = 'block';
            
            // Populate image properties with current values and setup bidirectional binding
            this.setupImagePropertiesBinding(element);
            
            // Switch to image feature tab
            if (this.featureSelector) {
                this.featureSelector.showFeature('image');
            }
            
        } else if (element.classList.contains('text-element') && textPropertiesPanel) {
            if (textHint) textHint.style.display = 'none';
            textPropertiesPanel.style.display = 'block';
            
            // Populate text properties with current values and setup bidirectional binding
            this.setupTextPropertiesBinding(element);
            
            // Switch to text feature tab
            if (this.featureSelector) {
                this.featureSelector.showFeature('text');
            }
            
        } else if (element.classList.contains('shape-element') && shapePropertiesPanel) {
            if (shapeHint) shapeHint.style.display = 'none';
            shapePropertiesPanel.style.display = 'block';
            
            // Populate shape properties with current values and setup bidirectional binding
            this.setupShapePropertiesBinding(element);
            
            // Switch to shape feature tab
            if (this.featureSelector) {
                this.featureSelector.showFeature('shape');
            }
        }
    }

    setupImagePropertiesBinding(element) {
        try {
            // Get current values from element
            const rect = element.getBoundingClientRect();
            const container = element.closest('.card');
            const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
            
            const widthInput = document.getElementById('imageWidth');
            const heightInput = document.getElementById('imageHeight');
            const xInput = document.getElementById('imageX');
            const yInput = document.getElementById('imageY');
            const opacityInput = document.getElementById('imageOpacity');
            const rotationInput = document.getElementById('imageRotation');
            const opacityValue = document.getElementById('opacityValue');
            const rotationValue = document.getElementById('rotationValue');
            const deleteBtn = document.getElementById('deleteImageBtn');
            const aspectRatioCheckbox = document.getElementById('maintainAspectRatio');
            
            // Populate current values
            if (widthInput) widthInput.value = Math.round(element.offsetWidth);
            if (heightInput) heightInput.value = Math.round(element.offsetHeight);
            if (xInput) xInput.value = Math.round(parseFloat(element.style.left) || 0);
            if (yInput) yInput.value = Math.round(parseFloat(element.style.top) || 0);
            
            const currentOpacity = parseFloat(element.style.opacity) || 1;
            if (opacityInput) opacityInput.value = Math.round(currentOpacity * 100);
            if (opacityValue) opacityValue.textContent = Math.round(currentOpacity * 100) + '%';
            
            const transform = element.style.transform || '';
            const rotationMatch = transform.match(/rotate\(([^)]+)deg\)/);
            const currentRotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;
            if (rotationInput) rotationInput.value = currentRotation;
            if (rotationValue) rotationValue.textContent = currentRotation + '°';
            
            // 确保图片使用fill模式
            const img = element.querySelector('img');
            if (img) {
                img.style.objectFit = 'fill';
            }
            
            // Remove existing event listeners to avoid duplicates
            const newWidthInput = widthInput?.cloneNode(true);
            const newHeightInput = heightInput?.cloneNode(true);
            const newXInput = xInput?.cloneNode(true);
            const newYInput = yInput?.cloneNode(true);
            const newOpacityInput = opacityInput?.cloneNode(true);
            const newRotationInput = rotationInput?.cloneNode(true);
            const newDeleteBtn = deleteBtn?.cloneNode(true);
            
            if (widthInput && newWidthInput) {
                widthInput.parentNode.replaceChild(newWidthInput, widthInput);
                newWidthInput.addEventListener('input', (e) => {
                    const newWidth = parseFloat(e.target.value);
                    if (!isNaN(newWidth) && newWidth > 0) {
                        if (aspectRatioCheckbox?.checked) {
                            const aspectRatio = element.offsetWidth / element.offsetHeight;
                            const newHeight = newWidth / aspectRatio;
                            element.style.width = newWidth + 'px';
                            element.style.height = newHeight + 'px';
                            if (newHeightInput) newHeightInput.value = Math.round(newHeight);
                        } else {
                            element.style.width = newWidth + 'px';
                        }
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (heightInput && newHeightInput) {
                heightInput.parentNode.replaceChild(newHeightInput, heightInput);
                newHeightInput.addEventListener('input', (e) => {
                    const newHeight = parseFloat(e.target.value);
                    if (!isNaN(newHeight) && newHeight > 0) {
                        if (aspectRatioCheckbox?.checked) {
                            const aspectRatio = element.offsetWidth / element.offsetHeight;
                            const newWidth = newHeight * aspectRatio;
                            element.style.height = newHeight + 'px';
                            element.style.width = newWidth + 'px';
                            if (newWidthInput) newWidthInput.value = Math.round(newWidth);
                        } else {
                            element.style.height = newHeight + 'px';
                        }
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (xInput && newXInput) {
                xInput.parentNode.replaceChild(newXInput, xInput);
                newXInput.addEventListener('input', (e) => {
                    const newX = parseFloat(e.target.value);
                    if (!isNaN(newX)) {
                        element.style.left = newX + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (yInput && newYInput) {
                yInput.parentNode.replaceChild(newYInput, yInput);
                newYInput.addEventListener('input', (e) => {
                    const newY = parseFloat(e.target.value);
                    if (!isNaN(newY)) {
                        element.style.top = newY + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (opacityInput && newOpacityInput) {
                opacityInput.parentNode.replaceChild(newOpacityInput, opacityInput);
                newOpacityInput.addEventListener('input', (e) => {
                    const newOpacity = parseFloat(e.target.value) / 100;
                    element.style.opacity = newOpacity;
                    if (opacityValue) opacityValue.textContent = Math.round(newOpacity * 100) + '%';
                    this.historyManager?.recordAction();
                });
            }
            
            if (rotationInput && newRotationInput) {
                rotationInput.parentNode.replaceChild(newRotationInput, rotationInput);
                newRotationInput.addEventListener('input', (e) => {
                    const newRotation = parseFloat(e.target.value);
                    const existingTransform = element.style.transform || '';
                    const cleanTransform = existingTransform.replace(/rotate\([^)]+\)/g, '').trim();
                    element.style.transform = cleanTransform + ` rotate(${newRotation}deg)`;
                    if (rotationValue) rotationValue.textContent = newRotation + '°';
                    this.historyManager?.recordAction();
                });
            }
            
            if (deleteBtn && newDeleteBtn) {
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.disabled = false;
                newDeleteBtn.addEventListener('click', () => {
                    this.deleteElement(element);
                });
            }
            
            
        } catch (error) {
            console.error('Error setting up image properties binding:', error);
        }
    }

    setupTextPropertiesBinding(element) {
        try {
            // Get all text property controls
            const contentInput = document.getElementById('textContentInput');
            const fontFamilySelect = document.getElementById('fontFamilySelect');
            const textSizeInput = document.getElementById('textSize');
            const textSizeValue = document.getElementById('textSizeValue');
            const textColorInput = document.getElementById('textColor');
            const xInput = document.getElementById('textX');
            const yInput = document.getElementById('textY');
            const deleteBtn = document.getElementById('deleteTextBtn');
            
            // Populate current values from element
            if (contentInput) {
                contentInput.value = element.textContent || '';
            }
            
            if (fontFamilySelect) {
                const currentFont = element.style.fontFamily.replace(/['"]/g, '') || 'Arial';
                fontFamilySelect.value = currentFont;
            }
            
            if (textSizeInput && textSizeValue) {
                const currentSize = parseInt(element.style.fontSize) || 16;
                textSizeInput.value = currentSize;
                textSizeValue.textContent = currentSize + 'px';
            }
            
            if (textColorInput) {
                textColorInput.value = element.style.color || '#000000';
            }
            
            if (xInput) {
                xInput.value = Math.round(parseFloat(element.style.left) || 0);
            }
            
            if (yInput) {
                yInput.value = Math.round(parseFloat(element.style.top) || 0);
            }
            
            // Remove existing event listeners by cloning elements
            const newContentInput = contentInput?.cloneNode(true);
            const newFontFamilySelect = fontFamilySelect?.cloneNode(true);
            const newTextSizeInput = textSizeInput?.cloneNode(true);
            const newTextColorInput = textColorInput?.cloneNode(true);
            const newXInput = xInput?.cloneNode(true);
            const newYInput = yInput?.cloneNode(true);
            const newDeleteBtn = deleteBtn?.cloneNode(true);
            
            // Replace and bind content input
            if (contentInput && newContentInput) {
                contentInput.parentNode.replaceChild(newContentInput, contentInput);
                newContentInput.addEventListener('input', (e) => {
                    element.textContent = e.target.value;
                    this.historyManager?.recordAction();
                });
            }
            
            // Replace and bind font family select
            if (fontFamilySelect && newFontFamilySelect) {
                fontFamilySelect.parentNode.replaceChild(newFontFamilySelect, fontFamilySelect);
                newFontFamilySelect.addEventListener('change', (e) => {
                    element.style.fontFamily = e.target.value;
                    this.historyManager?.recordAction();
                });
            }
            
            // Replace and bind text size input
            if (textSizeInput && newTextSizeInput) {
                textSizeInput.parentNode.replaceChild(newTextSizeInput, textSizeInput);
                newTextSizeInput.addEventListener('input', (e) => {
                    const newSize = parseInt(e.target.value);
                    element.style.fontSize = newSize + 'px';
                    if (textSizeValue) textSizeValue.textContent = newSize + 'px';
                    this.historyManager?.recordAction();
                });
            }
            
            // Replace and bind color input
            if (textColorInput && newTextColorInput) {
                textColorInput.parentNode.replaceChild(newTextColorInput, textColorInput);
                newTextColorInput.addEventListener('input', (e) => {
                    element.style.color = e.target.value;
                    this.historyManager?.recordAction();
                });
            }
            
            // Replace and bind position inputs
            if (xInput && newXInput) {
                xInput.parentNode.replaceChild(newXInput, xInput);
                newXInput.addEventListener('input', (e) => {
                    const newX = parseFloat(e.target.value);
                    if (!isNaN(newX)) {
                        element.style.left = newX + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (yInput && newYInput) {
                yInput.parentNode.replaceChild(newYInput, yInput);
                newYInput.addEventListener('input', (e) => {
                    const newY = parseFloat(e.target.value);
                    if (!isNaN(newY)) {
                        element.style.top = newY + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            // Replace and bind delete button
            if (deleteBtn && newDeleteBtn) {
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.disabled = false;
                newDeleteBtn.style.opacity = '1';
                newDeleteBtn.addEventListener('click', () => {
                    this.deleteElement(element);
                });
            }
            
        } catch (error) {
            console.error('Error setting up text properties binding:', error);
        }
    }

    setupShapePropertiesBinding(element) {
        try {
            // Get all shape property controls
            const widthInput = document.getElementById('shapeWidth');
            const heightInput = document.getElementById('shapeHeight');
            const xInput = document.getElementById('shapeX');
            const yInput = document.getElementById('shapeY');
            const fillCheckbox = document.getElementById('enableFill');
            const fillColorInput = document.getElementById('shapeFillColor');
            const strokeCheckbox = document.getElementById('enableStroke');
            const strokeColorInput = document.getElementById('shapeStrokeColor');
            const strokeWidthInput = document.getElementById('shapeStrokeWidth');
            const strokeWidthValue = document.getElementById('strokeWidthValue');
            const opacityInput = document.getElementById('shapeOpacity');
            const opacityValue = document.getElementById('shapeOpacityValue');
            const deleteBtn = document.getElementById('deleteShapeBtn');
            
            // Get shape content element
            const shapeContent = element.querySelector('.shape-content');
            
            // Populate current values
            if (widthInput) widthInput.value = Math.round(element.offsetWidth);
            if (heightInput) heightInput.value = Math.round(element.offsetHeight);
            if (xInput) xInput.value = Math.round(parseFloat(element.style.left) || 0);
            if (yInput) yInput.value = Math.round(parseFloat(element.style.top) || 0);
            
            if (shapeContent) {
                const currentOpacity = parseFloat(element.style.opacity) || 1;
                if (opacityInput) opacityInput.value = Math.round(currentOpacity * 100);
                if (opacityValue) opacityValue.textContent = Math.round(currentOpacity * 100) + '%';
                
                // Handle fill settings
                const backgroundColor = shapeContent.style.backgroundColor;
                if (fillCheckbox) fillCheckbox.checked = !!backgroundColor && backgroundColor !== 'transparent';
                if (fillColorInput && backgroundColor) fillColorInput.value = this.rgbToHex(backgroundColor) || '#3498db';
                
                // Handle stroke settings
                const borderWidth = parseInt(shapeContent.style.borderWidth) || 0;
                const borderColor = shapeContent.style.borderColor;
                if (strokeCheckbox) strokeCheckbox.checked = borderWidth > 0;
                if (strokeColorInput) strokeColorInput.value = borderColor ? this.rgbToHex(borderColor) || '#2c3e50' : '#2c3e50';
                // Set default stroke width to 2 if no border exists, otherwise use actual border width
                const displayWidth = borderWidth > 0 ? borderWidth : 2;
                if (strokeWidthInput) strokeWidthInput.value = displayWidth;
                if (strokeWidthValue) strokeWidthValue.textContent = displayWidth + 'px';
            }
            
            // Clone elements to remove existing listeners
            const newWidthInput = widthInput?.cloneNode(true);
            const newHeightInput = heightInput?.cloneNode(true);
            const newXInput = xInput?.cloneNode(true);
            const newYInput = yInput?.cloneNode(true);
            const newFillCheckbox = fillCheckbox?.cloneNode(true);
            const newFillColorInput = fillColorInput?.cloneNode(true);
            const newStrokeCheckbox = strokeCheckbox?.cloneNode(true);
            const newStrokeColorInput = strokeColorInput?.cloneNode(true);
            const newStrokeWidthInput = strokeWidthInput?.cloneNode(true);
            const newOpacityInput = opacityInput?.cloneNode(true);
            const newDeleteBtn = deleteBtn?.cloneNode(true);
            
            // Replace and bind dimension controls
            if (widthInput && newWidthInput) {
                widthInput.parentNode.replaceChild(newWidthInput, widthInput);
                newWidthInput.addEventListener('input', (e) => {
                    const newWidth = parseFloat(e.target.value);
                    if (!isNaN(newWidth) && newWidth > 0) {
                        element.style.width = newWidth + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (heightInput && newHeightInput) {
                heightInput.parentNode.replaceChild(newHeightInput, heightInput);
                newHeightInput.addEventListener('input', (e) => {
                    const newHeight = parseFloat(e.target.value);
                    if (!isNaN(newHeight) && newHeight > 0) {
                        element.style.height = newHeight + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            // Replace and bind position controls
            if (xInput && newXInput) {
                xInput.parentNode.replaceChild(newXInput, xInput);
                newXInput.addEventListener('input', (e) => {
                    const newX = parseFloat(e.target.value);
                    if (!isNaN(newX)) {
                        element.style.left = newX + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (yInput && newYInput) {
                yInput.parentNode.replaceChild(newYInput, yInput);
                newYInput.addEventListener('input', (e) => {
                    const newY = parseFloat(e.target.value);
                    if (!isNaN(newY)) {
                        element.style.top = newY + 'px';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            // Replace and bind fill controls
            if (fillCheckbox && newFillCheckbox) {
                fillCheckbox.parentNode.replaceChild(newFillCheckbox, fillCheckbox);
                newFillCheckbox.addEventListener('change', (e) => {
                    if (shapeContent) {
                        shapeContent.style.backgroundColor = e.target.checked 
                            ? (newFillColorInput ? newFillColorInput.value : '#3498db')
                            : 'transparent';
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (fillColorInput && newFillColorInput) {
                fillColorInput.parentNode.replaceChild(newFillColorInput, fillColorInput);
                newFillColorInput.addEventListener('input', (e) => {
                    if (shapeContent && newFillCheckbox?.checked) {
                        shapeContent.style.backgroundColor = e.target.value;
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            // Replace and bind stroke controls
            if (strokeCheckbox && newStrokeCheckbox) {
                strokeCheckbox.parentNode.replaceChild(newStrokeCheckbox, strokeCheckbox);
                newStrokeCheckbox.addEventListener('change', (e) => {
                    if (shapeContent) {
                        if (e.target.checked) {
                            const strokeWidth = newStrokeWidthInput ? newStrokeWidthInput.value : 2;
                            const strokeColor = newStrokeColorInput ? newStrokeColorInput.value : '#2c3e50';
                            shapeContent.style.border = `${strokeWidth}px solid ${strokeColor}`;
                        } else {
                            shapeContent.style.border = 'none';
                        }
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (strokeColorInput && newStrokeColorInput) {
                strokeColorInput.parentNode.replaceChild(newStrokeColorInput, strokeColorInput);
                newStrokeColorInput.addEventListener('input', (e) => {
                    if (shapeContent && newStrokeCheckbox?.checked) {
                        const strokeWidth = newStrokeWidthInput ? newStrokeWidthInput.value : 2;
                        shapeContent.style.border = `${strokeWidth}px solid ${e.target.value}`;
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            if (strokeWidthInput && newStrokeWidthInput) {
                strokeWidthInput.parentNode.replaceChild(newStrokeWidthInput, strokeWidthInput);
                newStrokeWidthInput.addEventListener('input', (e) => {
                    const newWidth = parseInt(e.target.value);
                    if (strokeWidthValue) strokeWidthValue.textContent = newWidth + 'px';
                    if (shapeContent) {
                        if (newStrokeCheckbox?.checked && newWidth > 0) {
                            const strokeColor = newStrokeColorInput ? newStrokeColorInput.value : '#2c3e50';
                            shapeContent.style.border = `${newWidth}px solid ${strokeColor}`;
                        } else if (newWidth === 0 || !newStrokeCheckbox?.checked) {
                            shapeContent.style.border = 'none';
                        }
                        this.historyManager?.recordAction();
                    }
                });
            }
            
            // Replace and bind opacity control
            if (opacityInput && newOpacityInput) {
                opacityInput.parentNode.replaceChild(newOpacityInput, opacityInput);
                newOpacityInput.addEventListener('input', (e) => {
                    const newOpacity = parseFloat(e.target.value) / 100;
                    element.style.opacity = newOpacity;
                    if (opacityValue) opacityValue.textContent = Math.round(newOpacity * 100) + '%';
                    this.historyManager?.recordAction();
                });
            }
            
            // Replace and bind delete button
            if (deleteBtn && newDeleteBtn) {
                deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
                newDeleteBtn.disabled = false;
                newDeleteBtn.style.opacity = '1';
                newDeleteBtn.addEventListener('click', () => {
                    this.deleteElement(element);
                });
            }
            
        } catch (error) {
            console.error('Error setting up shape properties binding:', error);
        }
    }

    // Helper function to convert RGB to hex
    rgbToHex(rgb) {
        if (!rgb) return null;
        
        const result = rgb.match(/\d+/g);
        if (!result || result.length < 3) return null;
        
        const r = parseInt(result[0]);
        const g = parseInt(result[1]);
        const b = parseInt(result[2]);
        
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    getShapeColor(element) {
        const shapeContent = element.querySelector('.shape-content');
        return shapeContent.style.background || '#3498db';
    }

    updateElementProperty(property, value) {
        if (!this.selectedElement) return;

        switch (property) {
            case 'text':
                this.selectedElement.textContent = value;
                break;
            case 'fontSize':
                this.selectedElement.style.fontSize = value;
                break;
            case 'color':
                this.selectedElement.style.color = value;
                break;
            case 'width':
                this.selectedElement.style.width = value;
                break;
            case 'height':
                this.selectedElement.style.height = value;
                break;
            case 'shapeColor':
                this.updateShapeColor(value);
                break;
            case 'size':
                this.selectedElement.style.width = value;
                this.selectedElement.style.height = value;
                break;
        }
    }

    startDrag(e, element) {
        try {
            if (!element) {
                throw new Error('No element provided for dragging');
            }

            this.isDragging = true;
            this.draggedElement = element;
            this.dragStartPos = { x: e.clientX, y: e.clientY };
            
            // Store initial element position
            this.elementStartPos = {
                x: parseInt(element.style.left) || 0,
                y: parseInt(element.style.top) || 0
            };
            
            // Add visual feedback
            element.style.zIndex = '1000';
            element.style.opacity = '0.8';
            
            document.addEventListener('mousemove', this.drag);
            document.addEventListener('mouseup', this.stopDrag);
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
            
        } catch (error) {
            this.errorHandler.handleError(error, 'start drag', false);
        }
    }

    drag = (e) => {
        try {
            if (!this.draggedElement || !this.isDragging) return;

            e.preventDefault();
            e.stopPropagation();
            
            const deltaX = e.clientX - this.dragStartPos.x;
            const deltaY = e.clientY - this.dragStartPos.y;
            
            const newLeft = this.elementStartPos.x + deltaX;
            const newTop = this.elementStartPos.y + deltaY;
            
            // Get container bounds for constraint checking
            const container = this.draggedElement.parentElement;
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const elementRect = this.draggedElement.getBoundingClientRect();
                
                // Calculate container dimensions relative to its content
                const containerStyle = window.getComputedStyle(container);
                const containerPadding = {
                    left: parseInt(containerStyle.paddingLeft) || 0,
                    top: parseInt(containerStyle.paddingTop) || 0,
                    right: parseInt(containerStyle.paddingRight) || 0,
                    bottom: parseInt(containerStyle.paddingBottom) || 0
                };
                
                // Apply constraints to keep element within container bounds
                const minLeft = containerPadding.left;
                const minTop = containerPadding.top;
                const maxLeft = container.clientWidth - elementRect.width - containerPadding.right;
                const maxTop = container.clientHeight - elementRect.height - containerPadding.bottom;
                
                const constrainedLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
                const constrainedTop = Math.max(minTop, Math.min(maxTop, newTop));
                
                this.draggedElement.style.left = constrainedLeft + 'px';
                this.draggedElement.style.top = constrainedTop + 'px';
                
                // Visual feedback for constraints
                if (newLeft !== constrainedLeft || newTop !== constrainedTop) {
                    this.draggedElement.style.borderColor = '#ff6b6b';
                } else {
                    this.draggedElement.style.borderColor = '';
                }
            } else {
                this.draggedElement.style.left = newLeft + 'px';
                this.draggedElement.style.top = newTop + 'px';
            }
            
            // 更新序列化数据
            this.updateElementSerializableData(this.draggedElement);
            
        } catch (error) {
            this.errorHandler.handleError(error, 'drag operation', false);
            // Stop dragging on error to prevent stuck state
            this.stopDrag();
        }
    }

    // 更新元素的序列化数据
    updateElementSerializableData(element) {
        try {
            const elementData = this.elements[this.currentSide].find(el => el.element === element);
            if (elementData && elementData.serializable) {
                elementData.serializable.position = {
                    left: element.style.left,
                    top: element.style.top,
                    width: element.style.width,
                    height: element.style.height,
                    transform: element.style.transform || ''
                };
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'update element serializable data', false);
        }
    }

    stopDrag = () => {
        try {
            if (this.draggedElement) {
                // Restore visual state
                this.draggedElement.style.zIndex = this.selectedElement === this.draggedElement ? '100' : '';
                this.draggedElement.style.opacity = '';
                this.draggedElement.style.borderColor = '';
                
                // Update properties panel to reflect the position changes
                if (this.selectedElement && this.selectedElement === this.draggedElement) {
                    this.updatePropertiesPanel(this.selectedElement);
                }
                
                // Record action for undo/redo
                if (this.historyManager) {
                    this.historyManager.recordAction();
                }
                
                // Show completion feedback
                const message = this.currentLanguage === 'zh' ? '元素移动完成' : 'Element moved';
                // Notification removed as requested
            }
            
            // Clean up drag state
            this.isDragging = false;
            this.draggedElement = null;
            this.dragStartPos = { x: 0, y: 0 };
            this.elementStartPos = { x: 0, y: 0 };
            
            // Remove event listeners
            document.removeEventListener('mousemove', this.drag);
            document.removeEventListener('mouseup', this.stopDrag);
            
            // Restore text selection
            document.body.style.userSelect = '';
            
        } catch (error) {
            this.errorHandler.handleError(error, 'stop drag', false);
            
            // Force cleanup on error
            this.isDragging = false;
            this.draggedElement = null;
            document.removeEventListener('mousemove', this.drag);
            document.removeEventListener('mouseup', this.stopDrag);
            document.body.style.userSelect = '';
        }
    }

    startResize(e, element, position) {
        this.isResizing = true;
        this.selectedElement = element;
        this.resizeHandle = position;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
        
        document.addEventListener('mousemove', this.resize);
        document.addEventListener('mouseup', this.stopResize);
    }

    resize = (e) => {
        try {
            if (!this.isResizing || !this.selectedElement) return;

            const deltaX = e.clientX - this.lastMousePos.x;
            const deltaY = e.clientY - this.lastMousePos.y;
            
            const currentWidth = parseInt(this.selectedElement.style.width) || 100;
            const currentHeight = parseInt(this.selectedElement.style.height) || 100;
            const currentLeft = parseInt(this.selectedElement.style.left) || 0;
            const currentTop = parseInt(this.selectedElement.style.top) || 0;
            
            // Minimum size constraints
            const minSize = 20;
            let newWidth = currentWidth;
            let newHeight = currentHeight;
            let newLeft = currentLeft;
            let newTop = currentTop;
            
            switch (this.resizeHandle) {
                // 角落把手 - 等比例缩放
                case 'top-left':
                    newWidth = Math.max(minSize, currentWidth - deltaX);
                    newHeight = Math.max(minSize, currentHeight - deltaY);
                    newLeft = currentLeft + (currentWidth - newWidth);
                    newTop = currentTop + (currentHeight - newHeight);
                    break;
                case 'top-right':
                    newWidth = Math.max(minSize, currentWidth + deltaX);
                    newHeight = Math.max(minSize, currentHeight - deltaY);
                    newTop = currentTop + (currentHeight - newHeight);
                    break;
                case 'bottom-left':
                    newWidth = Math.max(minSize, currentWidth - deltaX);
                    newHeight = Math.max(minSize, currentHeight + deltaY);
                    newLeft = currentLeft + (currentWidth - newWidth);
                    break;
                case 'bottom-right':
                    newWidth = Math.max(minSize, currentWidth + deltaX);
                    newHeight = Math.max(minSize, currentHeight + deltaY);
                    break;
                    
                // 边缘把手 - 独立拉伸
                case 'top':
                    newHeight = Math.max(minSize, currentHeight - deltaY);
                    newTop = currentTop + (currentHeight - newHeight);
                    break;
                case 'right':
                    newWidth = Math.max(minSize, currentWidth + deltaX);
                    break;
                case 'bottom':
                    newHeight = Math.max(minSize, currentHeight + deltaY);
                    break;
                case 'left':
                    newWidth = Math.max(minSize, currentWidth - deltaX);
                    newLeft = currentLeft + (currentWidth - newWidth);
                    break;
            }
            
            // Apply the new dimensions
            this.selectedElement.style.width = newWidth + 'px';
            this.selectedElement.style.height = newHeight + 'px';
            this.selectedElement.style.left = newLeft + 'px';
            this.selectedElement.style.top = newTop + 'px';
            
            // 为图片元素统一使用fill模式，避免裁剪和白边
            if (this.selectedElement.classList.contains('image-element')) {
                const img = this.selectedElement.querySelector('img');
                if (img) {
                    // 统一使用fill模式，无论是边缘把手还是角落把手
                    img.style.objectFit = 'fill';
                }
            }
            
            // Update last mouse position
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            
            // Update serializable data
            this.updateElementSerializableData(this.selectedElement);
            
            // Throttled real-time update of properties panel (every 100ms)
            if (!this._resizeUpdateTimeout) {
                this._resizeUpdateTimeout = setTimeout(() => {
                    if (this.selectedElement) {
                        this.updatePropertiesPanel(this.selectedElement);
                    }
                    this._resizeUpdateTimeout = null;
                }, 100);
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'resize operation', false);
        }
    }

    stopResize = () => {
        try {
            this.isResizing = false;
            this.resizeHandle = null;
            
            // Clear the throttled update timeout
            if (this._resizeUpdateTimeout) {
                clearTimeout(this._resizeUpdateTimeout);
                this._resizeUpdateTimeout = null;
            }
            
            document.removeEventListener('mousemove', this.resize);
            document.removeEventListener('mouseup', this.stopResize);
            
            // Update properties panel to reflect the changes
            if (this.selectedElement) {
                this.updatePropertiesPanel(this.selectedElement);
                
                // 对于图片元素，根据最终状态设置合适的object-fit
                if (this.selectedElement.classList.contains('image-element')) {
                    const img = this.selectedElement.querySelector('img');
                    if (img) {
                        // 检查容器是否被拉伸变形（不是正方形或原始比例）
                        const width = parseInt(this.selectedElement.style.width);
                        const height = parseInt(this.selectedElement.style.height);
                        const aspectRatio = width / height;
                        
                        // 如果比例接近原始图片比例，使用contain；否则使用fill
                        // 这里简化处理：contain保证不裁剪，fill允许变形填满
                        img.style.objectFit = 'contain';
                    }
                }
            }
            
            // Record action for undo/redo
            if (this.historyManager) {
                this.historyManager.recordAction();
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'stop resize', false);
        }
    }

    startRotate(e, element) {
        try {
            this.isRotating = true;
            this.selectedElement = element;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            
            // Get element center for rotation calculations
            const rect = element.getBoundingClientRect();
            this.rotationCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            
            document.addEventListener('mousemove', this.rotate);
            document.addEventListener('mouseup', this.stopRotate);
            
        } catch (error) {
            this.errorHandler.handleError(error, 'start rotate', false);
        }
    }

    rotate = (e) => {
        try {
            if (!this.isRotating || !this.selectedElement) return;

            const deltaX = e.clientX - this.rotationCenter.x;
            const deltaY = e.clientY - this.rotationCenter.y;
            
            // Calculate angle in degrees
            const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            
            // Apply rotation
            this.selectedElement.style.transform = `rotate(${angle}deg)`;
            
            // Update serializable data
            this.updateElementSerializableData(this.selectedElement);
            
        } catch (error) {
            this.errorHandler.handleError(error, 'rotate operation', false);
        }
    }

    stopRotate = () => {
        try {
            this.isRotating = false;
            this.rotationCenter = null;
            
            document.removeEventListener('mousemove', this.rotate);
            document.removeEventListener('mouseup', this.stopRotate);
            
            // Record action for undo/redo
            if (this.historyManager) {
                this.historyManager.recordAction();
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'stop rotate', false);
        }
    }

    stopResize = () => {
        this.isResizing = false;
        this.resizeHandle = null;
        document.removeEventListener('mousemove', this.resize);
        document.removeEventListener('mouseup', this.stopResize);
    }

    startRotate(e, element) {
        this.isRotating = true;
        this.selectedElement = element;
        
        const rect = element.getBoundingClientRect();
        this.rotateCenter = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        
        document.addEventListener('mousemove', this.rotate);
        document.addEventListener('mouseup', this.stopRotate);
    }

    rotate = (e) => {
        if (!this.isRotating || !this.selectedElement) return;

        const angle = Math.atan2(
            e.clientY - this.rotateCenter.y,
            e.clientX - this.rotateCenter.x
        ) * 180 / Math.PI;
        
        this.selectedElement.style.transform = `rotate(${angle}deg)`;
        
        // 更新序列化数据
        this.updateElementSerializableData(this.selectedElement);
    }

    stopRotate = () => {
        this.isRotating = false;
        document.removeEventListener('mousemove', this.rotate);
        document.removeEventListener('mouseup', this.stopRotate);
    }

    deleteElement(element) {
        if (!element) return;
        
        element.remove();
        
        // 从元素列表中移除
        const elementIndex = this.elements[this.currentSide].findIndex(item => item.element === element);
        if (elementIndex > -1) {
            this.elements[this.currentSide].splice(elementIndex, 1);
        }
        
        this.selectedElement = null;
        this.updatePropertiesPanel(null);
        
        // 检查是否需要显示drop-zone
        const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
        const content = currentCard.querySelector('.card-content');
        const elements = content.querySelectorAll('.draggable-element');
        
        if (elements.length === 0) {
            const dropZone = content.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.display = 'flex';
            }
        }
    }

    setupTextModal() {
        const modal = document.getElementById('textModal');
        const closeBtn = modal.querySelector('.close');
        const confirmBtn = document.getElementById('confirmText');
        const cancelBtn = document.getElementById('cancelText');
        
        closeBtn.addEventListener('click', () => {
            this.hideTextModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.hideTextModal();
        });
        
        confirmBtn.addEventListener('click', () => {
            this.confirmTextEdit();
        });
        
        // 点击模态框外部关闭
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.hideTextModal();
            }
        });
        
        // 字体大小滑块
        const fontSizeSlider = document.getElementById('fontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        
        fontSizeSlider.addEventListener('input', (e) => {
            fontSizeValue.textContent = e.target.value + 'px';
        });
        
        // 文字样式按钮
        document.getElementById('boldBtn').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
        });
        
        document.getElementById('italicBtn').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
        });
        
        document.getElementById('underlineBtn').addEventListener('click', (e) => {
            e.target.classList.toggle('active');
        });
        
        // 对齐按钮
        document.querySelectorAll('.align-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });
    }

    showTextModal(element = null) {
        const modal = document.getElementById('textModal');
        const textInput = document.getElementById('textInput');
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const fontSizeValue = document.getElementById('fontSizeValue');
        const textColor = document.getElementById('textColor');
        
        if (element) {
            // 编辑现有文字
            textInput.value = element.textContent;
            fontFamily.value = element.style.fontFamily || 'Microsoft YaHei';
            fontSize.value = parseInt(element.style.fontSize) || 16;
            fontSizeValue.textContent = fontSize.value + 'px';
            textColor.value = element.style.color || '#000000';
            
            // 设置样式按钮状态
            document.getElementById('boldBtn').classList.toggle('active', element.style.fontWeight === 'bold');
            document.getElementById('italicBtn').classList.toggle('active', element.style.fontStyle === 'italic');
            document.getElementById('underlineBtn').classList.toggle('active', element.style.textDecoration === 'underline');
            
            // 设置对齐按钮状态
            document.querySelectorAll('.align-btn').forEach(btn => btn.classList.remove('active'));
            const alignBtn = document.querySelector(`[data-align="${element.style.textAlign || 'left'}"]`);
            if (alignBtn) alignBtn.classList.add('active');
        } else {
            // 新建文字
            textInput.value = this.currentLanguage === 'zh' ? '双击编辑文字' : 'Double click to edit text';
            fontFamily.value = 'Microsoft YaHei';
            fontSize.value = 16;
            fontSizeValue.textContent = '16px';
            textColor.value = '#000000';
            
            // 重置样式按钮
            document.querySelectorAll('.style-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.align-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelector('[data-align="left"]').classList.add('active');
        }
        
        modal.style.display = 'block';
        textInput.focus();
    }

    hideTextModal() {
        document.getElementById('textModal').style.display = 'none';
    }

    confirmTextEdit() {
        const textInput = document.getElementById('textInput');
        const fontFamily = document.getElementById('fontFamily');
        const fontSize = document.getElementById('fontSize');
        const textColor = document.getElementById('textColor');
        
        const text = textInput.value.trim();
        if (!text) {
            const message = this.currentLanguage === 'zh' ? '请输入文字内容' : 'Please enter text content';
            alert(message);
            return;
        }
        
        const styles = {
            fontFamily: fontFamily.value,
            fontSize: fontSize.value + 'px',
            color: textColor.value,
            fontWeight: document.getElementById('boldBtn').classList.contains('active') ? 'bold' : 'normal',
            fontStyle: document.getElementById('italicBtn').classList.contains('active') ? 'italic' : 'normal',
            textDecoration: document.getElementById('underlineBtn').classList.contains('active') ? 'underline' : 'none',
            textAlign: document.querySelector('.align-btn.active').dataset.align || 'left'
        };
        
        if (this.selectedElement && this.selectedElement.classList.contains('text-element')) {
            // 更新现有文字
            this.selectedElement.textContent = text;
            Object.assign(this.selectedElement.style, styles);
        } else {
            // 创建新文字
            this.addTextElement(text, styles);
        }
        
        this.hideTextModal();
    }

    editText(element) {
        this.selectElement(element);
        this.showTextModal(element);
    }

    saveDesign() {
        const designData = {
            material: this.currentMaterial,
            template: this.currentTemplate,
            elements: this.elements
        };
        
        const dataStr = JSON.stringify(designData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'card-design.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }

    // 提交设计数据到服务器
    async submitDesign() {
        if (this.isSubmitting) {
            const message = this.currentLanguage === 'zh' ? '正在提交中，请稍候...' : 'Submitting, please wait...';
            alert(message);
            return;
        }

        // 检查是否有设计内容
        if (!this.currentMaterial || !this.currentTemplate) {
            const message = this.currentLanguage === 'zh' ? '请先选择材质和模板' : 'Please select material and template first';
            alert(message);
            return;
        }

        const hasElements = this.elements.front.length > 0 || this.elements.back.length > 0;
        if (!hasElements) {
            const message = this.currentLanguage === 'zh' ? '请先添加设计元素' : 'Please add design elements first';
            alert(message);
            return;
        }

        // PVC全定制模式必须有二维码验证
        if (this.currentMaterial === 'pvc' && this.currentTemplate === 'blank') {
            if (!this.hasQRCodeOnCard()) {
                const message = this.currentLanguage === 'zh' 
                    ? '请添加二维码！PVC全定制卡片必须包含二维码才能正常使用。' 
                    : 'Please add QR code! PVC full customization cards must contain a QR code to function properly.';
                alert(message);
                return;
            }
        }

        this.isSubmitting = true;
        const submitBtn = document.getElementById('saveBtn');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = this.currentLanguage === 'zh' ? '提交中...' : 'Submitting...';
        submitBtn.disabled = true;

        try {
            // 收集用户信息
            const customerInfo = await this.collectCustomerInfo();
            
            // 生成高分辨率设计数据
            const designData = await this.generateHighResDesignData(customerInfo);
            
            // 发送到服务器
            const response = await this.sendDesignToServer(designData);
            
            if (response.success) {
                const message = this.currentLanguage === 'zh' 
                    ? `设计提交成功！\n设计ID: ${response.designId}\n高分辨率图片已生成，用于生产制作。`
                    : `Design submitted successfully!\nDesign ID: ${response.designId}\nHigh-resolution images generated for production.`;
                alert(message);
                
                // 可选择性重置或保留设计
                const reset = confirm(this.currentLanguage === 'zh' ? '是否开始新的设计？' : 'Start a new design?');
                if (reset) {
                    this.resetDesign();
                }
            } else {
                throw new Error(response.message || 'Submission failed');
            }
            
        } catch (error) {
            console.error('提交设计失败:', error);
            const message = this.currentLanguage === 'zh' 
                ? `提交失败: ${error.message}\n请检查网络连接后重试。`
                : `Submission failed: ${error.message}\nPlease check network connection and try again.`;
            alert(message);
        } finally {
            this.isSubmitting = false;
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    }

    // 收集用户信息
    async collectCustomerInfo() {
        return new Promise((resolve, reject) => {
            const modal = document.getElementById('userInfoModal');
            const form = document.getElementById('userInfoForm');
            const closeBtn = document.getElementById('userInfoClose');
            const cancelBtn = document.getElementById('cancelSubmit');
            
            // 显示模态框
            modal.style.display = 'flex';
            
            // 清空之前的错误状态
            this.clearFormErrors();
            
            // 关闭模态框的函数
            const closeModal = () => {
                modal.style.display = 'none';
                form.reset();
                this.clearFormErrors();
            };
            
            // 取消提交
            const handleCancel = () => {
                closeModal();
                reject(new Error('User cancelled'));
            };
            
            // 表单提交处理
            const handleSubmit = (e) => {
                e.preventDefault();
                
                // 验证表单
                if (this.validateUserForm()) {
                    const info = {
                        name: document.getElementById('userName').value.trim(),
                        email: document.getElementById('userEmail').value.trim(),
                        phone: document.getElementById('userPhone').value.trim(),
                        notes: document.getElementById('userNotes').value.trim()
                    };
                    
                    closeModal();
                    resolve(info);
                }
            };
            
            // 绑定事件监听器
            closeBtn.onclick = handleCancel;
            cancelBtn.onclick = handleCancel;
            form.onsubmit = handleSubmit;
            
            // 点击模态框外部关闭
            modal.onclick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                }
            };
        });
    }

    // 验证用户信息表单
    validateUserForm() {
        const name = document.getElementById('userName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        let isValid = true;

        // 验证姓名
        if (!name) {
            this.showFormError('userName', 'nameError', this.getText('name-required'));
            isValid = false;
        } else {
            this.clearFormError('userName', 'nameError');
        }

        // 验证邮箱
        if (!email) {
            this.showFormError('userEmail', 'emailError', this.getText('email-required'));
            isValid = false;
        } else if (!this.isValidEmail(email)) {
            this.showFormError('userEmail', 'emailError', this.getText('email-invalid'));
            isValid = false;
        } else {
            this.clearFormError('userEmail', 'emailError');
        }

        return isValid;
    }

    // 显示表单错误
    showFormError(inputId, errorId, message) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        
        input.classList.add('error');
        input.classList.remove('valid');
        error.textContent = message;
        error.style.display = 'block';
    }

    // 清除单个字段错误
    clearFormError(inputId, errorId) {
        const input = document.getElementById(inputId);
        const error = document.getElementById(errorId);
        
        input.classList.remove('error');
        input.classList.add('valid');
        error.style.display = 'none';
    }

    // 清除所有表单错误
    clearFormErrors() {
        const inputs = ['userName', 'userEmail'];
        const errors = ['nameError', 'emailError'];
        
        inputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.classList.remove('error', 'valid');
            }
        });
        
        errors.forEach(errorId => {
            const error = document.getElementById(errorId);
            if (error) {
                error.style.display = 'none';
            }
        });
    }

    // 验证邮箱格式
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // 将dataURL转换为Blob对象
    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    // 生成高分辨率设计数据
    async generateHighResDesignData(customerInfo) {
        // 直接发送包含DOM元素的完整数据，确保后端获得准确信息
        const elementsWithDOM = {
            front: this.elements.front.map(el => {
                // 🔧 修复QR码在300DPI中消失的问题：检查元素是否有DOM element属性
                if (el.element && el.element.style) {
                    // 有DOM元素的情况（普通的text/image/shape元素）
                    return {
                        type: el.type,
                        element: {
                            // 提取DOM元素的关键属性
                            style: {
                                left: el.element.style.left,
                                top: el.element.style.top,
                                width: el.element.style.width,
                                height: el.element.style.height,
                                transform: el.element.style.transform,
                                fontSize: el.element.style.fontSize,
                                fontFamily: el.element.style.fontFamily,
                                color: el.element.style.color,
                                fontWeight: el.element.style.fontWeight,
                                fontStyle: el.element.style.fontStyle,
                                textAlign: el.element.style.textAlign,
                                opacity: el.element.style.opacity
                            },
                            textContent: el.element.textContent || el.element.innerText || '',
                            innerHTML: el.element.innerHTML,
                            className: el.element.className,
                            id: el.element.id
                        },
                        data: el.data || {},
                        isQRCode: el.isQRCode || false,
                        // 保留原有序列化数据作为备用
                        serializable: el.serializable || null
                    };
                } else if (el.isQRCode) {
                    // QR码元素的特殊处理（没有DOM element属性）
                    return {
                        type: el.type,
                        element: {
                            style: {
                                left: el.x + 'px',
                                top: el.y + 'px', 
                                width: el.width + 'px',
                                height: el.height + 'px',
                                transform: el.rotation ? `rotate(${el.rotation}deg)` : '',
                                opacity: el.opacity || '1'
                            },
                            className: 'qr-element',
                            id: el.id
                        },
                        data: {
                            src: el.src
                        },
                        isQRCode: true,
                        serializable: el
                    };
                } else {
                    // 备用处理：其他类型的元素
                    return {
                        type: el.type,
                        element: {
                            style: {},
                            className: '',
                            id: el.id || ''
                        },
                        data: el.data || {},
                        isQRCode: el.isQRCode || false,
                        serializable: el.serializable || el
                    };
                }
            }),
            back: this.elements.back.map(el => {
                // 🔧 修复QR码在300DPI中消失的问题：检查元素是否有DOM element属性
                if (el.element && el.element.style) {
                    // 有DOM元素的情况（普通的text/image/shape元素）
                    return {
                        type: el.type,
                        element: {
                            // 提取DOM元素的关键属性
                            style: {
                                left: el.element.style.left,
                                top: el.element.style.top,
                                width: el.element.style.width,
                                height: el.element.style.height,
                                transform: el.element.style.transform,
                                fontSize: el.element.style.fontSize,
                                fontFamily: el.element.style.fontFamily,
                                color: el.element.style.color,
                                fontWeight: el.element.style.fontWeight,
                                fontStyle: el.element.style.fontStyle,
                                textAlign: el.element.style.textAlign,
                                opacity: el.element.style.opacity
                            },
                            textContent: el.element.textContent || el.element.innerText || '',
                            innerHTML: el.element.innerHTML,
                            className: el.element.className,
                            id: el.element.id
                        },
                        data: el.data || {},
                        isQRCode: el.isQRCode || false,
                        // 保留原有序列化数据作为备用
                        serializable: el.serializable || null
                    };
                } else if (el.isQRCode) {
                    // QR码元素的特殊处理（没有DOM element属性）
                    return {
                        type: el.type,
                        element: {
                            style: {
                                left: el.x + 'px',
                                top: el.y + 'px', 
                                width: el.width + 'px',
                                height: el.height + 'px',
                                transform: el.rotation ? `rotate(${el.rotation}deg)` : '',
                                opacity: el.opacity || '1'
                            },
                            className: 'qr-element',
                            id: el.id
                        },
                        data: {
                            src: el.src
                        },
                        isQRCode: true,
                        serializable: el
                    };
                } else {
                    // 备用处理：其他类型的元素
                    return {
                        type: el.type,
                        element: {
                            style: {},
                            className: '',
                            id: el.id || ''
                        },
                        data: el.data || {},
                        isQRCode: el.isQRCode || false,
                        serializable: el.serializable || el
                    };
                }
            })
        };

        // 捕获包含模版的完整设计图
        console.log('正在捕获完整设计图...');
        const frontDesign = await this.captureCardDesign('front');
        const backDesign = await this.captureCardDesign('back');
        
        const designData = {
            material: this.currentMaterial,
            template: this.currentTemplate,
            elements: elementsWithDOM,
            customerInfo: customerInfo,
            timestamp: new Date().toISOString(),
            // 包含完整的设计图片（包含模版背景）
            frontDesign: {
                elementCount: elementsWithDOM.front.length,
                designImage: frontDesign // 包含模版的完整设计图
            },
            backDesign: {
                elementCount: elementsWithDOM.back.length,
                designImage: backDesign // 包含模版的完整设计图
            }
        };
        
        return designData;
    }

    // 捕获卡片设计的视觉数据
    async captureCardDesign(side) {
        const cardElement = document.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`);
        
        try {
            // 使用html2canvas库捕获卡片设计
            if (typeof html2canvas !== 'undefined') {
                // 🔧 修复镜像翻转和不完整捕获问题：
                // 1. 临时重置所有卡片的transform以确保正确捕获
                // 2. 确保目标卡片完全可见
                const allCards = document.querySelectorAll('.card');
                const originalTransforms = [];
                const originalZIndexes = [];
                const originalVisibility = [];
                
                // 保存原始状态并临时重置
                allCards.forEach((card, index) => {
                    originalTransforms[index] = card.style.transform;
                    originalZIndexes[index] = card.style.zIndex;
                    originalVisibility[index] = card.style.visibility;
                    
                    // 重置所有卡片到正常方向和可见状态
                    card.style.transform = 'rotateY(0deg)';
                    card.style.visibility = 'visible';
                    card.style.zIndex = index === 0 ? '10' : '5'; // 确保所有卡片可见
                });
                
                // 确保目标卡片在最前面且完全可见
                cardElement.style.zIndex = '20';
                cardElement.style.opacity = '1';
                cardElement.style.visibility = 'visible';
                
                console.log(`🎯 开始捕获${side}面设计，已重置所有card状态防止捕获问题`);
                
                // 等待一小段时间确保DOM更新完成
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const canvas = await html2canvas(cardElement, {
                    scale: 2, // 提高分辨率
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff', // 确保背景色
                    logging: false, // 减少控制台日志
                    onclone: (clonedDoc) => {
                        // 在克隆文档中也确保卡片可见
                        const clonedCard = clonedDoc.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`);
                        if (clonedCard) {
                            clonedCard.style.transform = 'rotateY(0deg)';
                            clonedCard.style.visibility = 'visible';
                            clonedCard.style.zIndex = '20';
                            clonedCard.style.opacity = '1';
                        }
                    }
                });
                
                // 恢复原始状态
                allCards.forEach((card, index) => {
                    card.style.transform = originalTransforms[index];
                    card.style.zIndex = originalZIndexes[index];
                    card.style.visibility = originalVisibility[index];
                });
                
                console.log(`🔄 已恢复${side}面卡片的原始状态`);
                
                // 压缩图片如果太大 - 更激进的压缩策略
                let quality = 0.5; // 从更低的质量开始
                let dataUrl = canvas.toDataURL('image/jpeg', quality);
                console.log(`🎨 ${side}面 - 初始图片大小: ${(dataUrl.length / 1024 / 1024).toFixed(2)}MB, 质量: ${quality}`);
                
                // 目标大小降低到2MB，确保总大小在合理范围内
                const targetSize = 2 * 1024 * 1024; // 2MB
                while (dataUrl.length > targetSize && quality > 0.1) {
                    quality -= 0.05; // 更小的步进
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                    console.log(`🔄 ${side}面 - 压缩质量到 ${quality.toFixed(2)}, 大小: ${(dataUrl.length / 1024 / 1024).toFixed(2)}MB`);
                }
                
                console.log(`✅ ${side}面 - 最终图片大小: ${(dataUrl.length / 1024 / 1024).toFixed(2)}MB, 质量: ${quality.toFixed(2)}`);
                
                return dataUrl;
            } else {
                // 降级方案：返回元素信息
                return {
                    elements: this.elements[side],
                    material: this.currentMaterial,
                    template: this.currentTemplate,
                    dimensions: {
                        width: cardElement.offsetWidth,
                        height: cardElement.offsetHeight
                    }
                };
            }
        } catch (error) {
            console.error(`捕获${side}面设计失败:`, error);
            return {
                elements: this.elements[side],
                material: this.currentMaterial,
                template: this.currentTemplate,
                error: error.message
            };
        }
    }

    // 发送设计数据到服务器
    async sendDesignToServer(designData) {
        const formData = new FormData();
        
        // 提取设计图片数据，作为文件发送
        const frontDesignImage = designData.frontDesign.designImage;
        const backDesignImage = designData.backDesign.designImage;
        
        // 创建设计数据副本，移除图片数据以减小JSON大小
        const designDataForJson = {
            ...designData,
            frontDesign: {
                elementCount: designData.frontDesign.elementCount
            },
            backDesign: {
                elementCount: designData.backDesign.elementCount
            }
        };
        
        formData.append('designData', JSON.stringify(designDataForJson));
        
        // 将设计图片作为文件添加到FormData
        if (frontDesignImage && typeof frontDesignImage === 'string' && frontDesignImage.startsWith('data:')) {
            const frontBlob = this.dataURLtoBlob(frontDesignImage);
            console.log(`📤 正面设计图 - 大小: ${(frontBlob.size / 1024 / 1024).toFixed(2)}MB`);
            formData.append('frontDesignImage', frontBlob, 'front_design.png');
        }
        
        if (backDesignImage && typeof backDesignImage === 'string' && backDesignImage.startsWith('data:')) {
            const backBlob = this.dataURLtoBlob(backDesignImage);
            console.log(`📤 背面设计图 - 大小: ${(backBlob.size / 1024 / 1024).toFixed(2)}MB`);
            formData.append('backDesignImage', backBlob, 'back_design.png');
        }
        
        // 计算总的FormData大小估算
        let totalSize = 0;
        const designDataStr = JSON.stringify(designDataForJson);
        totalSize += designDataStr.length;
        if (frontDesignImage) totalSize += this.dataURLtoBlob(frontDesignImage).size;
        if (backDesignImage) totalSize += this.dataURLtoBlob(backDesignImage).size;
        console.log(`📊 预估总上传大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`📋 设计数据JSON大小: ${(designDataStr.length / 1024).toFixed(2)}KB`);
        
        const response = await fetch(`${this.serverUrl}/api/submit-design`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            console.error(`❌ HTTP错误: ${response.status} ${response.statusText}`);
            const errorData = await response.json().catch(() => null);
            
            console.error('❌ 服务器错误响应:', errorData);
            
            if (errorData && errorData.code) {
                // 根据错误代码显示特定的错误消息
                switch (errorData.code) {
                    case 'FILE_TOO_LARGE':
                        throw new Error(this.currentLanguage === 'zh' ? 
                            '图片文件过大，请压缩后重试' : 
                            'Image file too large, please compress and try again');
                    case 'FIELD_TOO_LARGE':
                        throw new Error(this.currentLanguage === 'zh' ? 
                            '设计数据过大，请减少图片数量或压缩图片后重试' : 
                            'Design data too large, please reduce images or compress them');
                    case 'TOO_MANY_FILES':
                        throw new Error(this.currentLanguage === 'zh' ? 
                            '图片数量过多，一次最多上传10张图片' : 
                            'Too many images, maximum 10 images allowed');
                    default:
                        throw new Error(errorData.message || errorData.error);
                }
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
    }

    // Render elements from stored data (for undo/redo)
    renderElements() {
        try {
            // Clear all existing elements from both sides
            ['front', 'back'].forEach(side => {
                try {
                    const cardElement = document.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`);
                    if (!cardElement) {
                        throw new Error(`Card element not found for side: ${side}`);
                    }
                    
                    const content = cardElement.querySelector('.card-content');
                    if (!content) {
                        throw new Error(`Card content not found for side: ${side}`);
                    }
                    
                    const draggableElements = content.querySelectorAll('.draggable-element');
                    draggableElements.forEach(el => {
                        try {
                            el.remove();
                        } catch (removeError) {
                            console.warn('Error removing element:', removeError);
                        }
                    });
                    
                    // Show/hide drop-zone based on element count
                    const dropZone = content.querySelector('.drop-zone');
                    if (dropZone) {
                        const hasElements = this.elements[side] && this.elements[side].length > 0;
                        const isRestrictedBackSide = (this.isSemiCustomMode && side === 'back') ||
                                                     (this.currentMaterial === 'wood' && side === 'back') ||
                                                     (this.currentMaterial === 'metal' && side === 'back');
                        const shouldHideDropZone = isRestrictedBackSide ? false : hasElements;
                        dropZone.style.display = shouldHideDropZone ? 'none' : 'flex';
                    }
                } catch (sideError) {
                    this.errorHandler.handleError(sideError, `render elements - ${side} side`, false);
                }
            });

            // Re-create elements from stored data
            Object.keys(this.elements).forEach(side => {
                try {
                    const cardElement = document.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`);
                    if (!cardElement) return;
                    
                    const content = cardElement.querySelector('.card-content');
                    if (!content) return;
                    
                    if (this.elements[side] && Array.isArray(this.elements[side])) {
                        // 检查是否应该跳过背面元素渲染（半定制模式或木质/金属材质的背面）
                        const shouldSkipBackElements = (this.isSemiCustomMode && side === 'back') ||
                                                       (this.currentMaterial === 'wood' && side === 'back') ||
                                                       (this.currentMaterial === 'metal' && side === 'back');
                        
                        if (shouldSkipBackElements) {
                            // 半定制模式或限制材质下不渲染背面元素，但保留数据
                            const reason = this.isSemiCustomMode ? '半定制模式' : `${this.currentMaterial}材质限制`;
                            console.log(`跳过${reason}下的背面元素渲染 (${this.elements[side].length} 个元素被隐藏)`);
                            return;
                        }
                        
                        this.elements[side].forEach((elementData, index) => {
                            try {
                                if (elementData && elementData.serializable) {
                                    const recreatedElement = this.recreateElementFromData(elementData.serializable, content);
                                    if (recreatedElement) {
                                        // Update the element reference in the data
                                        elementData.element = recreatedElement;
                                    }
                                }
                            } catch (elementError) {
                                this.errorHandler.handleError(elementError, `recreate element ${index} on ${side}`, false);
                            }
                        });
                    }
                } catch (sideError) {
                    this.errorHandler.handleError(sideError, `recreate elements - ${side} side`, false);
                }
            });
            
        } catch (error) {
            this.errorHandler.handleError(error, 'render elements');
        }
    }

    // Recreate element from serialized data
    recreateElementFromData(data, container) {
        try {
            let element;
            
            switch (data.type) {
                case 'image':
                    element = this.recreateImageElement(data, container);
                    break;
                case 'text':
                    element = this.recreateTextElement(data, container);
                    break;
                case 'shape':
                    element = this.recreateShapeElement(data, container);
                    break;
                default:
                    throw new Error(`Unknown element type: ${data.type}`);
            }
            
            if (element) {
                // Apply position and transform
                if (data.position) {
                    Object.assign(element.style, data.position);
                }
                
                this.addDragHandles(element);
                container.appendChild(element);
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'recreate element from data');
        }
    }

    recreateImageElement(data, container) {
        const imageElement = document.createElement('div');
        imageElement.className = 'draggable-element image-element';
        imageElement.style.position = 'absolute';
        imageElement.style.cursor = 'move';
        
        const img = document.createElement('img');
        img.src = data.src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'fill';
        img.style.pointerEvents = 'none';
        
        // Apply material-specific filters if needed
        const shouldApplyFilter = this.restrictedMaterials.includes(this.currentMaterial) && 
                                !(this.currentMaterial === 'metal' && this.currentSide === 'back');
        
        if (shouldApplyFilter) {
            if (this.currentMaterial === 'wood') {
                img.style.filter = 'sepia(1) saturate(0.5) hue-rotate(15deg) brightness(0.8)';
            } else if (this.currentMaterial === 'metal') {
                img.style.filter = 'grayscale(1) contrast(1.5) brightness(0.7)';
            }
        }
        
        imageElement.appendChild(img);
        return imageElement;
    }

    recreateTextElement(data, container) {
        const textElement = document.createElement('div');
        textElement.className = 'draggable-element text-element';
        textElement.style.position = 'absolute';
        textElement.style.cursor = 'move';
        textElement.textContent = data.text;
        
        // Apply stored styles
        if (data.styles) {
            Object.assign(textElement.style, data.styles);
        }
        
        return textElement;
    }

    recreateShapeElement(data, container) {
        const shapeElement = document.createElement('div');
        shapeElement.className = 'draggable-element shape-element';
        shapeElement.style.position = 'absolute';
        shapeElement.style.cursor = 'move';
        
        const shapeContent = document.createElement('div');
        shapeContent.className = 'shape-content';
        
        // Apply shape styles
        if (data.properties) {
            this.applyShapeStyleToElement(shapeContent, data.shapeType, data.properties);
        }
        
        shapeElement.appendChild(shapeContent);
        return shapeElement;
    }

    // 重置设计
    resetDesign() {
        // 清空所有元素
        this.elements = { front: [], back: [] };
        
        // 清空画布
        ['front', 'back'].forEach(side => {
            const cardElement = document.getElementById(`card${side.charAt(0).toUpperCase() + side.slice(1)}`);
            const content = cardElement.querySelector('.card-content');
            const draggableElements = content.querySelectorAll('.draggable-element');
            draggableElements.forEach(el => el.remove());
            
            // 显示drop-zone
            const dropZone = content.querySelector('.drop-zone');
            if (dropZone) {
                dropZone.style.display = 'flex';
            }
        });
        
        // 取消选择
        this.deselectElement();
        
        // 重置到正面
        this.switchSide('front');
    }

    // Setup text modal functionality
    setupTextModal() {
        try {
            const modal = document.getElementById('textModal');
            const confirmBtn = document.getElementById('confirmText');
            const cancelBtn = document.getElementById('cancelText');
            
            if (!modal || !confirmBtn || !cancelBtn) {
                console.warn('Text modal elements not found');
                return;
            }
            
            confirmBtn.addEventListener('click', () => {
                this.confirmTextEdit();
            });
            
            cancelBtn.addEventListener('click', () => {
                this.cancelTextEdit();
            });
            
            // Close modal when clicking outside
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.cancelTextEdit();
                }
            });
            
        } catch (error) {
            this.errorHandler.handleError(error, 'setup text modal');
        }
    }

    // Setup delete element functionality
    setupDeleteElement() {
        try {
            const deleteBtn = document.getElementById('deleteBtn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    if (this.selectedElement) {
                        this.deleteElement(this.selectedElement);
                    }
                });
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'setup delete element');
        }
    }

    // Validate and repair application state
    validateAndRepairState() {
        try {
            // Validate history manager
            if (this.historyManager) {
                this.historyManager.validateState();
            }
            
            // Validate elements structure
            if (!this.elements) {
                this.elements = { front: [], back: [] };
            }
            
            ['front', 'back'].forEach(side => {
                if (!Array.isArray(this.elements[side])) {
                    this.elements[side] = [];
                }
                
                // Clean up invalid elements
                this.elements[side] = this.elements[side].filter(elementData => {
                    if (!elementData || typeof elementData !== 'object') {
                        return false;
                    }
                    
                    // Check if element still exists in DOM
                    if (elementData.element && !document.contains(elementData.element)) {
                        console.warn(`Removing orphaned element from ${side} side`);
                        return false;
                    }
                    
                    return true;
                });
            });
            
            // Validate current side
            if (!['front', 'back'].includes(this.currentSide)) {
                this.currentSide = 'front';
            }
            
            // Validate material renderer
            if (this.materialRenderer) {
                try {
                    this.materialRenderer.updateCanvasSize();
                } catch (rendererError) {
                    console.warn('Material renderer validation failed:', rendererError);
                }
            }
            
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, 'validate and repair state', false);
            return false;
        }
    }

    // Show text modal for adding/editing text
    showTextModal(element = null) {
        try {
            const modal = document.getElementById('textModal');
            const textInput = document.getElementById('textContent');
            const fontSelect = document.getElementById('fontFamily');
            const fontSizeInput = document.getElementById('fontSize');
            const colorInput = document.getElementById('textColor');
            
            if (!modal || !textInput) {
                throw new Error('Text modal elements not found');
            }
            
            this.editingTextElement = element;
            
            if (element) {
                // Editing existing text
                textInput.value = element.textContent || '';
                if (fontSelect) fontSelect.value = element.style.fontFamily || 'Arial';
                if (fontSizeInput) fontSizeInput.value = parseInt(element.style.fontSize) || 16;
                if (colorInput) colorInput.value = element.style.color || '#000000';
            } else {
                // Adding new text
                textInput.value = '';
                if (fontSelect) fontSelect.value = 'Arial';
                if (fontSizeInput) fontSizeInput.value = 16;
                if (colorInput) colorInput.value = '#000000';
            }
            
            modal.style.display = 'flex';
            textInput.focus();
            
        } catch (error) {
            this.errorHandler.handleError(error, 'show text modal');
        }
    }

    // Confirm text edit
    confirmTextEdit() {
        try {
            const textInput = document.getElementById('textContent');
            const fontSelect = document.getElementById('fontFamily');
            const fontSizeInput = document.getElementById('fontSize');
            const colorInput = document.getElementById('textColor');
            
            if (!textInput) {
                throw new Error('Text input not found');
            }
            
            const text = textInput.value.trim();
            if (!text) {
                const message = this.currentLanguage === 'zh' ? '请输入文字内容' : 'Please enter text content';
                // Notification removed as requested
                return;
            }
            
            const styles = {
                fontFamily: fontSelect ? fontSelect.value : 'Arial',
                fontSize: fontSizeInput ? fontSizeInput.value + 'px' : '16px',
                color: colorInput ? colorInput.value : '#000000',
                position: 'absolute',
                cursor: 'move',
                minWidth: '100px',
                minHeight: '30px',
                padding: '5px',
                userSelect: 'none'
            };
            
            if (this.editingTextElement) {
                // Update existing text element
                this.editingTextElement.textContent = text;
                Object.assign(this.editingTextElement.style, styles);
                
                // Update element data
                const elementData = this.elements[this.currentSide].find(el => el.element === this.editingTextElement);
                if (elementData) {
                    elementData.data = { text, styles };
                    elementData.serializable = {
                        type: 'text',
                        text: text,
                        styles: styles,
                        position: {
                            left: this.editingTextElement.style.left,
                            top: this.editingTextElement.style.top,
                            minWidth: this.editingTextElement.style.minWidth,
                            minHeight: this.editingTextElement.style.minHeight
                        }
                    };
                }
            } else {
                // Add new text element
                this.addTextElement(text, styles);
            }
            
            this.hideTextModal();
            
            // Record action for undo/redo
            if (this.historyManager) {
                this.historyManager.recordAction();
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'confirm text edit');
        }
    }

    // Cancel text edit
    cancelTextEdit() {
        this.hideTextModal();
    }

    // Hide text modal
    hideTextModal() {
        try {
            const modal = document.getElementById('textModal');
            if (modal) {
                modal.style.display = 'none';
            }
            this.editingTextElement = null;
        } catch (error) {
            this.errorHandler.handleError(error, 'hide text modal');
        }
    }

    // Edit existing text element
    editText(element) {
        this.showTextModal(element);
    }

    // Delete element with confirmation
    deleteElement(element) {
        try {
            if (!element) {
                throw new Error('No element provided for deletion');
            }
            
            const message = this.currentLanguage === 'zh' 
                ? '确定要删除这个元素吗？' 
                : 'Are you sure you want to delete this element?';
                
            if (confirm(message)) {
                // Remove from DOM
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                
                // Remove from elements array
                const elementIndex = this.elements[this.currentSide].findIndex(el => el.element === element);
                if (elementIndex !== -1) {
                    this.elements[this.currentSide].splice(elementIndex, 1);
                }
                
                // Show drop-zone if no elements left
                const currentCard = document.getElementById(`card${this.currentSide.charAt(0).toUpperCase() + this.currentSide.slice(1)}`);
                const content = currentCard.querySelector('.card-content');
                const dropZone = content.querySelector('.drop-zone');
                if (dropZone && this.elements[this.currentSide].length === 0) {
                    dropZone.style.display = 'flex';
                }
                
                // Deselect element
                this.deselectElement();
                
                // Record action for undo/redo
                if (this.historyManager) {
                    this.historyManager.recordAction();
                }
                
                const successMessage = this.currentLanguage === 'zh' ? '元素已删除' : 'Element deleted';
                this.errorHandler.showNotification(successMessage, 'success', 2000);
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'delete element');
        }
    }

    // Update shape color
    updateShapeColor(color) {
        try {
            if (!this.selectedElement || !this.selectedElement.classList.contains('shape-element')) {
                return;
            }
            
            const shapeContent = this.selectedElement.querySelector('.shape-content');
            if (shapeContent) {
                shapeContent.style.background = color;
                
                // Update element data
                const elementData = this.elements[this.currentSide].find(el => el.element === this.selectedElement);
                if (elementData && elementData.data && elementData.data.properties) {
                    elementData.data.properties.fillColor = color;
                    elementData.serializable.properties.fillColor = color;
                }
            }
            
        } catch (error) {
            this.errorHandler.handleError(error, 'update shape color');
        }
    }

    preview() {
        try {
            const previewWindow = window.open('', '_blank', 'width=800,height=600');
            
            if (!previewWindow) {
                throw new Error('Failed to open preview window - popup blocked?');
            }
            
            const previewHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>卡片预览</title>
                    <style>
                        body { margin: 0; padding: 20px; background: #f5f5f5; font-family: Microsoft YaHei; }
                        .preview-container { max-width: 800px; margin: 0 auto; }
                        .card-preview { margin: 20px 0; }
                        .card { width: 400px; height: 250px; margin: 0 auto; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
                        h2 { text-align: center; color: #333; }
                        .draggable-element { border: none !important; outline: none !important; }
                        .resize-handle, .rotate-handle { display: none !important; }
                    </style>
                </head>
                <body>
                    <div class="preview-container">
                        <h1>PVC卡片预览</h1>
                        <div class="card-preview">
                            <h2>正面</h2>
                            <div class="card">${document.getElementById('cardFront').innerHTML}</div>
                        </div>
                        <div class="card-preview">
                            <h2>背面</h2>
                            <div class="card">${document.getElementById('cardBack').innerHTML}</div>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            previewWindow.document.write(previewHTML);
            previewWindow.document.close();
            
        } catch (error) {
            this.errorHandler.handleError(error, 'preview');
        }
    }
}

// 初始化应用
let cardDesigner;

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing PVC Card Designer...');
        
        // Initialize the main application
        cardDesigner = new CardDesigner();
        
        // Bind save and preview buttons with error handling
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                try {
                    cardDesigner.submitDesign();
                } catch (error) {
                    console.error('Error in submit design:', error);
                    cardDesigner.errorHandler.handleError(error, 'submit design button');
                }
            });
        } else {
            console.warn('Save button not found');
        }

        // Preview按钮已移除，不需要相关功能
        
        // Export to global scope
        window.cardDesigner = cardDesigner;
        
        console.log('PVC Card Designer initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize PVC Card Designer:', error);
        
        // Show error message to user
        const errorMessage = document.createElement('div');
        errorMessage.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #f44336;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 14px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        `;
        errorMessage.textContent = 'Failed to initialize the card designer. Please refresh the page.';
        document.body.appendChild(errorMessage);
        
        // Auto-remove error message after 10 seconds
        setTimeout(() => {
            if (errorMessage.parentNode) {
                errorMessage.parentNode.removeChild(errorMessage);
            }
        }, 10000);
    }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.cardDesigner && window.cardDesigner.errorHandler) {
        window.cardDesigner.errorHandler.handleError(event.reason, 'unhandled promise rejection');
    }
});

// Handle global errors
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (window.cardDesigner && window.cardDesigner.errorHandler) {
        window.cardDesigner.errorHandler.handleError(event.error, 'global error');
    }
});

// Export global variable for HTML access
window.cardDesigner = cardDesigner;