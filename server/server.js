const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { registerAIRoutes } = require('./ai');
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

// 注册 AI 路由模块
registerAIRoutes(app);

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

        const uploadedImages = (req.files && req.files.images) ? req.files.images : [];
        const uploadedImageFilenames = [];
        const originalUploadedImageSet = new Set();
        const placeholderProtocol = 'uploaded://';
        const keyToFilename = {};
        const savedBase64Map = new Map();

        const recordUploadedFilename = (filename, contextKey = 'generic', options = {}) => {
            if (!filename) return;
            if (!uploadedImageFilenames.includes(filename)) {
                uploadedImageFilenames.push(filename);
            }
            const ctx = String(contextKey || '').toLowerCase();
            const explicitFlag = Object.prototype.hasOwnProperty.call(options, 'isOriginalUpload') ? options.isOriginalUpload : null;
            const shouldMarkOriginal = explicitFlag !== null ? explicitFlag : (ctx.includes('original') || ctx.includes('file-upload'));
            if (shouldMarkOriginal) {
                originalUploadedImageSet.add(filename);
            }
        };

        if (Array.isArray(uploadedImages)) {
            uploadedImages.forEach(file => {
                if (!file || !file.originalname) return;
                const originalBase = path.basename(file.originalname, path.extname(file.originalname));
                keyToFilename[originalBase] = file.filename;
                recordUploadedFilename(file.filename, 'file-upload', { isOriginalUpload: true });
            });
            if (Object.keys(keyToFilename).length > 0) {
                console.log('🧾 图片占位符映射:', keyToFilename);
            }
        }

        const ensureImageReference = (value, contextKey = 'image') => {
            if (typeof value !== 'string' || !value.startsWith(placeholderProtocol)) {
                if (typeof value === 'string' && value.startsWith('data:image/')) {
                    return persistBase64Image(value, contextKey);
                }
                return value;
            }
            const key = value.slice(placeholderProtocol.length);
            const filename = keyToFilename[key];
            if (filename) {
                recordUploadedFilename(filename, contextKey);
                return `/uploads/${filename}`;
            }
            return value;
        };

        const persistBase64Image = (dataUrl, contextKey = 'image') => {
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
                return dataUrl;
            }

            if (savedBase64Map.has(dataUrl)) {
                const existingFilename = savedBase64Map.get(dataUrl);
                recordUploadedFilename(existingFilename, contextKey);
                return `/uploads/${existingFilename}`;
            }

            const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (!match) {
                return dataUrl;
            }

            const mimeExt = match[1].toLowerCase();
            const ext = mimeExt === 'jpeg' ? 'jpg' : mimeExt;
            const buffer = Buffer.from(match[2], 'base64');
            const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
            const safeContext = contextKey.replace(/[^a-z0-9_-]/gi, '-').slice(0, 32) || 'img';
            const filename = `${designId}_${safeContext}_${hash}.${ext}`;
            const filePath = path.join(UPLOAD_DIR, filename);

            try {
                fs.writeFileSync(filePath, buffer);
                console.log(`✅ 从Base64持久化图片: ${filename}`);
                savedBase64Map.set(dataUrl, filename);
                recordUploadedFilename(filename, contextKey);
                return `/uploads/${filename}`;
            } catch (persistError) {
                console.error('❌ 保存Base64图片失败:', persistError.message);
                return dataUrl;
            }
        };

        const replaceInnerHtmlSources = (element, side) => {
            if (!element || typeof element.innerHTML !== 'string') {
                return;
            }

            element.innerHTML = element.innerHTML
                .replace(/src=["'](data:image\/[^"']+)["']/g, (match, base64) => {
                    const replaced = persistBase64Image(base64, `${side}_innerhtml`);
                    if (typeof replaced === 'string' && replaced.startsWith('/uploads/')) {
                        return `src="${replaced}"`;
                    }
                    return match;
                })
                .replace(/<img([^>]*?)data-upload-key="([^"]+)"([^>]*)>/g, (match, before, key, after) => {
                    const filename = keyToFilename[key];
                    if (filename) {
                        recordUploadedFilename(filename, `${side}_innerhtml`);
                        return `<img${before}src="/uploads/${filename}" data-upload-key="${key}"${after}>`;
                    }
                    return match;
                });
        };

        const normalizeImageElements = (elements = [], side = 'front') => {
            if (!Array.isArray(elements)) return;
            elements.forEach(element => {
                if (!element || typeof element !== 'object') return;
                if (element.type !== 'image' || element.isQRCode) return;

                if (element.data && typeof element.data === 'object') {
                    if (typeof element.data.src === 'string') {
                        element.data.src = ensureImageReference(element.data.src, `${side}_data_src`);
                    }
                    if (typeof element.data.originalSrc === 'string') {
                        element.data.originalSrc = ensureImageReference(element.data.originalSrc, `${side}_data_original`);
                    }
                    if (typeof element.data.cropOriginalSrc === 'string') {
                        element.data.cropOriginalSrc = ensureImageReference(element.data.cropOriginalSrc, `${side}_data_crop_original`);
                    }
                }

                if (element.serializable && typeof element.serializable === 'object') {
                    if (typeof element.serializable.src === 'string') {
                        element.serializable.src = ensureImageReference(element.serializable.src, `${side}_serializable_src`);
                    }
                    if (typeof element.serializable.originalSrc === 'string') {
                        element.serializable.originalSrc = ensureImageReference(element.serializable.originalSrc, `${side}_serializable_original`);
                    }
                    if (typeof element.serializable.cropOriginalSrc === 'string') {
                        element.serializable.cropOriginalSrc = ensureImageReference(element.serializable.cropOriginalSrc, `${side}_serializable_crop_original`);
                    }
                }

                if (element.element && typeof element.element.innerHTML === 'string') {
                    replaceInnerHtmlSources(element.element, side);
                }
            });
        };

        if (data && data.elements) {
            normalizeImageElements(data.elements.front, 'front');
            normalizeImageElements(data.elements.back, 'back');
        }

        if (data && data.imageUploadMappings) {
            delete data.imageUploadMappings;
        }

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
        
        // 🔧 检查QR码元素调试信息
        const frontQRElements = data.elements.front.filter(el => el.isQRCode);
        const backQRElements = data.elements.back.filter(el => el.isQRCode);
        console.log(`🔍 QR码调试: 正面${frontQRElements.length}个, 背面${backQRElements.length}个`);
        if (frontQRElements.length > 0) {
            console.log('正面QR码元素:', JSON.stringify(frontQRElements[0], null, 2));
        }
        if (backQRElements.length > 0) {
            console.log('背面QR码元素:', JSON.stringify(backQRElements[0], null, 2));
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
            uploadedImages: uploadedImageFilenames,
            originalUploadedImages: Array.from(originalUploadedImageSet),
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

// 下载完整设计包（包含用户原图）
app.get('/api/designs/:id/download-complete', async (req, res) => {
    try {
        const designId = req.params.id;
        const designPath = path.join(DESIGNS_DIR, `${designId}.json`);
        
        if (!fs.existsSync(designPath)) {
            return res.status(404).json({ success: false, error: '设计不存在' });
        }
        
        const design = JSON.parse(fs.readFileSync(designPath, 'utf8'));
        console.log(`🎁 开始打包完整设计: ${designId}`);
        
        // 创建临时目录
        const tempDir = path.join(__dirname, 'temp', designId);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const saveDataUrlToFile = (dataUrl, destDir, filenameBase) => {
            if (!dataUrl || typeof dataUrl !== 'string') return null;
            const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
            if (!match) return null;
            const ext = match[1].toLowerCase().replace('jpeg', 'jpg');
            const buffer = Buffer.from(match[2], 'base64');
            const safeName = `${filenameBase}.${ext}`;
            const destPath = path.join(destDir, safeName);
            fs.writeFileSync(destPath, buffer);
            return safeName;
        };
        
        // 1. 复制设计数据JSON
        const designJsonPath = path.join(tempDir, `${designId}_data.json`);
        fs.copyFileSync(designPath, designJsonPath);
        
        // 仅拷贝通过表单上传并保存到 uploads/ 的原始文件（不包含完整设计图）
        const originalImagesDir = path.join(tempDir, 'original_images');
        if (!fs.existsSync(originalImagesDir)) {
            fs.mkdirSync(originalImagesDir);
        }
        let imageCount = 0;
        const originalImageList = Array.isArray(design.originalUploadedImages) && design.originalUploadedImages.length > 0
            ? design.originalUploadedImages
            : design.uploadedImages;

        if (originalImageList && Array.isArray(originalImageList)) {
            originalImageList.forEach(filename => {
                try {
                    const srcPath = path.join(UPLOAD_DIR, filename);
                    if (fs.existsSync(srcPath)) {
                        fs.copyFileSync(srcPath, path.join(originalImagesDir, filename));
                        imageCount++;
                        console.log(`✅ 复制用户上传原图: ${filename}`);
                    } else {
                        console.warn(`⚠️ 找不到上传原图文件: ${filename}`);
                    }
                } catch (err) {
                    console.error(`❌ 复制上传原图失败: ${filename} ->`, err.message);
                }
            });
        }
        console.log(`📎 用户原图数量: ${imageCount}`);
        
        // 3. 复制300DPI生成图片
        const highResDir = path.join(tempDir, 'print_ready_300dpi');
        if (!fs.existsSync(highResDir)) {
            fs.mkdirSync(highResDir);
        }
        
        if (design.highResImages) {
            if (design.highResImages.front) {
                const frontPath = path.join(HIGH_RES_DIR, design.highResImages.front);
                if (fs.existsSync(frontPath)) {
                    fs.copyFileSync(frontPath, path.join(highResDir, design.highResImages.front));
                    console.log(`✅ 复制300DPI正面图: ${design.highResImages.front}`);
                }
            }
            if (design.highResImages.back) {
                const backPath = path.join(HIGH_RES_DIR, design.highResImages.back);
                if (fs.existsSync(backPath)) {
                    fs.copyFileSync(backPath, path.join(highResDir, design.highResImages.back));
                    console.log(`✅ 复制300DPI背面图: ${design.highResImages.back}`);
                }
            }
        }
        
        // 4. 复制完整设计预览图
        const previewDir = path.join(tempDir, 'preview_images');
        if (!fs.existsSync(previewDir)) {
            fs.mkdirSync(previewDir);
        }
        
        if (design.completeDesignImages) {
            if (design.completeDesignImages.front) {
                const frontPreviewPath = path.join(UPLOAD_DIR, design.completeDesignImages.front);
                if (fs.existsSync(frontPreviewPath)) {
                    fs.copyFileSync(frontPreviewPath, path.join(previewDir, design.completeDesignImages.front));
                    console.log(`✅ 复制正面预览图: ${design.completeDesignImages.front}`);
                }
            }
            if (design.completeDesignImages.back) {
                const backPreviewPath = path.join(UPLOAD_DIR, design.completeDesignImages.back);
                if (fs.existsSync(backPreviewPath)) {
                    fs.copyFileSync(backPreviewPath, path.join(previewDir, design.completeDesignImages.back));
                    console.log(`✅ 复制背面预览图: ${design.completeDesignImages.back}`);
                }
            }
        }

        // 5. 保存裁剪后的素材
        const croppedDir = path.join(tempDir, 'cropped_images');
        if (!fs.existsSync(croppedDir)) {
            fs.mkdirSync(croppedDir);
        }
        let croppedImageCount = 0;
        const usedCropBaseNames = new Set();
        const savedCropFiles = new Set();

        const buildCropBaseName = (side, identifier, index) => {
            const raw = identifier || `image_${index + 1}`;
            const sanitized = String(raw).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || `image_${index + 1}`;
            let base = `${side}_${sanitized}`;
            let counter = 1;
            while (usedCropBaseNames.has(base)) {
                base = `${side}_${sanitized}_${counter}`;
                counter += 1;
            }
            usedCropBaseNames.add(base);
            return base;
        };

        const copyUploadedCroppedFile = (srcPath, baseName) => {
            if (!fs.existsSync(srcPath)) {
                return false;
            }
            const ext = path.extname(srcPath) || '.png';
            let destName = `${baseName}${ext}`;
            let counter = 1;
            while (savedCropFiles.has(destName)) {
                destName = `${baseName}_${counter}${ext}`;
                counter += 1;
            }
            fs.copyFileSync(srcPath, path.join(croppedDir, destName));
            savedCropFiles.add(destName);
            croppedImageCount++;
            console.log(`✂️ 复制裁剪图片: ${destName}`);
            return true;
        };

        const saveCroppedFromSource = (value, baseName) => {
            if (!value || typeof value !== 'string') {
                return false;
            }
            if (value.startsWith('data:image/')) {
                const savedName = saveDataUrlToFile(value, croppedDir, baseName);
                if (savedName) {
                    savedCropFiles.add(savedName);
                    croppedImageCount++;
                    console.log(`✂️ 保存裁剪图片(DataURL): ${savedName}`);
                    return true;
                }
                return false;
            }
            let filename = value;
            if (value.startsWith('/uploads/')) {
                filename = value.slice('/uploads/'.length);
            }
            filename = path.basename(filename);
            const srcPath = path.join(UPLOAD_DIR, filename);
            return copyUploadedCroppedFile(srcPath, baseName);
        };

        ['front', 'back'].forEach(side => {
            const elements = (design.elements && design.elements[side]) || [];
            elements.forEach((element, index) => {
                if (!element || element.type !== 'image' || element.isQRCode) {
                    return;
                }
                const cropConfig = (element.data && element.data.cropConfig) || (element.serializable && element.serializable.cropConfig);
                if (!cropConfig) {
                    return;
                }

                const identifier = (element.serializable && element.serializable.id) || (element.data && element.data.id) || element.id || index + 1;
                const baseName = buildCropBaseName(side, identifier, index);

                const sources = [];
                if (element.data && element.data.src) sources.push(element.data.src);
                if (element.serializable && element.serializable.src && element.serializable.src !== element.data?.src) {
                    sources.push(element.serializable.src);
                }
                if (element.element && typeof element.element.innerHTML === 'string') {
                    const match = element.element.innerHTML.match(/src=["'](data:image\/[a-zA-Z0-9+]+;base64,[^"']+)["']/);
                    if (match && match[1]) {
                        sources.push(match[1]);
                    }
                }

                for (const source of sources) {
                    if (saveCroppedFromSource(source, baseName)) {
                        return;
                    }
                }

                console.warn(`⚠️ 未能保存裁剪图片: ${side} 元素索引 ${index}`);
            });
        });
        console.log(`✂️ 裁剪图片数量: ${croppedImageCount}`);

        // 6. 保存AI生成的素材
        const aiDir = path.join(tempDir, 'ai_generated');
        if (!fs.existsSync(aiDir)) {
            fs.mkdirSync(aiDir);
        }
        let aiImageCount = 0;

        ['front', 'back'].forEach(side => {
            const elements = (design.elements && design.elements[side]) || [];
            elements.forEach((element, index) => {
                if (element.type !== 'image') return;
                const data = element.data || element.serializable || {};
                const aiGenerated = data.aiGenerated || element.aiGenerated || {};
                Object.entries(aiGenerated).forEach(([service, dataUrl]) => {
                    try {
                        const saved = saveDataUrlToFile(dataUrl, aiDir, `${side}_${service}_${index + 1}`);
                        if (saved) {
                            aiImageCount++;
                            console.log(`✨ 保存AI生成图片: ${saved}`);
                        }
                    } catch (e) {
                        console.warn('⚠️ 保存AI生成图片失败:', e.message);
                    }
                });
            });
        });
        console.log(`✨ AI生成素材数量: ${aiImageCount}`);

        // 7. 创建说明文件
        const readmePath = path.join(tempDir, 'README.txt');
        const frontDpi = design.material === 'metal' ? 600 : 300;
        const backDpi = 300;
        const readmeContent = `
PVC卡片设计完整包 - ${designId}
=======================================

客户信息:
- 姓名: ${design.customerInfo?.name || '未提供'}
- 邮箱: ${design.customerInfo?.email || '未提供'}
- 电话: ${design.customerInfo?.phone || '未提供'}
- ETSY订单号: ${design.customerInfo?.etsyOrderNumber || '未提供'}
- 备注: ${design.customerInfo?.notes || '无'}

设计信息:
- 材质: ${design.material}
- 模板: ${design.template}
- 提交时间: ${design.timestamp}
- 正面元素数: ${design.elements?.front?.length || 0}
- 背面元素数: ${design.elements?.back?.length || 0}
 - DPI: 正面 ${frontDpi}DPI, 背面 ${backDpi}DPI

文件夹说明:
- ${designId}_data.json: 完整的设计数据
- original_images/: 用户上传的原始图片
- preview_images/: 完整设计预览图 (包含模板背景)
- print_ready_300dpi/: 印刷用图片（文件名后缀注明实际DPI）
- cropped_images/: 裁剪后的图片（与画布一致，含轮廓）
- ai_generated/: AI 功能生成的素材（按服务分类）

使用说明:
1. original_images/ 目录包含用户上传的图片原始文件
2. preview_images/ 目录包含提交时看到的预览效果图
3. print_ready_300dpi/ 目录包含用于实际打印的高分辨率图
4. cropped_images/ 目录保存裁剪后的画面，可用于核对裁剪参数
5. ai_generated/ 目录包含AI处理后的单个素材结果，便于二次编辑

打包时间: ${new Date().toLocaleString('zh-CN')}
`;
        fs.writeFileSync(readmePath, readmeContent);
        
        // 6. 使用系统命令创建ZIP文件
        const zipFilename = `${designId}_complete_package.zip`;
        const zipPath = path.join(__dirname, 'temp', zipFilename);
        
        try {
            // 使用zip命令打包（macOS/Linux通用）
            await execAsync(`cd "${tempDir}" && zip -r "../${zipFilename}" .`);
            console.log(`📦 ZIP文件创建成功: ${zipFilename}`);
            
            // 发送文件
            res.download(zipPath, zipFilename, (err) => {
                if (err) {
                    console.error('文件发送失败:', err);
                } else {
                    console.log(`✅ 完整设计包下载成功: ${zipFilename}`);
                }
                
                // 清理临时文件
                setTimeout(() => {
                    try {
                        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                        if (fs.existsSync(tempDir)) {
                            fs.rmSync(tempDir, { recursive: true, force: true });
                        }
                        console.log(`🧹 清理临时文件: ${designId}`);
                    } catch (cleanupErr) {
                        console.error('清理临时文件失败:', cleanupErr);
                    }
                }, 10000); // 10秒后清理
            });
            
        } catch (zipError) {
            console.error('创建ZIP文件失败:', zipError);
            res.status(500).json({ 
                success: false, 
                error: '创建压缩包失败',
                details: zipError.message 
            });
        }
        
    } catch (error) {
        console.error('下载完整设计包失败:', error);
        res.status(500).json({ 
            success: false, 
            error: '服务器内部错误',
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

// 生成高分辨率图片（金属正面 600DPI，其余 300DPI）
async function generateHighResImages(designData, designId) {
    const CARD_WIDTH_MM = 85.6;  // 标准名片宽度
    const CARD_HEIGHT_MM = 53.98; // 标准名片高度
    const MM_TO_INCH = 1 / 25.4;

    const highResImages = {};

    // 为正面和背面分别生成图片
    for (const side of ['front', 'back']) {
        const currentDpi = (designData.material === 'metal' && side === 'front') ? 600 : 300;
        const width = Math.round(CARD_WIDTH_MM * MM_TO_INCH * currentDpi);
        const height = Math.round(CARD_HEIGHT_MM * MM_TO_INCH * currentDpi);

        console.log(`生成高分辨率图片: ${width}x${height} 像素 (${currentDpi} DPI) [${designData.material}/${side}]`);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 背景策略：金属/木质 → 透明背景；其他材质（PVC）→ 白底
        const transparentMaterial = (designData.material === 'metal' || designData.material === 'wood');
        if (!transparentMaterial) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, height);
        }

        // 应用材质/模板背景（仅非透明材质时）
        if (!transparentMaterial) {
            await applyMaterialBackground(ctx, designData.material, side, width, height);
            await applyTemplateEffect(ctx, designData.template, side, width, height);
        }
        
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
        
        // 与前端一致：在以下情况下跳过背面元素渲染（但保留背景/模板）：
        // - 半定制模板（blue/pink）的背面
        // - 金属材质的背面
        // - 木质材质的背面
        const isSemiCustom = ['blue', 'pink'].includes(designData.template);
        const shouldSkipBackElements = (side === 'back') && (isSemiCustom || designData.material === 'metal' || designData.material === 'wood');

        if (shouldSkipBackElements) {
            const note = transparentMaterial ? '透明背景（无背景图）' : '仅输出背景与模板';
            console.log(`⏭️ 跳过背面元素渲染（${designData.material}/${designData.template} 规则），${note}`);
        } else {
            console.log(`🎯 渲染${side}面的${sortedElements.length}个元素 (已按z-index排序)`);
            for (const element of sortedElements) {
                console.log(`🔍 处理元素类型: ${element.type}, isQRCode: ${element.isQRCode}, id: ${element.id || 'unknown'}`);
                if (element.isQRCode) {
                    console.log(`🔍 QR码元素详情:`, JSON.stringify({
                        type: element.type,
                        isQRCode: element.isQRCode,
                        src: element.src,
                        serializable: element.serializable,
                        element: element.element ? 'DOM存在' : 'DOM不存在'
                    }, null, 2));
                }
                await renderElement(ctx, element, width, height, { material: designData.material, side });
            }
        }

        // 注意：不进行区域兜底或整画布兜底，保持与前端一致的单次处理

        // 保存图片（文件名带上实际DPI）
        const fileName = `${designId}_${side}_${currentDpi}dpi.png`;
        const filePath = path.join(HIGH_RES_DIR, fileName);
        
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(filePath, buffer);
        
        highResImages[side] = fileName;
        console.log(`${side}面高分辨率图片已生成: ${fileName}`);
    }
    
    return highResImages;
}

// 计算元素区域（按DOM样式或position换算到目标画布）
// （已移除区域兜底，保持前端一次性处理逻辑）

// 单色雕刻（区域）：灰度 + 轻度对比度 + 金属色域映射（保留细节）
function applyMonochromeRegion(ctx, x, y, width, height) {
    const imageData = ctx.getImageData(x, y, width, height);
    const data = imageData.data;
    const contrast = 1.15;      // 轻度对比度增强
    const low = 40, high = 235; // 金属灰域
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a === 0) continue;
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;      // 标准灰度
        gray = ((gray - 128) * contrast) + 128;            // 对比度
        if (gray < 0) gray = 0; if (gray > 255) gray = 255;
        const v = low + (gray / 255) * (high - low);       // 映射到金属灰域
        data[i] = v; data[i + 1] = v; data[i + 2] = v;     // 单色
    }
    ctx.putImageData(imageData, x, y);
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
                ? path.join(__dirname, '..', 'templates', 'PVC_templates', 'Blank_template', 'Metal.jpg')
                : path.join(__dirname, '..', 'templates', 'PVC_templates', 'Blank_template', 'Metal_back.jpg');
            
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
                templateImagePath = path.join(__dirname, '..', 'templates', 'PVC_templates', `${template.charAt(0).toUpperCase() + template.slice(1)}_${side}_compressed.jpg`);
            } else {
                // 正面使用原来的路径
                templateImagePath = path.join(__dirname, '..', 'templates', 'PVC_templates', 'Blank_template', `${template.charAt(0).toUpperCase() + template.slice(1)}_${side}.jpg`);
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
        case 'bamboo':
            // 竹纹模板背景图片
            const bambooImagePath = path.join(__dirname, '..', 'templates', 'PVC_templates', `Bamboo_${side}.png`);
            try {
                console.log(`🎋 加载竹纹模板背景: ${bambooImagePath}`);
                const bambooImage = await loadImage(bambooImagePath);
                ctx.drawImage(bambooImage, 0, 0, width, height);
                console.log(`✅ 竹纹模板背景已应用: bamboo_${side}`);
            } catch (error) {
                console.error(`❌ 竹纹模板背景加载失败: ${bambooImagePath}`, error.message);
                // 降级处理：应用木质纹理效果
                ctx.fillStyle = '#d4a574';
                ctx.fillRect(0, 0, width, height);
                // 添加木纹效果
                ctx.strokeStyle = '#8b6914';
                ctx.lineWidth = 1;
                for (let i = 0; i < height; i += 4) {
                    ctx.beginPath();
                    ctx.moveTo(0, i);
                    ctx.lineTo(width, i + Math.sin(i * 0.1) * 2);
                    ctx.stroke();
                }
            }
            break;
        default:
            console.log(`📄 模板 "${template}" 无特殊效果`);
    }
}

// 渲染单个元素
async function renderElement(ctx, elementData, canvasWidth, canvasHeight, options = {}) {
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
    } else if (elementData.isQRCode && elementData.serializable) {
        // 🔧 QR码特殊处理：使用原始数据中的位置信息
        const qrData = elementData.serializable;
        x = (parseFloat(qrData.x) || 0) * scaleX;
        y = (parseFloat(qrData.y) || 0) * scaleY;
        width = (parseFloat(qrData.width) || 80) * scaleX;
        height = (parseFloat(qrData.height) || 80) * scaleY;
        console.log(`🔧 QR码位置修正: x=${qrData.x}, y=${qrData.y}, w=${qrData.width}, h=${qrData.height}`);
    } else {
        // 默认值
        x = y = 0;
        width = 100 * scaleX;
        height = 100 * scaleY;
    }
    
    console.log(`🎯 渲染${type}元素: 位置(${x.toFixed(1)}, ${y.toFixed(1)}) 尺寸(${width.toFixed(1)} x ${height.toFixed(1)})${elementData.isQRCode ? ' [QR码]' : ''}`);
    
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
    // 高质量缩放
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    switch (type) {
        case 'text':
            await renderTextElement(ctx, elementData, width, height, scaleX, options);
            break;
        case 'image':
            await renderImageElement(ctx, elementData, width, height, { ...options, x, y, rotation });
            break;
        case 'shape':
            await renderShapeElement(ctx, elementData, width, height, options);
            break;
    }
    
    ctx.restore();
}

