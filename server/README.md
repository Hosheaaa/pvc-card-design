# PVC Card Design Server

这是一个用于收集和处理PVC卡片设计数据的Node.js后端服务器。

## 功能特性

- ✅ 接收用户设计数据（正面和背面）
- ✅ 生成300DPI高分辨率图片用于打印
- ✅ 支持多种材质（PVC、木质、金属）
- ✅ 支持多种模板（空白、商务、创意、简约）
- ✅ 用户信息收集
- ✅ 设计数据持久化存储
- ✅ RESTful API接口
- ✅ 跨域支持
- ✅ 文件上传处理
- ✅ 健康检查端点

## 系统要求

- Node.js 14.0+ 
- npm 6.0+
- 支持Canvas的系统（用于图片生成）
- 至少2GB RAM
- 至少10GB磁盘空间

## 快速开始

### 1. 文件上传到服务器

```bash
# 上传所有文件到服务器
./upload.sh
```

### 2. 连接到服务器

```bash
# 连接到AWS服务器
./connect.sh
```

### 3. 设置服务器

```bash
# 进入服务器目录
cd /home/ubuntu/Server

# 简单设置（仅安装依赖）
./setup.sh

# 完整部署（包含Nginx、PM2等）
sudo ./deploy.sh
```

### 4. 启动服务器

```bash
# 开发模式
npm run dev

# 生产模式（本地直接跑）
npm start

# 使用 PM2（推荐生产）
# 在仓库根目录或 Server 目录下：
pm2 start Server/server.js --name pvc-design-server
pm2 save
```

> ⚠️ **生产环境路径重点说明**
>
> - 仓库副本：`/home/ubuntu/shopify_dev/Server/server.js`
> - 实际运行：`/var/www/pvc-card-server/server.js`，由 `pm2` 以 `pvc-server` 名称管理
>
> 更新流程：先在仓库路径确认代码，然后将 `server.js` 同步到 `/var/www/pvc-card-server/`，最后执行 `pm2 restart pvc-server && pm2 save`。两处文件需保持一致，否则会出现“代码已改但线上无更新”的情况。

## 线上信息与 API 端点

### 生产访问地址（EC2 / Ubuntu / Nginx）
- 前端：`https://design.soonai.sg`
- API 前缀：`https://design.soonai.sg/api`
- 健康检查：`https://design.soonai.sg/health`

### 健康检查
```
GET /health
```
返回服务器健康状态

### 提交设计
```
POST /api/submit-design
Content-Type: multipart/form-data

Body:
- designData: JSON字符串，包含设计数据
- images: 可选的图片文件
```

### 获取设计列表
```
GET /api/designs
```
返回所有设计的列表

### 获取特定设计
```
GET /api/designs/:id
```
返回指定ID的设计详情

## 文件结构

```
Server/
├── ai/                 # AI 功能路由与第三方服务封装
├── server.js           # 主服务器文件
├── package.json        # 项目依赖
├── deploy.sh          # 完整部署脚本
├── setup.sh           # 简单设置脚本
├── connect.sh         # SSH连接脚本
├── upload.sh          # 文件上传脚本
├── README.md          # 说明文档
├── uploads/           # 上传的图片文件
├── designs/           # 设计数据JSON文件
├── high_res/          # 300DPI高分辨率图片
└── logs/              # 日志文件

### 完整下载包结构
- `${designId}_data.json`：原始设计数据（含元素、AI 元数据）
- `original_images/`：用户上传的原始素材（若未上传则会回填 base64 原图）
- `preview_images/`：提交流程中生成的预览图
- `print_ready_300dpi/`：高分辨率打印图（正面/背面）
- `ai_generated/`：AI 功能输出的素材（按服务命名，例如 `front_backgroundRemoval_1.png`）

> ℹ️ **已知限制**：在部分快速裁剪/替换场景下，前端会把裁剪后的结果视为“最新原图”一并提交，导致 `original_images/` 目录出现裁剪版本。若需严格保留最初上传的原图，请在裁剪前备份，或在提交表单时附带原始文件。

## AI 集成（后端代理）

为保证安全与跨域，前端不会直接请求第三方 AI 服务。请在后端实现以下代理路由，并在服务器环境变量中配置各自 API 密钥：

- `POST /api/ai/background-removal` → 代理 Remove.bg 或等价服务（人像抠图，透明背景）
- `POST /api/ai/gemini-outpaint` → 代理 Google Gemini `gemini-2.5-flash-image-preview`（扩图专用）
- `POST /api/ai/openai-image` → 代理 OpenAI GPT-Image-1（动漫化、扣轮廓等需要蒙版与 JSON 响应的流程）

实现要点：
- 从前端接收图片文件和参数（multipart/form-data 或 JSON+base64），在服务端注入 Authorization/Token 调用第三方 API；
- 统一返回图片 Blob 或可下载的 URL；
- 错误透传（包含 status 与 message），便于前端展示；
- 限制上传大小与并发，避免滥用；
- 日志记录耗时与配额信息。

### 背景移除代理配置
- 环境变量 `REMOVE_BG_API_KEY`：必填，用于访问 remove.bg。
- 环境变量 `REMOVE_BG_API_URL`（可选）：默认 `https://api.remove.bg/v1.0/removebg`，如需自定义端点可以覆盖。
- 接口返回值：成功时直接返回 remove.bg 的二进制 PNG；失败时返回 `{ success: false, error, details }` JSON。

