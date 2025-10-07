(function () {
  'use strict';

  // Simple, non-module fallback loader for file:// testing.
  // Provides mock-only AI panel and processing without importing modules.

  function waitForCardDesigner(maxWaitMs = 10000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (window.cardDesigner && window.cardDesigner.addImageElement) {
          clearInterval(timer);
          resolve(window.cardDesigner);
        }
        if (Date.now() - start > maxWaitMs) {
          clearInterval(timer);
          resolve(null);
        }
      }, 100);
    });
  }

  function addStyles() {
    const styles = [
      'AI/styles/ai-tools.css',
      'AI/styles/processing.css'
    ];
    styles.forEach((href) => {
      if (!document.querySelector('link[href="' + href + '"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
      }
    });
  }

  function showReadyToast() {
    const el = document.createElement('div');
    el.textContent = 'AI工具（本地mock）已就绪';
    el.style.cssText = 'position:fixed;top:20px;right:20px;background:#667eea;color:#fff;padding:10px 12px;border-radius:8px;z-index:9999;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  // 已移除：独立AI标签

  function decorateImageFeatureTab() {
    const imgTab = document.querySelector('.feature-tabs [data-feature="image"]');
    if (imgTab && !imgTab.querySelector('.ai-badge')) {
      const span = document.createElement('span');
      span.className = 'ai-badge';
      span.textContent = 'AI+';
      imgTab.appendChild(span);
    }
  }

  function injectInlineAIIntoImagePanel() {
    const imagePanel = document.getElementById('imageProperties');
    if (!imagePanel) return;

    const L = (function(){
      const zh = {
        hint: '上传图片后可以使用AI进行人像抠图、拓展至卡片大小、动漫化、扣轮廓',
        title: 'AI 图像工具',
        btnBG: '✂️ 人像抠图',
        btnEXP: '🔍 拓展至卡片大小',
        btnANIME: '🎨 动漫化',
        btnOUTLINE: '🖊️ 扣轮廓',
        selectImgFirst: '请先在卡片上选择一张图片。'
      };
      const en = {
        hint: 'After uploading, you can use AI for portrait cutout, expand to card size, anime style, and outline extraction.',
        title: 'AI Image Tools',
        btnBG: '✂️ Portrait Cutout',
        btnEXP: '🔍 Expand to Card Size',
        btnANIME: '🎨 Anime Style',
        btnOUTLINE: '🖊️ Outline Extraction',
        selectImgFirst: 'Please select an image on the card first.'
      };
      return (window.cardDesigner?.currentLanguage === 'zh') ? zh : en;
    })();

    const uploadSection = imagePanel.querySelector('#uploadSection');
    if (uploadSection && !uploadSection.querySelector('.ai-inline-hint')) {
      const hint = document.createElement('p');
      hint.className = 'ai-inline-hint';
      hint.textContent = L.hint;
      uploadSection.appendChild(hint);
    }
    const hintExist = uploadSection && uploadSection.querySelector('.ai-inline-hint');
    if (hintExist) hintExist.textContent = L.hint;

    if (!imagePanel.querySelector('.ai-inline-controls')) {
      const container = document.createElement('div');
      container.className = 'ai-inline-controls';
      container.innerHTML = '<div class="ai-inline-title">'+L.title+'</div>' +
        '<div class="ai-inline-buttons">' +
        '  <button class="ai-inline-btn ai-bg" data-ai-action="background-removal">'+L.btnBG+'</button>' +
        '  <button class="ai-inline-btn ai-exp" data-ai-action="openai-image">'+L.btnEXP+'</button>' +
        '  <button class="ai-inline-btn ai-anime" data-ai-action="anime-style">'+L.btnANIME+'</button>' +
        '  <button class="ai-inline-btn ai-outline" data-ai-action="outline-extraction">'+L.btnOUTLINE+'</button>' +
        '</div>';
      if (uploadSection && uploadSection.parentNode) {
        uploadSection.parentNode.insertBefore(container, uploadSection.nextSibling);
      } else {
        imagePanel.appendChild(container);
      }

      container.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-ai-action]');
        if (!btn) return;
        const sel = window.cardDesigner && window.cardDesigner.selectedElement;
        if (!sel || !sel.classList || !sel.classList.contains('image-element')) {
          alert(L.selectImgFirst);
          return;
        }
        await simulateProcessing();
        // mock：直接使用原图（将选中图片 DataURL 重新写回以模拟替换）
        const img = sel.matches('img') ? sel : sel.querySelector('img');
        if (img && img.src) {
          replaceSelectedImage(sel, img.src, { service: btn?.dataset?.aiAction });
        }
      });
    }
    // 刷新已存在容器文案（语言切换）
    const exist = imagePanel.querySelector('.ai-inline-controls');
    if (exist) {
      const title = exist.querySelector('.ai-inline-title');
      const btnBG = exist.querySelector('[data-ai-action="background-removal"]');
      const btnEXP = exist.querySelector('[data-ai-action="openai-image"]');
      const btnANIME = exist.querySelector('[data-ai-action="anime-style"]');
      const btnOUTLINE = exist.querySelector('[data-ai-action="outline-extraction"]');
      if (title) title.textContent = L.title;
      if (btnBG) btnBG.textContent = L.btnBG;
      if (btnEXP) btnEXP.textContent = L.btnEXP;
      if (btnANIME) btnANIME.textContent = L.btnANIME;
      if (btnOUTLINE) btnOUTLINE.textContent = L.btnOUTLINE;
    }
  }

  function replaceSelectedImage(imageElement, dataURL, metadata = {}) {
    const imgNode = imageElement && (imageElement.matches?.('img') ? imageElement : imageElement.querySelector('img'));
    if (imgNode) {
      const applyEngraveIfNeeded = () => {
        try {
          const mat = window.cardDesigner?.currentMaterial;
          const side = window.cardDesigner?.currentSide;
          if (mat === 'wood' && typeof window.cardDesigner?.applyWoodEngravingEffect === 'function') {
            window.cardDesigner.applyWoodEngravingEffect(imgNode);
          } else if (mat === 'metal' && side !== 'back' && typeof window.cardDesigner?.applyMetalEngravingEffect === 'function') {
            window.cardDesigner.applyMetalEngravingEffect(imgNode);
          }
        } catch(_) {}
      };
      imgNode.onload = () => { applyEngraveIfNeeded(); imgNode.onload = null; };
      imgNode.src = dataURL;
      if (imgNode.complete) applyEngraveIfNeeded();
    }
    try {
      const side = window.cardDesigner?.currentSide;
      const list = window.cardDesigner?.elements?.[side] || [];
      const rec = list.find(el => el && el.element === imageElement);
      if (rec) {
        const previousSrc = rec.data?.src || rec.serializable?.src;
        const service = metadata?.service;

        if (rec.data) {
          if (!rec.data.originalSrc && previousSrc) {
            rec.data.originalSrc = previousSrc;
          }
          rec.data.src = dataURL;
          if (!rec.data.aiGenerated) rec.data.aiGenerated = {};
          if (service) {
            rec.data.aiGenerated[service] = dataURL;
          }
        }
        if (rec.serializable) {
          if (!rec.serializable.originalSrc && previousSrc) {
            rec.serializable.originalSrc = previousSrc;
          }
          rec.serializable.src = dataURL;
          if (!rec.serializable.aiGenerated) rec.serializable.aiGenerated = {};
          if (service) {
            rec.serializable.aiGenerated[service] = dataURL;
          }
        }
      }
      if (window.cardDesigner?.historyManager?.recordAction) {
        window.cardDesigner.historyManager.recordAction();
      }
    } catch(_) { }
  }

  // 已移除：独立AI面板

  // 已移除：独立AI面板展示逻辑

  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  // 已移除：独立AI面板事件

  function toast(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#2196f3;color:#fff;padding:10px 12px;border-radius:6px;z-index:9999;';
    document.body.appendChild(t); setTimeout(() => t.remove(), 2500);
  }

  // 已移除：独立面板选图

  // 已移除：独立面板结果预览

  async function simulateProcessing() {
    // very lightweight fake modal/progress
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;padding:16px 20px;border-radius:10px;box-shadow:0 6px 30px rgba(0,0,0,.25);z-index:10000;';
    const title = (window.cardDesigner?.currentLanguage === 'zh') ? 'AI 处理中（mock）' : 'Processing (mock)';
    box.innerHTML = '<div style="font-weight:600;margin-bottom:8px;">'+title+'</div><div id="aiProg" style="width:260px;height:8px;background:#eee;border-radius:4px;"><div id="aiProgFill" style="height:100%;width:0;background:linear-gradient(90deg,#667eea,#764ba2);border-radius:4px;"></div></div>';
    document.body.appendChild(box);
    const fill = box.querySelector('#aiProgFill');
    let p = 0;
    await new Promise((r) => {
      const t = setInterval(() => {
        p += 10; if (p > 100) p = 100;
        fill.style.width = p + '%';
        if (p === 100) { clearInterval(t); setTimeout(r, 300); }
      }, 150);
    });
    box.remove();
  }

  async function init() {
    if (!(document && document.body)) {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }
    console.log('🤖 AI standalone loader (file:// mock) starting...');
    const designer = await waitForCardDesigner();
    if (!designer) { console.warn('未检测到 CardDesigner，AI跳过'); return; }
    addStyles();
    decorateImageFeatureTab();
    injectInlineAIIntoImagePanel();
    // DOM 观察：确保内联控件存在
    (function setupObservers(){
      let ensuring = false;
      const ensure = () => {
        if (ensuring) return; // 防抖，避免观察自身造成的递归
        ensuring = true;
        try {
          // 仅保证内联控件存在
          decorateImageFeatureTab();
          injectInlineAIIntoImagePanel();
        } finally {
          // 延迟清除，合并同一批次的多次回调
          setTimeout(() => { ensuring = false; }, 0);
        }
      };
      const panel = document.querySelector('.properties-panel');
      const tabs = document.querySelector('.feature-tabs');
      if (panel) {
        const mo = new MutationObserver(() => ensure());
        mo.observe(panel, { childList: true, subtree: true });
      }
      if (tabs) {
        const mo2 = new MutationObserver(() => ensure());
        mo2.observe(tabs, { childList: true, subtree: true });
      }
      const start = Date.now();
      const it = setInterval(() => {
        ensure();
        if (Date.now() - start > 5000) clearInterval(it);
      }, 300);
    })();
    showReadyToast();
    console.log('✅ AI standalone 已加载（mock 流程）');
  }

  init();
})();