// 渲染文本元素
async function renderTextElement(ctx, elementData, width, height, scale, options = {}) {
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
    let color = styles.color || '#000000';
    const fontWeight = styles.fontWeight || 'normal';
    const fontStyle = styles.fontStyle || 'normal';
    const textAlign = styles.textAlign || 'left';
    
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    // 强制按材质覆盖文本颜色：金属(正面)=金属灰，木质(两面)=木质色
    if (options.material === 'metal' && options.side === 'front') {
        ctx.fillStyle = 'rgb(196,196,196)';
    } else if (options.material === 'wood') {
        ctx.fillStyle = 'rgb(117,87,35)';
    } else {
        ctx.fillStyle = color;
    }
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
async function renderImageElement(ctx, elementData, width, height, options = {}) {
    try {
        let imageSrc = null;
        
        // 优先从DOM元素和data中获取图片源
        if (elementData.data && elementData.data.src) {
            imageSrc = elementData.data.src;
        } else if (elementData.src) {
            // 🔧 直接从元素src属性获取（QR码可能在这里）
            imageSrc = elementData.src;
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
        
        console.log(`🖼️ 渲染图片元素: 找到图片源 ${imageSrc ? '✅' : '❌'}, isQRCode: ${elementData.isQRCode}, src: ${imageSrc}`);
        
        if (imageSrc) {
            // 如果是base64数据
            if (imageSrc.startsWith('data:')) {
                const base64Data = imageSrc.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                const img = await loadImage(buffer);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                if (options.material === 'metal' && options.side === 'front' && !elementData.isQRCode) {
                    console.log('🪙 BIN(base64): metal/front → start');
                    const t0 = Date.now();
                    const processed = await createBinarizedMetalCanvas(img, width, height);
                    console.log(`🪙 BIN(base64): done in ${Date.now()-t0}ms`);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(processed, 0, 0, width, height);
                } else if (options.material === 'wood' && !elementData.isQRCode) {
                    console.log('🌲 BIN(base64): wood → start');
                    const t0 = Date.now();
                    const processed = await createBinarizedWoodCanvas(img, width, height);
                    console.log(`🌲 BIN(base64): done in ${Date.now()-t0}ms`);
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(processed, 0, 0, width, height);
                } else {
                    ctx.drawImage(img, 0, 0, width, height);
                }
                console.log(`✅ 成功渲染图片元素: ${width}x${height}`);
            } else if (elementData.isQRCode || elementData.src === 'QR_Website.png' || elementData.src === '../assets/QR_Website.png' || (elementData.element && elementData.element.className && elementData.element.className.includes('qr-element'))) {
                // 🔧 修复QR码在300DPI中消失的问题：特殊处理QR码文件路径
                // QR码图片可能的位置：在assets目录
                let qrImagePath;
                if (imageSrc.includes('../assets/QR_Website.png')) {
                    // 处理新的assets路径
                    qrImagePath = path.join(__dirname, '..', 'assets', 'QR_Website.png');
                } else if (imageSrc.startsWith('./')) {
                    // 处理相对路径 './QR_Website.png'
                    qrImagePath = path.join(__dirname, imageSrc.substring(2));
                } else if (imageSrc.startsWith('/')) {
                    // 处理绝对路径
                    qrImagePath = path.join(__dirname, imageSrc);
                } else {
                    // 处理直接文件名 'QR_Website.png'
                    qrImagePath = path.join(__dirname, '..', 'assets', 'QR_Website.png');
                }
                
                try {
                    console.log(`🔍 尝试加载QR码图片: ${qrImagePath}`);
                    const qrImg = await loadImage(qrImagePath);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(qrImg, 0, 0, width, height);
                    console.log(`✅ 成功渲染QR码元素: ${width}x${height}`);
                } catch (qrError) {
                    console.error(`❌ QR码图片加载失败: ${qrImagePath}`, qrError.message);
                    
                    // 尝试备用路径
                    const fallbackPaths = [
                        path.join(__dirname, '..', 'assets', 'QR_Website.png'),
                        path.join(__dirname, 'QR_Website.png'),
                        path.join(__dirname, '../QR_Website.png')
                    ];
                    
                    let loaded = false;
                    for (const fallbackPath of fallbackPaths) {
                        try {
                            console.log(`🔄 尝试备用路径: ${fallbackPath}`);
                            const qrImg = await loadImage(fallbackPath);
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            ctx.drawImage(qrImg, 0, 0, width, height);
                            console.log(`✅ 成功渲染QR码元素（备用路径）: ${width}x${height}`);
                            loaded = true;
                            break;
                        } catch (fallbackError) {
                            console.log(`❌ 备用路径失败: ${fallbackPath}`);
                        }
                    }
                    
                    if (!loaded) {
                        // 绘制QR码占位符
                        console.log(`🎯 绘制QR码占位符: ${width}x${height}`);
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
                }
            } else {
                // 尝试从 uploads 目录按文件名加载原图
                const base = path.basename(imageSrc);
                let filePath = path.join(UPLOAD_DIR, base);
                // 额外兼容：/uploads/xxx 或绝对路径
                if (!fs.existsSync(filePath) && imageSrc.startsWith('/uploads/')) {
                    filePath = path.join(__dirname, imageSrc.replace(/^\//, ''));
                }
                if (fs.existsSync(filePath)) {
                    const img = await loadImage(filePath);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    if (options.material === 'metal' && options.side === 'front' && !elementData.isQRCode) {
                        console.log(`🪙 BIN(file): metal/front → ${base} start`);
                        const t0 = Date.now();
                        const processed = await createBinarizedMetalCanvas(img, width, height);
                        console.log(`🪙 BIN(file): ${base} done in ${Date.now()-t0}ms`);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(processed, 0, 0, width, height);
                    } else if (options.material === 'wood' && !elementData.isQRCode) {
                        console.log(`🌲 BIN(file): wood → ${base} start`);
                        const t0 = Date.now();
                        const processed = await createBinarizedWoodCanvas(img, width, height);
                        console.log(`🌲 BIN(file): ${base} done in ${Date.now()-t0}ms`);
                        ctx.imageSmoothingEnabled = false;
                        ctx.drawImage(processed, 0, 0, width, height);
                    } else {
                        ctx.drawImage(img, 0, 0, width, height);
                    }
                    console.log(`✅ 从uploads加载图片并渲染: ${base}`);
                } else {
                    console.log(`⚠️ 非base64图片源且未找到文件，跳过: ${imageSrc.substring(0, 80)}...`);
                }
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

// 生成与前端一致的金属材质二值化雕刻效果（暗部→金属灰#c4c4c4，亮部→透明）
async function createBinarizedMetalCanvas(img, targetW, targetH) {
    const off = createCanvas(Math.max(1, Math.round(targetW)), Math.max(1, Math.round(targetH)));
    const octx = off.getContext('2d');
    // 为避免插值产生过渡色，关闭离屏插值
    octx.imageSmoothingEnabled = false;
    // 缩放绘制到目标尺寸
    octx.drawImage(img, 0, 0, off.width, off.height);
    const imageData = octx.getImageData(0, 0, off.width, off.height);
    const data = imageData.data;
    const targetR = 196, targetG = 196, targetB = 196; // 前端金属灰
    const rowSize = off.width * 4;
    const chunkRows = 100; // 每处理100行让出事件循环，避免长时间阻塞
    let changed = 0;
    for (let y = 0; y < off.height; y++) {
        const base = y * rowSize;
        for (let x = 0; x < off.width; x++) {
            const i = base + x * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            if (a > 10 && brightness < 240) {
                // 命中：输出固定金属灰+不透明
                data[i] = targetR; data[i + 1] = targetG; data[i + 2] = targetB; data[i + 3] = 255;
                changed++;
            } else {
                // 未命中：输出固定金属灰+透明（避免前景色泄露造成边缘第三色）
                data[i] = targetR; data[i + 1] = targetG; data[i + 2] = targetB; data[i + 3] = 0;
            }
        }
        if (y % chunkRows === 0) {
            await new Promise(res => setImmediate(res));
        }
    }
    octx.putImageData(imageData, 0, 0);
    console.log(`🪙 BIN(stats): ${changed} pixels set to METAL-GRAY over ${off.width}x${off.height}`);
    return off;
}

// 生成与前端一致的木质材质二值化雕刻效果（暗部→木质棕 #755723，亮部→透明）
async function createBinarizedWoodCanvas(img, targetW, targetH) {
    const off = createCanvas(Math.max(1, Math.round(targetW)), Math.max(1, Math.round(targetH)));
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = false;
    octx.drawImage(img, 0, 0, off.width, off.height);
    const imageData = octx.getImageData(0, 0, off.width, off.height);
    const data = imageData.data;
    const targetR = 117, targetG = 87, targetB = 35; // 木质雕刻色
    const rowSize = off.width * 4;
    const chunkRows = 100;
    let changed = 0;
    for (let y = 0; y < off.height; y++) {
        const base = y * rowSize;
        for (let x = 0; x < off.width; x++) {
            const i = base + x * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            if (a > 10 && brightness < 240) {
                data[i] = targetR; data[i + 1] = targetG; data[i + 2] = targetB; data[i + 3] = 255;
                changed++;
            } else {
                data[i] = targetR; data[i + 1] = targetG; data[i + 2] = targetB; data[i + 3] = 0;
            }
        }
        if (y % chunkRows === 0) {
            await new Promise(res => setImmediate(res));
        }
    }
    octx.putImageData(imageData, 0, 0);
    console.log(`🌲 BIN(stats): ${changed} pixels set to WOOD-BROWN over ${off.width}x${off.height}`);
    return off;
}

// 渲染形状元素
async function renderShapeElement(ctx, elementData, width, height, options = {}) {
    const shapeType = elementData.shapeType || 'rect';
    const props = elementData.properties || {};
    const enableFill = !!props.enableFill;
    const enableStroke = !!props.enableStroke;
    const strokeWidth = Math.max(0, parseInt(props.strokeWidth) || 0);
    const fillColor = props.fillColor || '#000000';
    const strokeColor = props.strokeColor || '#000000';
    
    ctx.beginPath();
    
    if (shapeType === 'circle') {
        const radius = Math.min(width, height) / 2;
        ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
    } else {
        // 矩形
        ctx.rect(0, 0, width, height);
    }
    
    // 填充
    if (enableFill) {
        // 金属材质正面：固定金属灰(196,196,196)
        // 木质材质：固定木质棕(117,87,35)
        if (options.material === 'metal' && options.side === 'front') {
            ctx.fillStyle = 'rgb(196,196,196)';
        } else if (options.material === 'wood') {
            ctx.fillStyle = 'rgb(117,87,35)';
        } else {
            ctx.fillStyle = fillColor;
        }
        ctx.fill();
    }
    
    // 描边
    if (enableStroke) {
        // 金属材质正面：固定金属灰(196,196,196)
        // 木质材质：固定木质棕(117,87,35)
        if (options.material === 'metal' && options.side === 'front') {
            ctx.strokeStyle = 'rgb(196,196,196)';
        } else if (options.material === 'wood') {
            ctx.strokeStyle = 'rgb(117,87,35)';
        } else {
            ctx.strokeStyle = strokeColor;
        }
        ctx.lineWidth = strokeWidth;
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
