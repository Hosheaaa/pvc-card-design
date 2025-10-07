# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PVC Card Design Platform** - A web-based design tool for creating custom PVC cards with multi-language support and real-time editing capabilities.

## Key Architecture

### Directory Structure

#### Frontend Files (`frontend/`)
- **`index.html`** - Main HTML file for the card design interface
- **`style.css`** - Stylesheet for the design platform
- **`script.js`** - JavaScript functionality for the design platform
- **`AI/`** - Modular AI tools (zero‑mod integration)
  - `loader.js` – external loader that injects inline AI controls into Image properties panel
  - `core/` – AIManager, BaseAIService, utilities
  - `services/` – Background removal, Image expansion, Anime style transfer, Outline extraction (mock-enabled)
  - `ui/` – Processing modal only (no standalone AI panel)
  - `config/` – Feature flags and API endpoints (frontend uses backend proxy)
- **`Crop/`** - Image cropping functionality
- **`debug_qr.js`** - QR code debugging utilities
- **`package.json`** - Frontend dependencies

#### Server Files (`server/`)
- **`server.js`** - Main Node.js Express server with 300DPI image generation
- **`package.json`** - Dependencies and project configuration
- **`admin.html`** - Management interface for viewing and downloading designs
- **`print-guide.md`** - Complete printing production guide
- **`public-access-setup.md`** - Public access configuration documentation
- **`deploy.sh`** - Full server deployment script with Nginx and PM2
- **`upload.sh`** - File upload utility for server deployment
- **`connect.sh`** - SSH connection helper script
- **`setup.sh`** - Basic dependency installation script
- **`First.pem`** - AWS server private key (secure)
- **`ai/`** - AI service backend proxy routes
- **`designs/`** - Storage for design data JSON files
- **`high_res/`** - Storage for 300DPI generated images
- **`uploads/`** - Storage for user-uploaded files
- ⚠️ Production instance runs from `/var/www/pvc-card-server/server.js` (managed by `pm2` as `pvc-server`)
- ℹ️ `original_images/` in exported ZIPs may still include the most recent cropped variant if the frontend had no separate original reference
- ℹ️ Server code references assets and templates via relative paths: `../assets/` and `../templates/`

#### Assets (`assets/`)
- **`QR_Website.png`** - QR code image for PVC cards
- **`Metalsample.jpg`** - Metal material preview sample
- **`woodsample.jpg`** - Wood material preview sample
- **`wood/`** - Wood material related assets

#### Templates (`templates/`)
- **`PVC_templates/`** - Semi-custom template directory
  - `Blue_front.png`, `Blue_back.png` - Blue semi-custom template samples (front/back)
  - `Pink_front.png`, `Pink_back.png` - Pink semi-custom template samples (front/back)
  - `Metal_front.png`, `Metal_back.png` - Metal material template samples (front/back)
  - `Blank_template/` - Blank template backgrounds for semi-custom modes
    - `Blue_front.jpg`, `Blue_back.jpg` - Blue template blank backgrounds
    - `Pink_front.jpg`, `Pink_back.jpg` - Pink template blank backgrounds
    - `Metal.jpg`, `Metal_back.jpg` - Metal material blank backgrounds

#### Additional Directories
- **`backup/`** - Backup directory for stable versions
- **`Preview/`** - Preview functionality components

## AI Module – How to Use

Frontend (safe, zero‑mod):
- For local testing, add: `<script type="module" src="AI/loader.js"></script>` at the end of `index.html`.
- Feature flags: `AI/config/feature-flags.js` (development defaults to `mockApiCalls: true`).
- UI: Inline controls in the Image properties panel (4 tools: Portrait Cutout, Expand to Card Size, Anime Style, Outline Extraction). Image tab shows a small "AI+" badge. Texts auto‑adapt to page language (zh/en).
- Prompt strategy: No user prompt UI in frontend. The frontend injects fixed English prompts (no material/template context) via `AI/config/prompt-presets.js` for all four services (portrait cutout, expand to card size, anime style, outline extraction).
 - For image expansion, the prompt includes the exact pixel size of the current card preview (e.g., 1011×637), and `target_width/target_height` are sent as additional params to enforce output size.