### Gemini 图像扩展配置
- 环境变量 `GEMINI_API_KEY`：必填，用于访问 Google Generative Language API。
- 环境变量 `GEMINI_IMAGE_MODEL`（可选）：默认 `gemini-2.5-flash-image-preview`。
- 返回结果会在服务端根据目标卡片比例进行居中裁剪后再输出 PNG，额外元数据会编码在响应头 `X-Outpaint-Metadata` 中。

### OpenAI 图像（动漫/轮廓）配置
- 环境变量 `OPENAI_API_KEY`：必填，用于访问 GPT-Image-1。
- 环境变量 `OPENAI_ORG_ID`（可选）：指定 OpenAI 组织 ID。
- 环境变量 `GPT_IMAGE_MODEL`（可选）：默认 `gpt-image-1`。
- 支持附加参数：`target_width`、`target_height`、`background_mode` 等，用于控制遮罩及输出尺寸。

### 代码结构
- 所有 AI 相关路由统一在 `ai/index.js` 中注册（前缀 `/api/ai`）。
- 具体路由位于 `ai/routes/`，例如背景移除实现 `routes/backgroundRemoval.js`。
- 第三方调用封装在 `ai/services/`，例如 remove.bg 客户端 `services/removeBgClient.js`，便于复用和单元测试。

国际化提示：前端的处理进度与按钮文本会根据页面语言（zh/en）自动切换。

前端对接方式：
- 端点配置在 `AI/config/api-endpoints.js`，均指向 `/api/ai/*`。
- 开发模式默认 `mockApiCalls: true`，无需后端也能演示流程；生产请关闭 mock 并提供上述路由。
```

## 服务器配置（生产）

### 端口配置
- Node/Express 本地端口：3000（仅本机访问）
- Nginx：80（HTTP），443（HTTPS）
- SSH：22

### 防火墙配置
```bash
# 允许的端口
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
# 不对公网开放 3000（仅本机通过 Nginx 反代访问）
```

### Nginx 配置
- 站点文件：`/etc/nginx/sites-available/design.soonai.sg`（已在 `sites-enabled/` 启用）
- 静态根目录：`/var/www/soonai`（包含 `index.html`、`script.js`、`style.css`、`assets/`、`PVC_templates/`）
- 反向代理：`/api` 与 `=/health` → `http://127.0.0.1:3000`
- 上传限制：`client_max_body_size 100M`
- HTTPS：已通过 Certbot 配置，开启 HTTP→HTTPS 重定向与自动续期

配置示意（片段）：
```
server {
    listen 80;
    server_name design.soonai.sg;
    root /var/www/soonai;
    index index.html;
    client_max_body_size 100M;
    location / { try_files $uri /index.html; }
    location /api { proxy_pass http://127.0.0.1:3000; }
    location = /health { proxy_pass http://127.0.0.1:3000/health; }
    # 管理后台受保护页面
    location = /admin.html {
        auth_basic "Restricted";
        auth_basic_user_file /etc/nginx/.htpasswd_admin;
    }
}
```

