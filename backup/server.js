const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const app = express();
const PORT = 3000;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// 创建存储目录
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DESIGNS_DIR = path.join(__dirname, 'designs');
const HIGH_RES_DIR = path.join(__dirname, 'high_res');

[UPLOAD_DIR, DESIGNS_DIR, HIGH_RES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// 配置文件上传
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB文件限制 (增加到50MB以支持完整设计图)
        fieldSize: 20 * 1024 * 1024, // 20MB字段限制 (增加到20MB)
        fields: 30, // 字段数限制 (增加字段数)
        files: 15 // 文件数限制 (增加文件数)
    }
});

// 静态文件服务 - 提供前端页面
app.use(express.static(__dirname));

// 根路径 - 显示前端设计界面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API信息路径
app.get('/api', (req, res) => {
    res.json({ 
        message: 'PVC Card Design Server is running',
        version: '1.0.0',
        endpoints: {
            'POST /api/submit-design': '提交设计数据',
            'GET /api/designs': '获取所有设计',
            'GET /api/designs/:id': '获取特定设计',
            'GET /health': '健康检查'
        }
    });
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// 图片处理中间件
function processImages(req, res, next) {
    if (req.files) {
        let totalFiles = 0;
        if (req.files.frontDesignImage) totalFiles += req.files.frontDesignImage.length;
        if (req.files.backDesignImage) totalFiles += req.files.backDesignImage.length;
        if (req.files.images) totalFiles += req.files.images.length;
        
        console.log(`接收到${totalFiles}个图片文件`);
        
        // 日志每个字段的文件
        if (req.files.frontDesignImage) {
            req.files.frontDesignImage.forEach(file => {
                console.log(`正面设计图: ${file.originalname}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            });
        }
        if (req.files.backDesignImage) {
            req.files.backDesignImage.forEach(file => {
                console.log(`背面设计图: ${file.originalname}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            });
        }
        if (req.files.images) {
            req.files.images.forEach(file => {
                console.log(`用户图片: ${file.originalname}, 大小: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
            });
        }
    }
    next();
}

// 主要设计数据提交端点
// 配置multer接受多种字段名
const uploadFields = upload.fields([
    { name: 'images', maxCount: 10 },          // 原有的用户上传图片
    { name: 'frontDesignImage', maxCount: 1 }, // 正面完整设计图
    { name: 'backDesignImage', maxCount: 1 }   // 背面完整设计图
]);

app.post('/api/submit-design', uploadFields, processImages, async (req, res) => {
    try {
        const { designData } = req.body;
        
        if (!designData) {
            return res.status(400).json({ error: '设计数据不能为空' });
        }

        const data = JSON.parse(designData);
        const timestamp = new Date().toISOString();
        const designId = `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 调试信息
        console.log('接收到的设计数据:');
        console.log('材质:', data.material);
        console.log('模板:', data.template);
        console.log('正面元素数量:', data.elements.front.length);
        console.log('背面元素数量:', data.elements.back.length);
        
        // 打印前几个元素的结构
        if (data.elements.front.length > 0) {
            console.log('第一个正面元素:', JSON.stringify(data.elements.front[0], null, 2));
        }

        // 处理完整设计图片文件 - req.files现在是对象，不是数组
        const designImages = {};
        let totalFileSize = 0;
        let totalFileCount = 0;
        
        if (req.files) {
            // 处理完整设计图
            if (req.files.frontDesignImage && req.files.frontDesignImage[0]) {
                const file = req.files.frontDesignImage[0];
                const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
                totalFileSize += file.size;
                totalFileCount++;
                designImages.front = file.filename;
                console.log(`✅ 保存正面完整设计图: ${file.filename} (${sizeInMB}MB)`);
            }
            
            if (req.files.backDesignImage && req.files.backDesignImage[0]) {
                const file = req.files.backDesignImage[0];
                const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
                totalFileSize += file.size;
                totalFileCount++;
                designImages.back = file.filename;
                console.log(`✅ 保存背面完整设计图: ${file.filename} (${sizeInMB}MB)`);
            }
            
            // 处理其他用户上传图片
            if (req.files.images && req.files.images.length > 0) {
                req.files.images.forEach(file => {
                    const sizeInMB = (file.size / 1024 / 1024).toFixed(2);
                    totalFileSize += file.size;
                    totalFileCount++;
                    console.log(`📎 用户上传图片: ${file.filename} (${sizeInMB}MB)`);
                });
            }
            
            console.log(`📁 总共接收到 ${totalFileCount} 个文件，总大小: ${(totalFileSize / 1024 / 1024).toFixed(2)}MB`);
        } else {
            console.log('📭 没有接收到文件');
        }

        // 保存原始设计数据
        const designInfo = {
            id: designId,
            timestamp: timestamp,
            material: data.material,
            template: data.template,
            elements: data.elements,
            uploadedImages: (req.files && req.files.images) ? req.files.images.map(file => file.filename) : [],
            frontDesign: data.frontDesign,
            backDesign: data.backDesign,
            customerInfo: data.customerInfo || null,
            // 新增：完整设计图片文件名
            completeDesignImages: designImages
        };

        // 保存设计数据到JSON文件
        const designPath = path.join(DESIGNS_DIR, `${designId}.json`);
        fs.writeFileSync(designPath, JSON.stringify(designInfo, null, 2));

        // 生成高分辨率图片
        console.log('开始生成高分辨率图片...');
        const highResImages = await generateHighResImages(data, designId);
        
        // 更新设计信息包含高分辨率图片路径
        designInfo.highResImages = highResImages;
        fs.writeFileSync(designPath, JSON.stringify(designInfo, null, 2));

        console.log(`新设计已保存: ${designId}`);
        console.log(`材质: ${data.material}, 模板: ${data.template}`);
        console.log(`正面元素: ${data.elements.front.length}, 背面元素: ${data.elements.back.length}`);
        if (designImages.front) console.log(`正面完整设计图: ${designImages.front}`);
        if (designImages.back) console.log(`背面完整设计图: ${designImages.back}`);

        res.json({
            success: true,
            designId: designId,
            message: '设计数据已成功保存',
            highResImages: highResImages,
            completeDesignImages: designImages
        });

    } catch (error) {
        console.error('保存设计数据时发生错误:', error);
        console.error('错误堆栈:', error.stack);
        res.status(500).json({ 
            error: '保存设计数据失败',
            details: error.message 
        });
    }
});

// 获取所有设计列表
app.get('/api/designs', (req, res) => {
    try {
        const designs = [];
        const files = fs.readdirSync(DESIGNS_DIR);
        
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const designData = JSON.parse(fs.readFileSync(path.join(DESIGNS_DIR, file), 'utf8'));
                designs.push({
                    id: designData.id,
                    timestamp: designData.timestamp,
                    material: designData.material,
                    template: designData.template,
                    elementCount: {
                        front: designData.elements.front.length,
                        back: designData.elements.back.length
                    }
                });
            }
        });

        res.json({
            success: true,
            count: designs.length,
            designs: designs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        });

    } catch (error) {
        console.error('获取设计列表时发生错误:', error);
        res.status(500).json({ 
            error: '获取设计列表失败',
            details: error.message 
        });
    }
});

// 获取特定设计详情
app.get('/api/designs/:id', (req, res) => {
    try {
        const designId = req.params.id;
        const designPath = path.join(DESIGNS_DIR, `${designId}.json`);
        
        if (!fs.existsSync(designPath)) {
            return res.status(404).json({ error: '设计不存在' });
        }
        
        const designData = JSON.parse(fs.readFileSync(designPath, 'utf8'));
        res.json({
            success: true,
            design: designData
        });

    } catch (error) {
        console.error('获取设计详情时发生错误:', error);
        res.status(500).json({ 
            error: '获取设计详情失败',
            details: error.message 
        });
    }
});

// 批量下载设计数据
app.get('/api/export/designs', (req, res) => {
    try {
        const designs = [];
        const files = fs.readdirSync(DESIGNS_DIR);
        
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const designData = JSON.parse(fs.readFileSync(path.join(DESIGNS_DIR, file), 'utf8'));
                designs.push(designData);
            }
        });

        const exportData = {
            exportTime: new Date().toISOString(),
            totalDesigns: designs.length,
            designs: designs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="all_designs_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);

    } catch (error) {
        console.error('导出设计数据时发生错误:', error);
        res.status(500).json({ 
            error: '导出设计数据失败',
            details: error.message 
        });
    }
});

// 获取存储统计信息
app.get('/api/stats', (req, res) => {
    try {
        const designs = [];
        const files = fs.readdirSync(DESIGNS_DIR);
        
        files.forEach(file => {
            if (file.endsWith('.json')) {
                const designData = JSON.parse(fs.readFileSync(path.join(DESIGNS_DIR, file), 'utf8'));
                designs.push(designData);
            }
        });

        // 计算存储使用情况
        const getDirectorySize = (dir) => {
            if (!fs.existsSync(dir)) return 0;
            const files = fs.readdirSync(dir);
            return files.reduce((total, file) => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);
                return total + stats.size;
            }, 0);
        };

        const uploadsSize = getDirectorySize(UPLOAD_DIR);
        const designsSize = getDirectorySize(DESIGNS_DIR);
        const highResSize = getDirectorySize(HIGH_RES_DIR);
        const totalSize = uploadsSize + designsSize + highResSize;

        // 今日新增设计
        const today = new Date().toISOString().split('T')[0];
        const todayDesigns = designs.filter(design => 
            design.timestamp.split('T')[0] === today
        ).length;

        // 计算总图片数量
        const totalImages = designs.reduce((sum, design) => {
            const elements = design.elements || { front: [], back: [] };
            return sum + elements.front.length + elements.back.length;
        }, 0);

        res.json({
            success: true,
            stats: {
                totalDesigns: designs.length,
                todayDesigns: todayDesigns,
                totalImages: totalImages,
                storage: {
                    uploads: uploadsSize,
                    designs: designsSize,
                    highRes: highResSize,
                    total: totalSize,
                    totalFormatted: this.formatBytes(totalSize)
                }
            }
        });

    } catch (error) {
        console.error('获取统计信息时发生错误:', error);
        res.status(500).json({ 
            error: '获取统计信息失败',
            details: error.message 
        });
    }
});

