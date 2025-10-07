// 测试渲染功能
const { createCanvas, loadImage } = require('canvas');

// 模拟的设计数据
const testData = {
    material: 'pvc',
    template: 'blank',
    elements: {
        front: [{
            type: 'text',
            text: 'Test',
            styles: {
                fontSize: '16px',
                color: '#000000'
            },
            position: {
                left: '50px',
                top: '50px',
                width: '100px',
                height: '30px'
            }
        }],
        back: []
    }
};

// 测试渲染函数
async function testRenderElement(ctx, elementData, canvasWidth, canvasHeight) {
    console.log('Testing renderElement with:', elementData);
    
    const type = elementData.type;
    const position = elementData.position || {};
    
    console.log('Type:', type);
    console.log('Position:', position);
    
    // 从位置数据中获取位置和尺寸 (转换为高分辨率)
    const scale = canvasWidth / 400; // 假设原始画布宽度为400px
    const x = (parseInt(position.left) || 0) * scale;
    const y = (parseInt(position.top) || 0) * scale;
    const width = (parseInt(position.width) || 100) * scale;
    const height = (parseInt(position.height) || 100) * scale;
    
    console.log('Calculated dimensions:', { x, y, width, height });
    
    ctx.save();
    
    // 应用变换（旋转）
    if (position.transform && position.transform.includes('rotate')) {
        const angle = parseFloat(position.transform.match(/rotate\((.+?)deg\)/)[1]);
        ctx.translate(x + width / 2, y + height / 2);
        ctx.rotate(angle * Math.PI / 180);
        ctx.translate(-width / 2, -height / 2);
    } else {
        ctx.translate(x, y);
    }
    
    switch (type) {
        case 'text':
            await testRenderTextElement(ctx, elementData, width, height, scale);
            break;
        case 'image':
            console.log('Rendering image element');
            break;
        case 'shape':
            console.log('Rendering shape element');
            break;
    }
    
    ctx.restore();
}

async function testRenderTextElement(ctx, elementData, width, height, scale) {
    console.log('Rendering text element:', elementData);
    
    const text = elementData.text || '';
    const styles = elementData.styles || {};
    
    const fontSize = (parseInt(styles.fontSize) || 16) * scale;
    const fontFamily = styles.fontFamily || 'Arial';
    const color = styles.color || '#000000';
    const fontWeight = styles.fontWeight || 'normal';
    const fontStyle = styles.fontStyle || 'normal';
    const textAlign = styles.textAlign || 'left';
    
    console.log('Text:', text);
    console.log('Styles:', styles);
    
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

// 运行测试
async function runTest() {
    console.log('Starting test...');
    
    const canvas = createCanvas(400, 250);
    const ctx = canvas.getContext('2d');
    
    // 测试渲染正面元素
    const frontElements = testData.elements.front;
    console.log('Front elements:', frontElements);
    
    for (const element of frontElements) {
        try {
            await testRenderElement(ctx, element, 400, 250);
            console.log('✅ Element rendered successfully');
        } catch (error) {
            console.error('❌ Error rendering element:', error);
        }
    }
    
    console.log('Test completed');
}

runTest();