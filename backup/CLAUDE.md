# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains two main projects:

1. **Shopify Theme "King"** (version 1.1.0) by Shine Dezign Infonet - A Liquid-based theme with modern JavaScript functionality and extensive customization options.

2. **PVC Card Design Platform** - A web-based design tool for creating custom PVC cards with multi-language support and real-time editing capabilities.

## Key Architecture

### Directory Structure

#### Shopify Theme Files
- **`assets/`** - Static assets (CSS, JS, images)
  - `theme.js` - Main JavaScript with DOM animations, GSAP integration
  - `theme.css` - Main stylesheet
  - Third-party libraries: GSAP, Swiper, ScrollTrigger, SplitText
- **`config/`** - Theme configuration
  - `settings_schema.json` - Theme customization schema
  - `settings_data.json` - Current theme settings
- **`layout/`** - Theme layout files
  - `theme.liquid` - Main layout template
- **`sections/`** - Reusable theme sections (header, footer, product sections, etc.)
- **`snippets/`** - Reusable code snippets
- **`templates/`** - Page templates for different content types
- **`locales/`** - Multi-language support files (40+ languages)

#### PVC Card Design Platform Files
- **`index.html`** - Main HTML file for the card design interface
- **`style.css`** - Stylesheet for the design platform
- **`script.js`** - JavaScript functionality for the design platform
- **`backup/`** - Backup directory for stable versions
- **`*.jpg`** - Sample images for material previews (Metalsample.jpg, woodsample.jpg)
- **`PVC_templates/`** - Semi-custom template directory
  - `Blue_front.png`, `Blue_back.png` - Blue semi-custom template samples (front/back)
  - `Pink_front.png`, `Pink_back.png` - Pink semi-custom template samples (front/back)
  - `Metal_front.png`, `Metal_back.png` - Metal material template samples (front/back)
  - `Blank_template/` - Blank template backgrounds for semi-custom modes
    - `Blue_front.jpg`, `Blue_back.jpg` - Blue template blank backgrounds
    - `Pink_front.jpg`, `Pink_back.jpg` - Pink template blank backgrounds
    - `Metal.jpg`, `Metal_back.jpg` - Metal material blank backgrounds

#### PVC Card Design Platform Server Files
- **`Server/`** - Backend server directory
  - `server.js` - Main Node.js Express server with 300DPI image generation
  - `package.json` - Dependencies and project configuration
  - `admin.html` - Management interface for viewing and downloading designs
  - `print-guide.md` - Complete printing production guide
  - `public-access-setup.md` - Public access configuration documentation
  - `deploy.sh` - Full server deployment script with Nginx and PM2
  - `upload.sh` - File upload utility for server deployment
  - `connect.sh` - SSH connection helper script
  - `setup.sh` - Basic dependency installation script
  - `First.pem` - AWS server private key (secure)
  - `designs/` - Storage for design data JSON files
  - `high_res/` - Storage for 300DPI generated images
  - `uploads/` - Storage for user-uploaded files

### Core Technologies

#### Shopify Theme
- **Liquid** - Shopify's templating language
- **GSAP** - Animation library with ScrollTrigger and SplitText plugins
- **Swiper.js** - Touch slider functionality
- **Vanilla JavaScript** - Custom DOM manipulation and animations

#### PVC Card Design Platform
- **HTML5** - Semantic markup with data attributes for internationalization
- **CSS3** - Modern styling with Flexbox, Grid, and CSS variables
- **Vanilla JavaScript** - ES6+ features with class-based architecture
- **Canvas API** - For card rendering and design manipulation
- **File API** - For image upload and processing

#### PVC Card Design Platform Server
- **Node.js** - Backend JavaScript runtime
- **Express.js** - Web application framework
- **Canvas API (Node.js)** - Server-side image generation for 300DPI output
- **Multer** - File upload middleware with size limits and compression
- **PM2** - Process manager for production deployment
- **CORS** - Cross-origin resource sharing for public access
- **AWS EC2** - Cloud hosting on Ubuntu 22.04
- **Nginx** - Reverse proxy and static file serving (optional)

### Features

#### Shopify Theme Features
- Multi-language support (40+ locales)
- Responsive design with mobile/desktop variants
- Header transparency options
- Advanced animation system using GSAP
- Modular section-based architecture
- Custom color schemes and typography
- Product customization and variants
- Cart drawer and quick view functionality

#### PVC Card Design Platform Features
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

#### PVC Card Design Platform Server Features
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

## Development Guidelines

### File Naming Conventions

#### Shopify Theme
- Liquid files use kebab-case: `main-collection.liquid`
- CSS/JS assets use kebab-case: `featured-products.css`
- Configuration files use snake_case: `settings_data.json`