// 格式化字节大小
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// 生成300DPI高分辨率图片
async function generateHighResImages(designData, designId) {
    const DPI = 300;
    const CARD_WIDTH_MM = 85.6; // 标准名片宽度
    const CARD_HEIGHT_MM = 53.98; // 标准名片高度
    
    // 计算300DPI下的像素尺寸
    const MM_TO_INCH = 1 / 25.4;
    const width = Math.round(CARD_WIDTH_MM * MM_TO_INCH * DPI);
    const height = Math.round(CARD_HEIGHT_MM * MM_TO_INCH * DPI);
    
    console.log(`生成高分辨率图片: ${width}x${height} 像素 (300 DPI)`);
    
    const highResImages = {};
    
    // 为正面和背面分别生成图片
    for (const side of ['front', 'back']) {
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        // 设置背景色
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        
        // 应用材质背景
        await applyMaterialBackground(ctx, designData.material, side, width, height);
        
        // 应用模板效果
        await applyTemplateEffect(ctx, designData.template, side, width, height);
        
        // 渲染所有元素
        const elements = designData.elements[side] || [];
        
        // 🔧 修复图片元素覆盖其他元素的问题：按z-index排序元素以确保正确的渲染顺序
        const sortedElements = elements.slice().sort((a, b) => {
            // 获取z-index值，默认为0
            let aZIndex = 0;
            let bZIndex = 0;
            
            // 从DOM样式中获取z-index
            if (a.element && a.element.style && a.element.style.zIndex) {
                aZIndex = parseInt(a.element.style.zIndex) || 0;
            }
            if (b.element && b.element.style && b.element.style.zIndex) {
                bZIndex = parseInt(b.element.style.zIndex) || 0;
            }
            
            // QR码元素应该有最高优先级（如果没有明确设置z-index）
            if (a.isQRCode && aZIndex === 0) aZIndex = 9999;
            if (b.isQRCode && bZIndex === 0) bZIndex = 9999;
            
            return aZIndex - bZIndex; // 从低到高渲染，确保高z-index在上层
        });
        
        console.log(`🎯 渲染${side}面的${sortedElements.length}个元素 (已按z-index排序)`);
        
        for (const element of sortedElements) {
            await renderElement(ctx, element, width, height);
        }
        
        // 保存图片
        const fileName = `${designId}_${side}_300dpi.png`;
        const filePath = path.join(HIGH_RES_DIR, fileName);
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filePath, buffer);
        
        highResImages[side] = fileName;
        
        console.log(`${side}面高分辨率图片已生成: ${fileName}`);
    }
    
    return highResImages;
}

