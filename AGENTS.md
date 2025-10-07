# Repository Guidelines

## 项目结构与模块
- 前端（设计站点）：根目录下 `index.html`、`script.js`、`style.css`；演示/排错页：`test_*.html`、`Preview/`。
- 主题（Shopify）：`layout/`、`sections/`、`snippets/`、`templates/`、`assets/`、`locales/`、`config/`（参考 CLAUDE.md 的 King 主题说明）。
- 后端（Node/Express）：`Server/` 内含 `server.js`、`package.json`，及运维脚本 `deploy.sh`/`setup.sh`/`upload.sh`/`connect.sh`；渲染验证：`Server/test-render.js`。
- 模板与素材：`PVC_templates/`、`assets/`、示例图片（金属/木纹等）。避免将大体积二进制持续加入版本库。

## 构建、运行与测试
- 本地预览前端：直接打开 `index.html` 检查交互/布局回归；主题联调将文件同步到开发主题后刷新。
- AI 本地测试：可临时在 `index.html` 末尾加入 `<script type="module" src="AI/loader.js"></script>`，无需修改现有大脚本；开发环境默认使用 mock，不依赖后端。AI 控件以内联方式出现在 Image 右侧属性面板（4 个按钮：人像抠图 / 拓展至卡片大小 / 动漫化 / 扣轮廓）。
  - 语言：根据页面语言（zh/en）自动切换按钮与提示文案。
  - 进度：file 模式采用轻量 mock 进度；http/https 模式采用 ProcessingModal（完整步骤，支持中英文）。
  - 提示词：前端不提供输入框；四个服务均由前端自动注入“固定英文提示词”（不含材质/模板上下文），见 `AI/config/prompt-presets.js`。
    - 扩图：前端会根据“.card.active .card-content”的实际像素尺寸动态改写提示词（精确到 {W}×{H} px），并在请求参数中附带 `target_width/target_height`，便于后端严格控制输出图尺寸。
- 启动后端（开发）：`cd Server && npm install && npm run dev`（Node ≥14）。生产：`npm start` 或 `npm run pm2-start`。
- 300DPI 渲染自检：`node Server/test-render.js`；接口冒烟：`GET /health`、`POST /api/submit-design`（见 Server/README.md）。

## 代码风格与命名
- JavaScript：ES6+，4 空格缩进，分号结尾，单引号；倾向小而纯的函数/类方法，文件名用 kebab-case（如 `card-utils.js`）。
- CSS：4 空格缩进，组件化命名（BEM 倡导），样式尽量局部化。
- Liquid：片段/区块文件 kebab-case；保持 schema/设置 ID 稳定，勿随意更名以免打断 JS 选择器与主题设置。

## 测试准则
- 前端：使用 `index.html` 与 `test_*.html` 手动覆盖材料/模板切换、拖拽与上传、QR 规则（PVC+Blank 才启用）。
- 后端：提交含 QR 的设计，核对日志与 300DPI 输出（`high_res/`）；必要时用 `admin.html` 预览与下载。
- PR 必附复现步骤与前后截图，注意多语言与主题设置不回归。

## Commit 与 PR 规范
- Commit 建议使用 Conventional Commits：如 `feat(server): add 300dpi render for back side`、`fix(theme): preserve section ids`。
- PR 需包含：变更目的/范围、关联 issue、UI 截图、前后端本地验证要点、配置改动说明。

## 安全与配置
- 切勿提交密钥与大体积产物：如 `First.pem`、`.env*`、`uploads/`、`designs/`、`high_res/`（已在 `.gitignore`）。
- 默认服务端口 3000；变更请在文档与部署脚本中同步；公开端点与管理页需评审确认。
- AI 前端不直连第三方服务：如需启用真实 AI，务必在后端实现代理路由 `/api/ai/*` 并通过环境变量注入密钥；当前扩图/动漫/轮廓均指向 `/api/ai/openai-image`（Gemini），人像抠图则指向 `/api/ai/background-removal`。

## AI 模块（AI/）
- 零侵入集成：通过 `AI/loader.js` 外挂增强，不修改 `script.js`。
- 关键目录：`core/`（AIManager、基类、工具）、`services/`（人像抠图/拓展至卡片大小/动漫化/扣轮廓）、`ui/`（仅进度模态）、`config/`（功能开关、端点）。
- 功能开关：见 `AI/config/feature-flags.js`（开发默认 `mockApiCalls: true`）。
- 端点：见 `AI/config/api-endpoints.js`（前端统一指向后端 `/api/ai/*` 代理）。

## 环境变量示例
- 示例文件：`Server/.env.example`（PORT、CORS、存储目录、日志级别、QR 资源路径）。
- 说明：当前 `server.js` 未读取 `.env`，生产可用 PM2/系统环境变量注入，或后续接入 `dotenv`。

## API 快速验证（curl）
- 健康检查：`curl http://localhost:3000/health`
- 提交设计（最小化示例）：
  `curl -X POST http://localhost:3000/api/submit-design -F 'designData={"material":"pvc","template":"blank","elements":{"front":[],"back":[]}}'`
- 获取设计列表：`curl http://localhost:3000/api/designs`
- 下载完整包：`curl -L -o pkg.zip http://localhost:3000/api/designs/<design_id>/download-complete`

## 线上域名与更新流程（AWS EC2 Ubuntu）

- 域名与访问
  - 设计站点（前端）：`https://design.soonai.sg`
  - API 前缀：`https://design.soonai.sg/api`
  - 健康检查：`https://design.soonai.sg/health`

