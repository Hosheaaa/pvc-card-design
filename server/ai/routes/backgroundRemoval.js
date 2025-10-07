const express = require('express');
const multer = require('multer');
const { removeBackground, RemoveBgServiceError } = require('../services/removeBgClient');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 12 * 1024 * 1024 // 与前端背景移除配置保持一致
    }
});

router.post('/background-removal', upload.single('image_file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: '缺少待处理的图像文件(image_file)'
            });
        }

        console.log('🚀 调用 remove.bg 抠图服务', {
            filename: req.file.originalname,
            size: req.file.size,
            options: req.body
        });

        const result = await removeBackground(req.file, req.body || {});

        res.set('Content-Type', result.contentType);
        if (result.contentDisposition) {
            res.set('Content-Disposition', result.contentDisposition);
        }
        res.send(result.buffer);
    } catch (error) {
        console.error('⚠️ remove.bg 抠图处理失败:', error);

        if (error instanceof RemoveBgServiceError) {
            return res.status(error.status || 500).json({
                success: false,
                error: error.message,
                details: error.details,
                providerStatus: error.providerStatus
            });
        }

        res.status(500).json({
            success: false,
            error: 'AI 抠图失败',
            details: error.message || '未知错误'
        });
    }
});

module.exports = router;