// 应用材质背景
async function applyMaterialBackground(ctx, material, side, width, height) {
    switch (material) {
        case 'pvc':
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
            break;
        case 'wood':
            // 木质纹理效果
            ctx.fillStyle = '#d4a574';
            ctx.fillRect(0, 0, width, height);
            // 添加木纹效果
            ctx.strokeStyle = '#8b6914';
            ctx.lineWidth = 2;
            for (let i = 0; i < height; i += 20) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(width, i + (Math.random() - 0.5) * 10);
                ctx.stroke();
            }
            break;
        case 'metal':
            // 金属材质使用模板背景图片
            const metalImagePath = side === 'front' 
                ? path.join(__dirname, 'PVC_templates', 'Blank_template', 'Metal.jpg')
                : path.join(__dirname, 'PVC_templates', 'Blank_template', 'Metal_back.jpg');
            
            try {
                console.log(`🏗️ 加载金属材质背景: ${metalImagePath}`);
                const metalImage = await loadImage(metalImagePath);
                ctx.drawImage(metalImage, 0, 0, width, height);
                console.log(`✅ 金属材质背景已应用: ${side}面`);
            } catch (error) {
                console.error(`❌ 金属材质背景加载失败: ${metalImagePath}`, error.message);
                // 降级处理：应用金属渐变效果
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                gradient.addColorStop(0, '#c0c0c0');
                gradient.addColorStop(0.5, '#e6e6e6');
                gradient.addColorStop(1, '#b0b0b0');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
            }
            break;
    }
}