## 图片处理

### 分辨率
- 金属材质正面：600 DPI（2022×1275 px）
- 其他材质与背面：300 DPI（1011×637 px）
- 输出格式：PNG（文件名带实际 DPI 后缀，如 `_front_600dpi.png`）

### 金属材质前后端统一的雕刻逻辑
- 仅对“金属材质的正面”上的“图片元素”进行像素级处理；文本与形状不做二值化。
- 二值规则（前端=后端）：
  - brightness = 0.299R + 0.587G + 0.114B
  - 若 alpha > 10 且 brightness < 240 → 将该像素 RGB 设为金属灰 (196,196,196)，alpha 保持不变
  - 否则（白/透明）→ 仅将 alpha 设为 0，不修改 RGB
- 绘制阶段禁用图片插值（imageSmoothingEnabled=false），避免缩放插值引入过渡色。
- 不再对整张画布或图片区域执行“兜底”二次处理，避免过度处理导致整块发灰。

### 支持的材质效果
- **PVC**: 标准白色背景
- **木质**: 木纹纹理效果
- **金属**: 金属渐变效果

## 监控和管理

### 查看服务状态
```bash
./status.sh
```

### PM2 管理命令
```bash
# 查看进程状态
pm2 status

# 查看日志
pm2 logs pvc-design-server

# 重启服务
pm2 restart pvc-design-server && pm2 save

# 停止服务
pm2 stop pvc-design-server && pm2 delete pvc-design-server
```

## 管理后台（Admin）

- 地址（需认证）：`https://design.soonai.sg/admin.html`
- 文件位置：`/var/www/soonai/admin.html`
- 认证方式：Nginx Basic Auth（`location = /admin.html`）
- 认证文件：`/etc/nginx/.htpasswd_admin`（bcrypt）
- 用户管理：
  - 添加/更新用户：`sudo htpasswd -B /etc/nginx/.htpasswd_admin '<用户名>'`
  - 非交互添加：`sudo htpasswd -B -b /etc/nginx/.htpasswd_admin '<用户名>' '<密码>'`
  - 删除用户：`sudo htpasswd -D /etc/nginx/.htpasswd_admin '<用户名>'`
  - 修改 Nginx 配置后重载：`sudo nginx -t && sudo systemctl reload nginx`

### 日志文件
- 合并日志: `logs/combined.log`
- 输出日志: `logs/out.log`
- 错误日志: `logs/error.log`

## 数据存储

### 设计数据格式
```json
{
  "id": "design_1234567890_abc123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "material": "pvc",
  "template": "business",
  "elements": {
    "front": [...],
    "back": [...]
  },
  "customerInfo": {
    "name": "Customer Name",
    "email": "customer@example.com",
    "phone": "123456789",
    "notes": "Special requirements"
  },
  "highResImages": {
    "front": "design_1234567890_abc123_front_300dpi.png",
    "back": "design_1234567890_abc123_back_300dpi.png"
  }
}
```

## 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 检查端口使用情况
   lsof -i :3000
   
   # 终止占用端口的进程
   kill -9 <PID>
   ```

2. **Canvas依赖问题**
   ```bash
   # Ubuntu/Debian
   sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
   
   # CentOS/RHEL
   sudo yum install cairo-devel pango-devel libjpeg-turbo-devel giflib-devel librsvg2-devel
   ```

3. **权限问题**
```bash
# 设置正确的文件权限
sudo chown -R www-data:www-data /var/www/soonai
chmod -R 755 /var/www/soonai
```

4. **内存不足**
   ```bash
   # 创建交换文件
   sudo dd if=/dev/zero of=/swapfile bs=1024 count=2048000
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

### 日志分析
```bash
# 查看实时日志
tail -f logs/combined.log

# 查看错误日志
tail -f logs/error.log

# 查看系统日志
journalctl -u nginx -f
```

## 安全建议

1. **定期更新系统**
   ```bash
   sudo apt update && sudo apt upgrade
   ```

2. **配置 SSL 证书**
```bash
# 使用Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d design.soonai.sg --redirect -m <your-email>
```

3. **限制访问**
   - 配置防火墙规则
   - 使用VPN或IP白名单
   - 定期更新密钥