#### PVC Card Design Platform
- HTML files use kebab-case: `index.html`
- CSS files use kebab-case: `style.css`
- JavaScript files use kebab-case: `script.js`
- Backup files maintain original naming with directory structure

#### PVC Card Design Platform Server
- Server files use kebab-case: `server.js`
- Configuration files use kebab-case: `package.json`
- Shell scripts use kebab-case: `deploy.sh`, `upload.sh`
- Documentation files use kebab-case: `print-guide.md`
- Design files use timestamp format: `design_[timestamp]_[id].json`
- High-res images use format: `design_[timestamp]_[id]_[side]_300dpi.png`

### Code Organization

#### Shopify Theme
- Each section has its own CSS file in `assets/`
- JavaScript functionality is centralized in `theme.js`
- Reusable components are in `snippets/`
- Page-specific logic in corresponding `templates/`

#### PVC Card Design Platform
- Single-page application structure
- Class-based JavaScript architecture (`CardDesigner` class)
- Modular CSS with component-based styling
- Internationalization through data attributes and translation objects

#### PVC Card Design Platform Server
- Express.js application with modular route structure
- Canvas-based image generation with separate rendering functions
- File upload handling with Multer middleware
- Static file serving for frontend and generated images
- PM2 process management for production deployment
- Error handling middleware for upload and processing failures

### Customization System

#### Shopify Theme
- Theme settings controlled via `config/settings_schema.json`
- Color schemes and typography defined in schema
- Section-level customization through individual section schemas
- Context variables rendered via `snippets/context-style-variables.liquid`

#### PVC Card Design Platform
- Language switching through `translations` object
- Material-specific styling and behavior
- Template-based design system
- Dynamic UI updates based on user selections

#### PVC Card Design Platform Server
- Material-aware rendering with different effects for PVC, Wood, Metal
- Template system with server-side gradient application
- Configurable image generation settings (DPI, dimensions, quality)
- Scalable file size limits and compression settings
- Environment-specific configuration (development vs production)

### Animation Architecture

#### Shopify Theme
- GSAP-based animation system with ScrollTrigger
- Custom `DOMAnimations` utility for slide effects
- Split text animations for typography effects
- Responsive animation handling

#### PVC Card Design Platform
- CSS transitions for smooth interactions
- 3D card flip animations using CSS transforms
- Drag and drop with mouse event handling
- Real-time preview updates

## Important Notes

### Shopify Theme
- This is a production Shopify theme - test changes thoroughly
- Multi-language support requires updating corresponding locale files
- GSAP library dependencies must be maintained for animations
- Header transparency system has complex logic for different page types
- Theme uses extensive Liquid templating - understand Shopify context variables

### PVC Card Design Platform
- Default language is English - use language toggle in top-right to switch to Chinese
- Material selection affects available templates and design options
- Metal material has special handling: front side supports engraving, back side is plastic
- Card switching uses simple CSS transforms - avoid complex 3D animations
- Backup directory contains stable versions for reference
- All text content is internationalized through data attributes
- Properties panel updates dynamically based on selected elements

### PVC Card Design Platform Server
- Server is hosted on AWS EC2 at IP address 13.214.160.245
- Uses PM2 process manager for production deployment and auto-restart
- Generates 300DPI images at 1011×637 pixels for professional printing
- Supports concurrent users with file upload limits (10MB per file, 5MB per field)
- Automatic image compression for files over 5MB
- All design data is stored in JSON format with complete element information
- High-resolution images are stored separately for easy production access
- Server runs 24/7 with automatic error recovery and logging

## PVC Card Design Platform Architecture

### Semi-Custom Template System (新功能)

#### Overview
The platform now supports a sophisticated semi-custom template system that provides different levels of customization based on material selection:

#### Template Categories
1. **Full Customization (Blank Template)**
   - Complete design freedom
   - Available for all materials
   - No restrictions on element placement or content

2. **Semi-Customization (PVC Blue/Pink Templates)**
   - Pre-designed templates with branded backgrounds
   - Restricted editing: users can only modify Name, Job Title, and Logo
   - Back side is completely locked (non-editable)
   - Template backgrounds loaded from `PVC_templates/Blank_template/`

3. **Traditional Templates (Business/Creative/Minimal)**
   - Available for non-PVC materials
   - Full customization within template framework

#### Material-Specific Template Logic
- **PVC Material**: Shows Blank, Blue Semi-Custom, Pink Semi-Custom
- **Wood/Metal Materials**: Shows only Blank template (restricted materials)
- **Other Materials**: Shows all traditional templates

#### Template Background Implementation
- **Semi-custom templates** use background images from `PVC_templates/Blank_template/`
- **Metal material** uses template backgrounds (`Metal.jpg`, `Metal_back.jpg`)
- **CSS-based rendering** removed for metal materials in favor of template images
- **Dynamic background loading** with immediate application (both front and back sides)