- Data contract: AI results converted to DataURL to satisfy `addImageElement()` validation.

Backend (proxy required for real APIs):
- Implement proxy routes and inject API keys server-side:
  - `POST /api/ai/background-removal`
  - `POST /api/ai/gemini-outpaint`（扩图按钮 → Gemini）
  - `POST /api/ai/openai-image`（动漫化、扣轮廓 → OpenAI GPT-Image-1）

Progress UI:
- file:// mode uses a lightweight mock progress (title localized).
- http/https mode uses the full Processing Modal (Uploading / AI Processing / Done, localized).
- In production, set `mockApiCalls: false` and ensure the routes are available.

## Core Technologies

### Frontend
- **HTML5** - Semantic markup with data attributes for internationalization
- **CSS3** - Modern styling with Flexbox, Grid, and CSS variables
- **Vanilla JavaScript** - ES6+ features with class-based architecture
- **Canvas API** - For card rendering and design manipulation
- **File API** - For image upload and processing

### Backend
- **Node.js** - Backend JavaScript runtime
- **Express.js** - Web application framework
- **Canvas API (Node.js)** - Server-side image generation for 300DPI output
- **Multer** - File upload middleware with size limits and compression
- **PM2** - Process manager for production deployment
- **CORS** - Cross-origin resource sharing for public access
- **AWS EC2** - Cloud hosting on Ubuntu 22.04
- **Nginx** - Reverse proxy and static file serving (optional)

## Features

### PVC Card Design Platform Features
- **Multi-language Support** - English/Chinese with real-time switching
- **Material Selection** - PVC, Wood, Metal materials with visual previews and template-based rendering
- **Advanced Template System** - Multiple customization modes with material-specific templates:
  - **Full Customization** - Blank template with complete design freedom
  - **Semi-Customization** - PVC Blue/Pink templates with restricted editing (name, job title, logo only)
  - **Traditional Templates** - Business, Creative, Minimal templates for non-PVC materials
- **Material-Specific Behavior**:
  - **PVC Material** - Supports blank and semi-custom templates (blue/pink)
  - **Metal Material** - Front face engraving design, back face locked (plastic material)
  - **Wood Material** - Full customization with monochrome restrictions
- **Design Tools** - Image upload, text addition, shape creation with material-aware restrictions
- **Card Sides** - Front/back card design with independent content and side-specific restrictions
- **Real-time Preview** - Live preview of card design changes with template background rendering
- **Drag & Drop** - Interactive element positioning and resizing with upload blocking in restricted modes
- **Export/Save** - Design export and preview functionality
- **Responsive Design** - Works on desktop and mobile devices
- **Smart Restrictions** - Context-aware editing limitations and user guidance
- **QR Code Integration** - Automatic QR code addition for PVC full customization cards with proper 300DPI rendering

### Server Features
- **300DPI Image Generation** - Professional print-quality output (1011×637 pixels)
- **Material-aware Rendering** - Different rendering for PVC, Wood, Metal materials
- **Template Effects** - Server-side application of template gradients and effects
- **Automatic Image Compression** - Reduces upload size while maintaining quality
- **Design Data Storage** - JSON-based storage with complete design information
- **Real-time Management** - Live admin interface for production team
- **Batch Operations** - Download all designs or images in one operation
- **Public Access** - No authentication required for user submissions
- **Production Ready** - 24/7 uptime with PM2 process management
- **Scalable Architecture** - Handles multiple concurrent users and file uploads

## QR Code System

The PVC Card Design Platform includes an integrated QR code system specifically designed for PVC full customization cards. This system ensures proper QR code handling from frontend display to high-resolution print output.

### QR Code Architecture

**Frontend Implementation (`script.js`)**:
- QR codes are treated as special image elements with `type: 'image'` and `isQRCode: true` flags
- QR code elements are automatically added for PVC blank template selections
- QR codes have the highest z-index (9999) to prevent being covered by other elements
- Visual warning banner appears when QR code is missing from required cards
- QR code management panel provides add/remove functionality

