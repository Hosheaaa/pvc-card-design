/**
 * 固定提示词（Prompt）预设
 * 不向用户暴露输入框，前端在发起请求时自动拼装固定提示词（可带上下文）。
 */

/**
 * 获取固定提示词
 * @param {string} service - 服务名（openAiImage 等）
 * @param {string} lang - 语言（'zh' | 'en'）
 * @param {Object} ctx - 上下文（可选：material/template 等）
 * @returns {string} 提示词
 */
export function getFixedPrompt(service, _lang = 'en') {
    // Always return English prompts as requested. No contextual injection.
    switch (service) {
        case 'backgroundRemoval':
            // Portrait cutout – emphasize accurate person segmentation and clean alpha mask
            return [
                'High-quality portrait cutout with precise hair details and clean alpha transparency.',
                'Preserve original resolution and avoid color shifts.'
            ].join(' ');

        case 'openAiImage':
            // Outpainting – extend naturally to card aspect while keeping style/tone
            return [
                'Outpaint to fill a 85.5×54 mm card aspect ratio (approx. 1.583:1), full-bleed with no borders.',
                'Naturally continue image content to the new canvas, keep the same style, color tone and fine details, seamless edges.'
            ].join(' ');

        case 'animeStyleTransfer':
            // Anime style – coherent line work and facial features
            return [
                'Convert to high-quality anime style with coherent line work and clear facial features.',
                'Keep the original composition while stylizing colors and shading.'
            ].join(' ');

        case 'outlineExtraction':
            // Edge/outline extraction – clean vector-like outline preferred
            return [
                'Extract clean, single-color outlines with transparent background; emphasize main subject contours.',
                'Avoid inner noise and keep edges crisp.'
            ].join(' ');

        default:
            return '';
    }
}