// 应用模板效果
async function applyTemplateEffect(ctx, template, side, width, height) {
    switch (template) {
        case 'blue':
        case 'pink':
            // 加载半定制模板背景图片
            let templateImagePath;
            if (side === 'back') {
                // 背面使用压缩版本（包含QR码）
                templateImagePath = path.join(__dirname, 'PVC_templates', `${template.charAt(0).toUpperCase() + template.slice(1)}_${side}_compressed.jpg`);
            } else {
                // 正面使用原来的路径
                templateImagePath = path.join(__dirname, 'PVC_templates', 'Blank_template', `${template.charAt(0).toUpperCase() + template.slice(1)}_${side}.jpg`);
            }
            try {
                console.log(`🎨 加载模板背景图片: ${templateImagePath}`);
                const templateImage = await loadImage(templateImagePath);
                ctx.drawImage(templateImage, 0, 0, width, height);
                console.log(`✅ 模板背景已应用: ${template}_${side}`);
            } catch (error) {
                console.error(`❌ 模板背景加载失败: ${templateImagePath}`, error.message);
                // 降级处理：应用纯色背景
                ctx.fillStyle = template === 'blue' ? '#e3f2fd' : '#fce4ec';
                ctx.fillRect(0, 0, width, height);
            }
            break;
        case 'business':
            const businessGradient = ctx.createLinearGradient(0, 0, width, height);
            businessGradient.addColorStop(0, 'rgba(102, 126, 234, 0.1)');
            businessGradient.addColorStop(1, 'rgba(118, 75, 162, 0.1)');
            ctx.fillStyle = businessGradient;
            ctx.fillRect(0, 0, width, height);
            break;
        case 'creative':
            const creativeGradient = ctx.createLinearGradient(0, 0, width, height);
            creativeGradient.addColorStop(0, 'rgba(240, 147, 251, 0.1)');
            creativeGradient.addColorStop(1, 'rgba(245, 87, 108, 0.1)');
            ctx.fillStyle = creativeGradient;
            ctx.fillRect(0, 0, width, height);
            break;
        case 'minimal':
            const minimalGradient = ctx.createLinearGradient(0, 0, width, height);
            minimalGradient.addColorStop(0, 'rgba(79, 172, 254, 0.1)');
            minimalGradient.addColorStop(1, 'rgba(0, 242, 254, 0.1)');
            ctx.fillStyle = minimalGradient;
            ctx.fillRect(0, 0, width, height);
            break;
        default:
            console.log(`📄 模板 "${template}" 无特殊效果`);
    }
}