**Backend Processing (`server.js`)**:
- QR codes are identified by `isQRCode: true` flag during 300DPI rendering
- Special QR code rendering logic handles multiple file path scenarios
- QR code elements receive highest priority (z-index 9999) in rendering order
- 300DPI QR codes are rendered at correct size and position for print production

### Key Files and Components

**QR Code Assets**:
- `assets/QR_Website.png` - Main QR code image file (referenced via `../assets/QR_Website.png` from frontend)
- QR code image should be high-resolution for optimal 300DPI output
- Backend accesses QR code at `path.join(__dirname, '..', 'assets', 'QR_Website.png')`

**Frontend Elements**:
- QR code tab in feature selector (`.qr-tab`)
- QR code status banner (`.qr-status-banner`)
- QR code management panel (`#qrcodeProperties`)
- QR code element styling (`.qr-element`)

**Backend Functions**:
- `renderElement()` - Main element rendering with QR code detection
- `renderImageElement()` - Handles QR code image loading and rendering
- QR code path resolution with fallback mechanisms

### Critical Implementation Details

**Data Structure**:
```javascript
// QR Code Element Structure
{
  type: 'image',
  isQRCode: true,
  id: 'qr_[timestamp]',
  src: '../assets/QR_Website.png',
  element: {
    style: {
      left: '300px',
      top: '200px',
      width: '80px',
      height: '80px',
      zIndex: '9999'
    }
  }
}
```

**Server Rendering Logic**:
- QR codes are processed during `generateHighResImages()` function
- QR code identification: `elementData.isQRCode || elementData.src === '../assets/QR_Website.png'`
- Path resolution: `path.join(__dirname, '..', 'assets', 'QR_Website.png')`
- Fallback paths: `../assets/QR_Website.png` → `server/QR_Website.png` (legacy) → relative paths
- Success verification: `✅ 成功渲染QR码元素` in server logs

### Troubleshooting Guidelines

**Common Issues**:
1. **QR Code Not Appearing in 300DPI**: Check `isQRCode` flag and file path resolution
2. **Missing QR Code File**: Ensure `QR_Website.png` exists in `assets/` directory
3. **Incorrect z-index**: Verify QR elements have `z-index: 9999` priority
4. **Element Type Mismatch**: Confirm QR elements have `type: 'image'` with `isQRCode: true`

**Debugging Steps**:
1. Check server logs for QR code processing messages
2. Verify QR code element data structure in browser console
3. Confirm QR code file accessibility on server
4. Test with admin.html preview functionality

**Required Conditions for QR Code Display**:
- Material: PVC
- Template: Blank (full customization mode)
- Element properly flagged with `isQRCode: true`
- QR code image file present on server

## Development Guidelines

### Metal Engraving (Unified Logic)

- Resolution: Metal front exports at 600 DPI (2022×1275). Others stay at 300 DPI.
- Processed elements: Only image elements on metal/front are binarized. Text and shapes render as metal gray per frontend; they are not binarized.
- Binarization rule (frontend = backend):
  - brightness = 0.299*R + 0.587*G + 0.114*B
  - If alpha > 10 AND brightness < 240 → set RGB=(196,196,196); keep alpha unchanged
  - Else (white/transparent) → set alpha=0 only; do not change RGB
  - Image smoothing is disabled during drawing to avoid interpolation artifacts.
- No fallback passes: Server no longer performs region or whole‑canvas fallback passes to avoid over‑processing.
- Packaging: `print_ready_300dpi/` contains print files; filenames include actual DPI suffix (e.g., `_front_600dpi.png`). `original_images/` only contains user‑uploaded originals.

### File Naming Conventions

- HTML files use kebab-case: `index.html`
- CSS files use kebab-case: `style.css`
- JavaScript files use kebab-case: `script.js`
- Server files use kebab-case: `server.js`
- Configuration files use kebab-case: `package.json`
- Shell scripts use kebab-case: `deploy.sh`, `upload.sh`
- Documentation files use kebab-case: `print-guide.md`
- Design files use timestamp format: `design_[timestamp]_[id].json`
- High-res images use format: `design_[timestamp]_[id]_[side]_300dpi.png`