#### Key Technical Implementation
```javascript
// Semi-custom template application
applySemiCustomTemplate(template, side) {
    // Creates template-background div with image
    // Path: PVC_templates/Blank_template/{Template}_{side}.jpg
    // Applied to both front and back simultaneously for instant loading
}

// Material-specific template logic
updateTemplateRestrictions() {
    // Shows/hides templates based on selected material
    // PVC: blank, blue, pink
    // Restricted materials: blank only
    // Others: traditional templates
}
```

## Template Addition Guide

### Adding New Templates - Complete Workflow

When adding new templates to the system, the following files and functions need to be updated in **specific order**:

#### 1. **Template Image Files**
**Location**: `/PVC_templates/Blank_template/`
**Required files**:
```
{TemplateName}_front.jpg    // Front side background
{TemplateName}_back.jpg     // Back side background
```
**Naming convention**: CamelCase (e.g., `Blue_front.jpg`, `Pink_back.jpg`)
**Image optimization**: Compress large images to <200KB using:
```bash
sips -Z 2000 --setProperty format jpeg --setProperty formatOptions 70 original.jpg --out compressed.jpg
```

#### 2. **Frontend Template Selection (HTML)**
**File**: `index.html`
**Location**: Template grid section (around line 160-175)
**Add**:
```html
<div class="template-item pvc-only" data-template="newtemplate">
    <div class="template-preview newtemplate"></div>
    <span data-translate="template-newtemplate">New Template Name</span>
</div>
```

#### 3. **Frontend Template Logic (JavaScript)**
**File**: `script.js`
**Functions to update**:

**a) Template restrictions**:
```javascript
updateTemplateRestrictions() {
    // Add new template to PVC-only list
    if (this.currentMaterial === 'pvc') {
        pvcOnlyItems.forEach(item => item.style.display = 'block');
        // New template shown for PVC material
    }
}
```

**b) Semi-custom template application**:
```javascript
applySemiCustomTemplate(template, side) {
    // Path generation automatically handles new templates:
    // PVC_templates/Blank_template/${template.charAt(0).toUpperCase() + template.slice(1)}_${side}.jpg
    // No changes needed if following naming convention
}
```

**c) Translation support**:
```javascript
// Add to translations object
translations.en['template-newtemplate'] = 'New Template Name';
translations.zh['template-newtemplate'] = '新模板名称';
```

#### 4. **Backend 300DPI Rendering (Server)**
**File**: `server.js`
**Function**: `applyTemplateEffect(ctx, template, side, width, height)`
**Add support**:
```javascript
case 'newtemplate':
    // Semi-custom templates are handled automatically by the blue/pink case
    // Path: PVC_templates/Blank_template/{Template}_{side}.jpg
    // No additional code needed if following the pattern
    break;
```

**Note**: If the new template follows the blue/pink pattern, it's automatically supported by the existing `case 'blue': case 'pink':` block.

#### 5. **CSS Styling (Optional)**
**File**: `style.css`
**Add template preview styles**:
```css
.template-preview.newtemplate {
    background: linear-gradient(135deg, #color1, #color2);
    /* or background-image: url('preview-image.jpg'); */
}
```

#### 6. **Deployment Checklist**
**Required steps in order**:
1. **Copy template images** to `Server/PVC_templates/Blank_template/`
2. **Update files**: Copy `index.html`, `script.js`, `style.css` to `Server/` and `backup/`
3. **Upload to production**:
   ```bash
   scp -i First.pem PVC_templates/Blank_template/{Template}_*.jpg ubuntu@13.214.160.245:/home/ubuntu/Server/PVC_templates/Blank_template/
   scp -i First.pem index.html script.js style.css server.js ubuntu@13.214.160.245:/home/ubuntu/Server/
   ```
4. **Restart server**: `pm2 restart pvc-card-server`

#### 7. **Testing Requirements**
After deployment, test:
- **Template selection**: Appears in PVC material mode
- **Background loading**: Both front/back sides display correctly
- **Cache busting**: Template images load with timestamp parameters
- **300DPI generation**: Server logs show template loading success
- **File size validation**: 300DPI images significantly larger (indicating template inclusion)
- **Admin interface**: Both user design and 300DPI versions show template

#### 8. **Common Issues and Solutions**

**Template not showing**:
- Check `pvc-only` class in HTML
- Verify `updateTemplateRestrictions()` logic
- Check template image file names match exactly

**Images not loading**:
- Verify file paths and naming convention
- Check file permissions on server
- Clear browser cache with timestamp parameters

**300DPI missing template**:
- Check `applyTemplateEffect()` includes new template case
- Verify template image paths in server code
- Check server logs for image loading errors