- 部署结构
  - Nginx 站点配置：`/etc/nginx/sites-available/design.soonai.sg`（已启用）
  - 前端静态根目录：`/var/www/soonai`（包含 `index.html`、`script.js`、`style.css`、`assets/`、`PVC_templates/`）
  - 后端（Node/Express）：本机 `127.0.0.1:3000`，由 Nginx 反代；PM2 进程名：`pvc-design-server`
  - 证书：Let’s Encrypt（Certbot 自动续期 `certbot.timer`，HTTP→HTTPS 已开启）
  - 防火墙：仅开放 `22/80/443`；`3000` 仅本机访问

- 更新前端（静态）
  - 推荐：在服务器上从仓库同步（不会改动TLS配置）：
    - `sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/shopify_dev FORCE_NGINX=false bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh`
  - 或最小化复制：
    - `scp -i Server/First.pem script.js ubuntu@54.251.114.224:/home/ubuntu/shopify_dev/script.js && ssh -i Server/First.pem ubuntu@54.251.114.224 'sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/shopify_dev FORCE_NGINX=false bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh'`
  - 验证：
    - `curl -I https://design.soonai.sg`
    - `curl -sS "https://design.soonai.sg/script.js?ts=$(date +%s)" | head -n 1`（cache bust）
  - 注意：如非必要，不要覆盖 Nginx 站点文件。若需重写，设置 `FORCE_NGINX=true` 后再执行一次 `sudo certbot --nginx -d design.soonai.sg --redirect` 以恢复HTTPS。

- 更新后端（Server）
  - 代码同步到服务器：`/home/ubuntu/shopify_dev`
  - 安装依赖并重启：
    - `cd /home/ubuntu/shopify_dev/Server && npm install --production`
    - `sudo pm2 restart pvc-design-server && sudo pm2 save`
  - 验证：`curl -sS https://design.soonai.sg/health`

- 一键脚本（可重复用于初始化/同步静态与反代）
  - `sudo DOMAIN=design.soonai.sg bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh`

- DNS 记录（GoDaddy）
  - 子域 A 记录：`design` → `54.251.114.224`
  - 主域 `soonai.sg` 保持现有绑定不变

- 客户端请求说明
  - 前端已改为自动选择服务器地址：域名访问时使用相对路径（`/api/...`），本地 file:// 预览时回退 `http://localhost:3000`。

### 后台管理页（受密码保护）
- 管理页地址：`https://design.soonai.sg/admin.html`
- 认证方式：Nginx Basic Auth（受保护的 `location = /admin.html`）
- 认证文件：`/etc/nginx/.htpasswd_admin`
- 现有用户：
  - `nuowei@soonai.sg / nuowei918`
  - `mike@soonai.sg / nuowei918`
  - `Hoshea@soonai.sg / younghx123`
- 用户管理（建议使用 bcrypt 加密）：
  - 添加/更新：`sudo htpasswd -B /etc/nginx/.htpasswd_admin '<用户名>'`
  - 非交互添加：`sudo htpasswd -B -b /etc/nginx/.htpasswd_admin '<用户名>' '<密码>'`
  - 删除：`sudo htpasswd -D /etc/nginx/.htpasswd_admin '<用户名>'`
- 变更 Nginx 配置后：`sudo nginx -t && sudo systemctl reload nginx`

## 近期变更与关键逻辑（木质/金属）

- 上传与前端处理
  - 木质/金属图片前端一次性像素级二值化（降采样，最长边≤1200px，避免主线程卡顿）。
    - 木质用固定色 `#755723`（其余透明）；金属用金属灰（其余透明）。
    - 同一图片仅处理一次（dataset.processed 标记），防止重复触发。
  - 文本/形状颜色：木质固定 `#755723`；金属固定金属灰；用户不可修改颜色。
  - 重复选择同一文件会触发上传：在点击前与处理完成后都会将 `#fileInput.value=''` 重置。
  - 移除了所有前端叠加层：材质 Canvas 与木质元素竖纹伪元素，避免“竖纹透明蒙版”。

- 模板切换与元素保留
  - 切换模板会清空并重建 DOM，但会保留 `this.elements` 数据，不再因 DOM 暂时不存在而清理数据。
  - 半定制/金属/木质：背面禁编且不渲染元素（数据保留）；切回 PVC blank 后背面元素会重新出现。

- 导出（300/600 DPI）渲染
  - 木质/金属：导出的 PNG 背景透明（不绘制材质/模板背景），仅保留用户元素；金属正面 600DPI，其余 300DPI。
  - PVC：保持白底与模板/材质背景。

## 上线指令（请优先使用）

- 前端静态（保留 TLS，不改 Nginx）
  - `sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/shopify_dev FORCE_NGINX=false bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh`
  - 最小示例：
    - `scp -i Server/First.pem script.js ubuntu@54.251.114.224:/home/ubuntu/shopify_dev/script.js && \\
       ssh -i Server/First.pem ubuntu@54.251.114.224 'sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/shopify_dev FORCE_NGINX=false bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh'`
  - 验证与缓存穿透：
    - `curl -I https://design.soonai.sg`
    - `curl -sS "https://design.soonai.sg/script.js?ts=\$(date +%s)" | head -n 1`

- 后端（Server）
  - `scp -i Server/First.pem Server/server.js ubuntu@54.251.114.224:/home/ubuntu/shopify_dev/Server/server.js`
  - `ssh -i Server/First.pem ubuntu@54.251.114.224 'cd /home/ubuntu/shopify_dev/Server && npm install --production && sudo pm2 restart pvc-design-server && sudo pm2 save'`
  - 健康检查：`curl -sS https://design.soonai.sg/health`

- 注意事项
  - 不要轻易重写 Nginx 站点。若必须：`FORCE_NGINX=true` 同步后，执行 `sudo certbot --nginx -d design.soonai.sg --redirect` 恢复 HTTPS。
  - 500 排障：`sudo tail -n 200 /root/.pm2/logs/pvc-design-server-error.log`