### Code Organization

#### Frontend
- Single-page application structure
- Class-based JavaScript architecture (`CardDesigner` class)
- Modular CSS with component-based styling
- Internationalization through data attributes and translation objects

#### Backend
- Express.js application with modular route structure
- Canvas-based image generation with separate rendering functions
- File upload handling with Multer middleware
- Static file serving for frontend and generated images
- PM2 process management for production deployment
- Error handling middleware for upload and processing failures

### Maintenance and Testing

- **Use mcp to do website test** - Utilize mcp (manual content processing) for comprehensive website testing

#### QR Code Testing Protocol

**Frontend Testing**:
1. Select PVC material + Blank template
2. Verify QR code warning banner appears
3. Click "Add Now" to add QR code
4. Confirm QR code element appears with highest z-index
5. Test QR code management panel functionality
6. Verify QR code persists through card side switching

**Backend Testing**:
1. Submit design with QR code through frontend
2. Check server logs for QR code processing messages:
   - `🔍 处理元素类型: image, isQRCode: true`
   - `✅ 成功渲染QR码元素`
3. Verify 300DPI images are generated with QR codes
4. Use admin.html to preview generated images
5. Download and inspect 300DPI files for QR code presence

**Critical Test Cases**:
- PVC + Blank template (should show QR code)
- PVC + Semi-custom templates (should not show QR code)
- Non-PVC materials (should not show QR code)
- Multiple elements with QR code z-index priority
- QR code file missing scenarios (should show fallback)

### Important QR Code Implementation Notes

**⚠️ Critical Requirements**:
- QR code functionality is ONLY available for PVC material with Blank template
- QR code elements must maintain `type: 'image'` and `isQRCode: true` structure
- Server must have `QR_Website.png` in root directory for 300DPI rendering
- QR codes have mandatory z-index priority (9999) to prevent UI issues

**🔧 Implementation Dependencies**:
- Frontend: QR code CSS classes, management panels, warning banners
- Backend: Special rendering logic in `renderImageElement()` function
- Assets: High-resolution `QR_Website.png` file required
- Admin: Preview functionality depends on proper file generation

**📋 Maintenance Checklist**:
- [ ] QR code file exists and is accessible on server
- [ ] Frontend QR code management interface functional
- [ ] Backend logging shows successful QR code rendering
- [ ] Admin preview displays QR codes in 300DPI images
- [ ] Z-index hierarchy prevents QR code being covered

**🚫 Common Pitfalls to Avoid**:
- Never remove `isQRCode: true` flag from QR elements
- Don't modify QR code z-index without considering element hierarchy
- Avoid changing QR code file path without updating server logic
- Don't disable QR code tab for PVC blank template combinations

## Server Management

### PM2 Operations
- Use PM2 to manage server processes and deployments
- PM2 helps maintain 24/7 uptime and provides process monitoring
- Key PM2 commands for server management:
  - 使用PM2对服务器进行操作
    - 启动服务器进程：`pm2 start server.js`
    - 停止服务器进程：`pm2 stop server.js`
    - 重启服务器进程：`pm2 restart server.js`
    - 查看所有运行进程：`pm2 list`
    - 监控服务器性能：`pm2 monit`
    - 查看服务器日志：`pm2 logs`

## Production URLs

- Frontend: `https://design.soonai.sg`
- API base: `https://design.soonai.sg/api`
- Health: `https://design.soonai.sg/health`
- Admin (protected): `https://design.soonai.sg/admin.html`

Notes:
- Nginx serves static files from `/var/www/soonai` and proxies `/api` and `/health` to `127.0.0.1:3000`.
- PM2 process name: `pvc-design-server` (Node/Express on port 3000, localhost only).
- TLS via Let's Encrypt (auto-renew enabled), HTTP→HTTPS redirect enabled.

## Update Playbook (Ubuntu EC2)