**Large file uploads failing**:
- Compress template images < 200KB
- Check multer file size limits (currently 50MB)
- Monitor total upload size (design + template images)

#### 9. **File Size Optimization**
**Template images** should be compressed to prevent upload failures:
- **Target size**: < 200KB per image
- **Quality**: JPEG 70% quality sufficient for templates  
- **Dimensions**: Max 2000px width/height
- **Compression command**:
  ```bash
  sips -Z 2000 --setProperty format jpeg --setProperty formatOptions 70 input.jpg --out output.jpg
  ```

This optimization reduced template file sizes from 31-33MB to 140-147KB (99.5% reduction) while maintaining visual quality.

#### User Experience Enhancements
- **Immediate Loading**: Templates display instantly upon selection
- **Visual Restrictions**: Drop-zone messages hidden in restricted modes
- **Smart Warnings**: Context-aware user guidance for different modes
- **Multi-language Support**: All semi-custom features support English/Chinese

### Core Classes and Structure
- **`CardDesigner`** - Main application class handling all functionality with semi-custom support
- **`translations`** - Global object containing English/Chinese text translations (updated with semi-custom terms)
- **Material System** - PVC, Wood, Metal materials with template-specific properties and restrictions
- **Enhanced Template System** - Blank, Blue/Pink Semi-Custom, Business, Creative, Minimal templates
- **Element System** - Text, Image, Shape elements with smart restrictions in semi-custom mode

### Key Methods
- **`switchSide()`** - Handles front/back card switching
- **`selectMaterial()`** - Material selection and template restriction logic
- **`updateLanguage()`** - Language switching functionality
- **`updateMaterialWarnings()`** - Context-aware warning system
- **`updatePropertiesPanel()`** - Dynamic property editor

### File Structure
```
index.html - Main interface with data-translate attributes
style.css - Component-based styling with material effects
script.js - Single-file application with class-based architecture
backup/ - Stable versions for reference
```

### Language System
- Uses `data-translate` attributes for static text
- Dynamic text through `getText()` method
- Real-time language switching affects all UI elements
- Contextual warnings based on material and side selection

## Production Server Information

### Public Access URLs
- **User Design Platform**: `http://13.214.160.245:3000`
  - Public interface for creating PVC card designs
  - No authentication required - anyone can access and submit designs
  - Responsive design works on desktop and mobile devices
  - Multi-language support (English/Chinese)
  
- **Management Interface**: `http://13.214.160.245:3000/admin.html`
  - Production team interface for managing designs
  - View all user submissions in real-time
  - Download 300DPI images for printing
  - Batch operations and statistics

### Server Configuration
- **AWS EC2 Instance**: Ubuntu 22.04 LTS
- **Server IP**: 13.214.160.245
- **Port**: 3000 (HTTP)
- **Process Manager**: PM2 with auto-restart
- **Storage**: Local filesystem with organized directory structure
- **Backup**: Daily automatic backups recommended

### API Endpoints
- `GET /` - Main design interface
- `GET /admin.html` - Management interface
- `POST /api/submit-design` - Submit new design data
- `GET /api/designs` - List all designs
- `GET /api/designs/:id` - Get specific design
- `GET /api/stats` - Server statistics
- `GET /api/export/designs` - Export all designs
- `GET /high-res/:filename` - Download high-resolution images

### File Management
- **Design Data**: `/home/ubuntu/Server/designs/` (JSON files)
- **High-Resolution Images**: `/home/ubuntu/Server/high_res/` (PNG files, 300DPI)
- **User Uploads**: `/home/ubuntu/Server/uploads/` (Original uploaded files)
- **Logs**: PM2 logs available via `pm2 logs pvc-card-server`

### Deployment and Maintenance
- **Deploy Script**: `./deploy.sh` - Full server setup with dependencies
- **Upload Script**: `./upload.sh` - Upload files to server
- **Connect Script**: `./connect.sh` - SSH connection to server
- **Server Restart**: `ssh -i First.pem ubuntu@13.214.160.245 "pm2 restart pvc-card-server"`
- **Server Status**: `ssh -i First.pem ubuntu@13.214.160.245 "pm2 status"`

### Security and Access
- **Public Access**: No authentication required for design submissions
- **Management Access**: Admin interface is publicly accessible (consider adding authentication for production)
- **File Security**: All uploaded files are stored securely on server
- **SSL**: Currently HTTP only (HTTPS setup recommended for production)

### Production Workflow
1. **User Submission**: Users create designs at `http://13.214.160.245:3000`
2. **Design Storage**: Server automatically saves design data and generates 300DPI images
3. **Production Access**: Production team uses `http://13.214.160.245:3000/admin.html`
4. **Image Download**: Download high-resolution images for printing
5. **Quality Control**: Follow print-guide.md for production specifications