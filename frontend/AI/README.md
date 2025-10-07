# AI 图像处理模块

## 功能概述

为PVC卡片设计平台提供四个 AI 图像处理功能（内联于 Image 右侧属性面板）：
- 人像抠图（Background Removal）
- Gemini 图像（扩图 / 动漫化 / 扣轮廓共用代理）
- 动漫化（Anime Style Transfer）
- 扣轮廓（Outline Extraction）

## 模块架构

```
AI/
├── core/
│   ├── AIManager.js        # AI功能管理器
│   ├── BaseAIService.js    # AI服务基类
│   └── utils.js            # 工具函数
├── services/
│   ├── BackgroundRemoval.js    # 人像抠图
│   ├── OpenAIImageService.js   # OpenAI 图像代理（扩图/动漫化共用）
│   ├── AnimeStyleTransfer.js   # 动漫化
│   └── OutlineExtraction.js    # 扣轮廓
├── ui/
│   └── ProcessingModal.js      # 处理进度模态框
├── config/
│   ├── api-endpoints.js    # API端点配置
│   └── feature-flags.js    # 功能开关配置
└── styles/
    ├── ai-tools.css        # 内联AI样式（徽标/按钮/提示）
    └── processing.css      # 处理进度样式
```

## 集成方式

通过功能开关安全集成到现有系统，不影响生产环境稳定性。UI 采用“内联模式”：仅在 Image 右侧属性面板显示 AI 按钮；Image 功能标签会追加 “AI+” 徽标作为提示，不存在独立 AI 面板。

## API 设计与安全

- 前端不直接调用第三方AI服务，不在浏览器里携带任何API密钥。
- 统一通过后端代理路由调用：
  - 背景移除：`/api/ai/background-removal`
- Gemini 图像（扩图/动漫化/扣轮廓统一复用）：`/api/ai/openai-image`
- 开发环境默认启用 mock（不依赖后端/密钥）。

每个AI服务遵循统一的接口规范，便于替换后端服务商。

### 提示词（Prompt）策略
- 前端不提供提示词输入框，避免用户直接提交任意 Prompt。
- 内联控件发起请求时，前端会为四类服务自动注入“固定英文提示词”（不包含材质/模板等上下文）。
- 固定提示词配置：`AI/config/prompt-presets.js`（仅英文）。
- 当前注入：
  - Portrait Cutout（backgroundRemoval）：'High-quality portrait cutout with precise hair details and clean alpha transparency. Preserve original resolution and avoid color shifts.'
- OpenAI Image（openAiImage）：'Outpaint to fill a 85.5×54 mm card aspect ratio (approx. 1.583:1), full-bleed with no borders. Naturally continue image content to the new canvas, keep the same style, color tone and fine details, seamless edges.'
 - OpenAI Image（openAiImage）：默认固定提示词；实际请求时会注入“当前卡片预览区域的精确像素尺寸”（例如 1011×637），提示词改写为：
   'Outpaint the image to exactly {W}x{H} pixels to fill the card canvas (full-bleed, no borders). Keep the same style, color tone and fine details, with seamless edges.'
   同时在请求的 additionalParams 中附带 `target_width/target_height` 以便后端严格控制输出尺寸。
  - Anime Style（animeStyleTransfer）：'Convert to high-quality anime style with coherent line work and clear facial features. Keep the original composition while stylizing colors and shading.'
  - Outline Extraction（outlineExtraction）：'Extract clean, single-color outlines with transparent background; emphasize main subject contours. Avoid inner noise and keep edges crisp.'

### 元数据存储
- 每个图片元素会记录：
  - `data.originalSrc`：用户上传的原始图（base64）。
  - `data.src`：当前画布展示用图（可能是 AI 或材质滤镜后的结果）。
  - `data.aiGenerated`：按服务名存储 AI 输出的 DataURL，例如 `backgroundRemoval`。
- 后端打包时会根据这些字段生成 `original_images/` 与 `ai_generated/` 文件夹，方便在生产流程中区分原图与 AI 成果。

-### 扩图（Gemini）与 OpenAI 组合
- `openAiImage`（拓展至卡片大小）通过后端代理调用 Google Gemini `gemini-2.5-flash-image-preview` 模型，后端会自动将生成图裁剪到卡片比例后再回传，避免前端铺满时产生拉伸。
- `animeStyleTransfer` 与 `outlineExtraction` 仍使用 OpenAI GPT-Image-1 接口（经 `/api/ai/openai-image`），保留遮罩与 JSON 响应。
- 需要在服务器设置 `GEMINI_API_KEY` 与 `OPENAI_API_KEY` 等环境变量，分别对应两条流程。

## 使用说明（本地）

- 直接双击 `index.html`（file://）即可演示全流程（mock 模式）。
- 打开 Image 功能 → 在右侧属性面板上传图片 → 使用 4 个 AI 按钮之一 → 等待进度完成后自动替换当前选中图片。

多语言：若页面语言为英文（`cardDesigner.currentLanguage = 'en'`），提示与按钮将显示英文（Portrait Cutout / Expand to Card Size / Anime Style / Outline Extraction；Processing (mock)）。

## 使用说明（接入真实接口）

- 通过 http/https 打开站点；后端实现上述 `/api/ai/*` 代理接口并注入密钥（背景移除需要 `REMOVE_BG_API_KEY`）。
- 将 `AI/config/feature-flags.js` 的 `mockApiCalls` 设为 `false`（按环境）。
- 其余前端代码无需修改。

进度展示：
- file 模式：轻量 mock 进度条（按语言显示“AI 处理中（mock）”或“Processing (mock)）。
- http/https 模式：完整 ProcessingModal（Uploading... / AI Processing... / Done!，支持中英文）。

### 版本化与缓存
- `index.html` 在注入 `AI/loader.js` 时会设置 `window.__AI_ASSET_VERSION__` 并附加 `?v=<版本>` 查询参数。
- `AI/loader.js` 及其动态 `import()`（`feature-flags.js`、`AIManager.js`、`prompt-presets.js` 等）会自动带上相同版本号，避免 Safari 等浏览器长期缓存旧模块。
- 发布新版本时，更新 `index.html` 中的 `aiVersion` 字符串（例如 `20240924T1100`）即可触发浏览器拉取新脚本。