// 渲染单个元素
async function renderElement(ctx, elementData, canvasWidth, canvasHeight) {
    const type = elementData.type;
    
    // 前端画布实际尺寸是500x316px
    const FRONTEND_WIDTH = 500;
    const FRONTEND_HEIGHT = 316;
    
    // 计算正确的缩放比例
    const scaleX = canvasWidth / FRONTEND_WIDTH;
    const scaleY = canvasHeight / FRONTEND_HEIGHT;
    
    // 从DOM元素样式中获取位置信息（前端现在发送包含DOM元素的完整数据）
    let x, y, width, height;
    
    if (elementData.element && elementData.element.style) {
        // 从DOM样式中获取准确的位置和尺寸
        x = (parseFloat(elementData.element.style.left) || 0) * scaleX;
        y = (parseFloat(elementData.element.style.top) || 0) * scaleY;
        width = (parseFloat(elementData.element.style.width) || 100) * scaleX;
        height = (parseFloat(elementData.element.style.height) || 100) * scaleY;
    } else if (elementData.position) {
        // 备用：从位置数据获取
        x = (parseFloat(elementData.position.left) || 0) * scaleX;
        y = (parseFloat(elementData.position.top) || 0) * scaleY;
        width = (parseFloat(elementData.position.width) || parseFloat(elementData.position.minWidth) || 100) * scaleX;
        height = (parseFloat(elementData.position.height) || parseFloat(elementData.position.minHeight) || 100) * scaleY;
    } else {
        // 默认值
        x = y = 0;
        width = 100 * scaleX;
        height = 100 * scaleY;
    }
    
    console.log(`🎯 渲染${type}元素: 位置(${x.toFixed(1)}, ${y.toFixed(1)}) 尺寸(${width.toFixed(1)} x ${height.toFixed(1)})`);
    
    ctx.save();
    
    // 应用变换（旋转）
    let rotation = 0;
    if (elementData.element && elementData.element.style && elementData.element.style.transform) {
        const match = elementData.element.style.transform.match(/rotate\((.+?)deg\)/);
        if (match) {
            rotation = parseFloat(match[1]);
        }
    }
    
    if (rotation !== 0) {
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.translate(-width / 2, -height / 2);
    } else {
        ctx.translate(x, y);
    }
    
    switch (type) {
        case 'text':
            await renderTextElement(ctx, elementData, width, height, scaleX);
            break;
        case 'image':
            await renderImageElement(ctx, elementData, width, height);
            break;
        case 'shape':
            await renderShapeElement(ctx, elementData, width, height);
            break;
    }
    
    ctx.restore();
}

// 渲染文本元素
async function renderTextElement(ctx, elementData, width, height, scale) {
    // 获取文本内容和样式
    let text = '';
    let styles = {};
    
    // 优先从DOM元素中获取最准确的数据
    if (elementData.element) {
        // 从DOM元素中获取用户看到的实际文本内容
        text = elementData.element.textContent || '';
        // 从DOM样式中获取最终的样式信息
        const domStyle = elementData.element.style;
        styles = {
            fontSize: domStyle.fontSize,
            fontFamily: domStyle.fontFamily,
            color: domStyle.color,
            fontWeight: domStyle.fontWeight,
            fontStyle: domStyle.fontStyle,
            textAlign: domStyle.textAlign
        };
    } else if (elementData.data) {
        // 备用：从数据对象获取
        text = elementData.data.text || '';
        styles = elementData.data.styles || {};
    } else if (elementData.serializable) {
        // 最后备用：从序列化数据获取
        text = elementData.serializable.text || '';
        styles = elementData.serializable.styles || {};
    }
    
    console.log(`📝 渲染文本: "${text}" 样式:`, styles);
    
    const fontSize = (parseFloat(styles.fontSize) || 16) * scale;
    const fontFamily = styles.fontFamily || 'Arial';
    const color = styles.color || '#000000';
    const fontWeight = styles.fontWeight || 'normal';
    const fontStyle = styles.fontStyle || 'normal';
    const textAlign = styles.textAlign || 'left';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    ctx.fillStyle = color;
    ctx.textAlign = textAlign;
    
    const lines = text.split('\n');
    const lineHeight = fontSize * 1.2;
    
    lines.forEach((line, index) => {
        let x = 0;
        if (textAlign === 'center') x = width / 2;
        if (textAlign === 'right') x = width;
        
        ctx.fillText(line, x, (index + 1) * lineHeight);
    });
}