4. **备份数据**
   ```bash
   # 定期备份设计数据
   tar -czf backup_$(date +%Y%m%d).tar.gz designs/ high_res/
   ```

## 性能优化

### 推荐配置
- CPU: 2核心以上
- RAM: 4GB以上
- 磁盘: SSD 20GB以上
- 网络: 10Mbps以上

### 集群模式
服务器支持PM2集群模式，可以充分利用多核CPU：
```bash
pm2 start Server/server.js -i max --name pvc-design-server && pm2 save
```

## 部署与更新流程（Ubuntu EC2）

### 一键初始化/同步（已创建脚本）
```
sudo DOMAIN=design.soonai.sg bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh
```

### 更新前端（静态）
```
scp -r index.html script.js style.css assets PVC_templates \
  ubuntu@54.251.114.224:/var/www/soonai/
sudo nginx -t && sudo systemctl reload nginx
```

### 更新后端（Server）
```
ssh ubuntu@54.251.114.224
cd /home/ubuntu/shopify_dev/Server
npm install --production
sudo pm2 restart pvc-design-server && sudo pm2 save
```

### 验证
```
curl -I https://design.soonai.sg
curl -sS https://design.soonai.sg/health
```

### DNS（GoDaddy）
- 子域 A 记录：`design` → `54.251.114.224`（Elastic IP）
- 主域 `soonai.sg` 继续指向其现有网站

### 客户端说明
- `script.js` 已自动根据环境选择：
  - 通过域名访问：使用相对路径 `/api/...`（由 Nginx 反代到 3000）
  - 本地 file:// 预览：回退 `http://localhost:3000`

## 联系信息

如有问题或建议，请联系开发团队。

---

© 2024 PVC Card Design Platform
## Deployment (AWS EC2 Ubuntu)

Frontend (static)
- Sync static files from repo to Nginx webroot without touching TLS:
  - `sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/shopify_dev FORCE_NGINX=false bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh`
- Minimal update example (script.js only):
  - `scp -i Server/First.pem script.js ubuntu@54.251.114.224:/home/ubuntu/shopify_dev/script.js && \\
     ssh -i Server/First.pem ubuntu@54.251.114.224 'sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/shopify_dev FORCE_NGINX=false bash /home/ubuntu/shopify_dev/Server/ec2_config_design_subdomain.sh'`
- Verify:
  - `curl -I https://design.soonai.sg`
  - `curl -sS "https://design.soonai.sg/script.js?ts=$(date +%s)" | head -n 1`
- Note: Only set `FORCE_NGINX=true` when you knowingly want to rewrite the site file; then run `sudo certbot --nginx -d design.soonai.sg --redirect` to restore HTTPS.

Backend (Node/PM2)
- Install dependencies and restart:
  - `cd /home/ubuntu/shopify_dev/Server && npm install --production`
  - `sudo pm2 restart pvc-design-server && sudo pm2 save`
- Health check:
  - `curl -sS https://design.soonai.sg/health`

## Current Business Rules (Wood/Metal)

- Frontend
  - Image binarization (one-time, downscaled ≤1200px): Wood → `#755723`, Metal → metal gray; other pixels transparent.
  - Text/Shapes: fixed color (Wood `#755723`, Metal gray), color inputs disabled.
  - No overlay layers: material canvas and wood striped pseudo-element removed.
  - File input reset to allow re-uploading the same file.

- Template switching
  - Elements are preserved in data; DOM is rebuilt; validators do not purge data just because DOM nodes are temporarily absent.
  - Semi‑custom/Metal/Wood back side: locked and not rendered (data retained); switching back to PVC blank restores back elements.

- Server export (300/600 DPI)
  - Wood/Metal: transparent background (no material/template background), only user elements; Metal front at 600DPI, others 300DPI.
  - PVC: white background with template/material background as before.

## Troubleshooting

- 500 on submit/generation
  - Check PM2 logs: `sudo tail -n 200 /root/.pm2/logs/pvc-design-server-error.log`
  - Common fix: missing shape properties → defaults applied in `renderShapeElement`.

- HTTPS becomes inaccessible after static sync
  - Use `FORCE_NGINX=false` to avoid rewriting site config.
  - If rewritten, re-issue TLS: `sudo certbot --nginx -d design.soonai.sg --redirect`.