Frontend update (static files)
- Recommended (preserve TLS, only sync static):
  - `sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/pvc-card-design FORCE_NGINX=false bash /home/ubuntu/pvc-card-design/server/ec2_config_design_subdomain.sh`
- Minimal copy + sync:
  - `scp -i server/First.pem frontend/script.js ubuntu@54.251.114.224:/home/ubuntu/pvc-card-design/frontend/script.js && \\
     ssh -i server/First.pem ubuntu@54.251.114.224 'sudo DOMAIN=design.soonai.sg PROJECT_DIR=/home/ubuntu/pvc-card-design FORCE_NGINX=false bash /home/ubuntu/pvc-card-design/server/ec2_config_design_subdomain.sh'`
- Verify:
  - `curl -I https://design.soonai.sg`
  - `curl -sS "https://design.soonai.sg/script.js?ts=$(date +%s)" | head -n 1` (cache bust)
Note: Avoid rewriting Nginx unless necessary. If you set `FORCE_NGINX=true`, run `sudo certbot --nginx -d design.soonai.sg --redirect` afterwards to restore HTTPS.

Backend update (Server)
- Upload/merge latest code to `/home/ubuntu/pvc-card-design`
- Install prod deps and restart process:
  - `cd /home/ubuntu/pvc-card-design/server && npm install --production`
  - `sudo pm2 restart pvc-design-server && sudo pm2 save`
- Verify health:
  - `curl -sS https://design.soonai.sg/health`

Nginx and TLS
- Site config: `/etc/nginx/sites-available/design.soonai.sg` (enabled via symlink)
- Reload Nginx after config changes: `sudo nginx -t && sudo systemctl reload nginx`
- Issue/renew TLS (manual reissue if needed):
  - `sudo certbot --nginx -d design.soonai.sg --redirect -m <your-email>`

## Current Logic (Wood/Metal)

- Frontend processing
  - Image binarization on upload (one-time, downscaled ≤1200px longest side):
    - Wood → color `#755723`, else transparent; Metal → metal gray, else transparent.
    - Prevent reprocess via `dataset.processed`; remove `onload` before replacing `src`.
  - Text/Shapes: fixed color (Wood `#755723`, Metal gray), user color inputs disabled.
  - Removed material canvas and wood striped pseudo-element to avoid overlays.
  - File input reset (`value=''`) before and after processing so reselecting the same file triggers `change`.

- Template switching
  - Elements persist in `this.elements`; DOM is torn down and rebuilt; validators no longer purge elements just because DOM is temporarily absent.
  - Semi‑custom/Metal/Wood back side: locked and not rendered (data retained); switching back to PVC blank restores rendering.

- Export (300/600 DPI)
  - Wood/Metal: transparent background (no material/template background drawn), only user elements; Metal front at 600DPI, others 300DPI.
  - PVC: white background with material/template as before.

## Troubleshooting
- 500 on submit: check PM2 logs (root): `sudo tail -n 200 /root/.pm2/logs/pvc-design-server-error.log`
- HTTPS issues after static sync: avoid rewriting Nginx; if rewritten, re-run `sudo certbot --nginx -d design.soonai.sg --redirect`.

Admin page & Basic Auth
- Admin page lives in webroot: `/var/www/soonai/admin.html`
- Basic Auth is enforced on `location = /admin.html`
- Credentials store: `/etc/nginx/.htpasswd_admin` (bcrypt)
- Manage users:
  - Add/Update: `sudo htpasswd -B /etc/nginx/.htpasswd_admin '<user>'`
  - Non‑interactive: `sudo htpasswd -B -b /etc/nginx/.htpasswd_admin '<user>' '<pass>'`
  - Delete: `sudo htpasswd -D /etc/nginx/.htpasswd_admin '<user>'`

DNS (GoDaddy)
- Subdomain A record: `design` → `54.251.114.224` (Elastic IP)
- Root domain `soonai.sg` remains pointing to its existing site

Client configuration
- `script.js` auto-detects environment:
  - In browser via domain → uses relative paths (`/api/...`)
  - Local file preview → falls back to `http://localhost:3000`