// 渲染图片元素
async function renderImageElement(ctx, elementData, width, height) {
    try {
        let imageSrc = null;
        
        // 优先从DOM元素和data中获取图片源
        if (elementData.data && elementData.data.src) {
            imageSrc = elementData.data.src;
        } else if (elementData.element && elementData.element.innerHTML) {
            // 从DOM元素的innerHTML中提取img src
            const imgMatch = elementData.element.innerHTML.match(/src="([^"]+)"/);
            if (imgMatch) {
                imageSrc = imgMatch[1];
            }
        } else if (elementData.serializable && elementData.serializable.src) {
            imageSrc = elementData.serializable.src;
        } else if (elementData.src) {
            imageSrc = elementData.src;
        }
        
        console.log(`🖼️ 渲染图片元素: 找到图片源 ${imageSrc ? '✅' : '❌'}`);
        
        if (imageSrc) {
            // 如果是base64数据
            if (imageSrc.startsWith('data:')) {
                const base64Data = imageSrc.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const img = await loadImage(buffer);
                ctx.drawImage(img, 0, 0, width, height);
                console.log(`✅ 成功渲染图片元素: ${width}x${height}`);
            } else if (elementData.isQRCode || (elementData.element && elementData.element.className && elementData.element.className.includes('qr-element'))) {
                // 🔧 修复QR码在300DPI中消失的问题：特殊处理QR码文件路径
                const qrImagePath = path.join(__dirname, imageSrc);
                try {
                    console.log(`🔍 尝试加载QR码图片: ${qrImagePath}`);
                    const qrImg = await loadImage(qrImagePath);
                    ctx.drawImage(qrImg, 0, 0, width, height);
                    console.log(`✅ 成功渲染QR码元素: ${width}x${height}`);
                } catch (qrError) {
                    console.error(`❌ QR码图片加载失败: ${qrImagePath}`, qrError.message);
                    // 绘制QR码占位符
                    ctx.fillStyle = '#f0f0f0';
                    ctx.fillRect(0, 0, width, height);
                    ctx.strokeStyle = '#333';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(0, 0, width, height);
                    ctx.fillStyle = '#333';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText('QR', width / 2, height / 2);
                }
            } else {
                console.log(`⚠️ 非base64图片源，跳过: ${imageSrc.substring(0, 50)}...`);
            }
        } else {
            console.log(`⚠️ 未找到图片源数据`);
        }
    } catch (error) {
        console.error('渲染图片时发生错误:', error);
        // 绘制占位符
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#666666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Image Error', width / 2, height / 2);
    }
}

// 渲染形状元素
async function renderShapeElement(ctx, elementData, width, height) {
    const shapeType = elementData.shapeType;
    const properties = elementData.properties;
    
    ctx.beginPath();
    
    if (shapeType === 'circle') {
        const radius = Math.min(width, height) / 2;
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    } else {
        // 矩形
        ctx.rect(0, 0, width, height);
    }
    
    // 填充
    if (properties.enableFill) {
        ctx.fillStyle = properties.fillColor;
        ctx.fill();
    }
    
    // 描边
    if (properties.enableStroke) {
        ctx.strokeStyle = properties.strokeColor;
        ctx.lineWidth = properties.strokeWidth;
        ctx.stroke();
    }
}

// 静态文件服务
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/designs', express.static(DESIGNS_DIR));
app.use('/high-res', express.static(HIGH_RES_DIR));

// 图片大小错误处理中间件
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({
                error: '图片文件过大',
                message: '单个图片文件大小不能超过50MB，请压缩后重试',
                details: `文件大小超过限制: ${(err.field ? err.field : '未知文件')}`,
                code: 'FILE_TOO_LARGE'
            });
        }
        if (err.code === 'LIMIT_FIELD_VALUE') {
            return res.status(413).json({
                error: '数据字段过大',
                message: '设计数据过大，请减少图片数量或压缩图片后重试',
                details: `字段过大: ${err.field}`,
                code: 'FIELD_TOO_LARGE'
            });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(413).json({
                error: '文件数量过多',
                message: '一次最多只能上传10个文件',
                details: '文件数量超过限制',
                code: 'TOO_MANY_FILES'
            });
        }
        
        return res.status(400).json({
            error: '文件上传错误',
            message: '文件上传失败，请检查文件格式和大小',
            details: err.message,
            code: err.code
        });
    }
    
    console.error('服务器错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        details: err.message
    });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 PVC卡片设计服务器已启动`);
    console.log(`📡 服务器地址: http://0.0.0.0:${PORT}`);
    console.log(`🌍 外部访问地址: http://13.214.160.245:${PORT}`);
    console.log(`📁 文件存储目录:`);
    console.log(`   - 上传文件: ${UPLOAD_DIR}`);
    console.log(`   - 设计数据: ${DESIGNS_DIR}`);
    console.log(`   - 高分辨率图片: ${HIGH_RES_DIR}`);
    console.log(`\n✅ 服务器运行正常，等待接收设计数据...`);
});