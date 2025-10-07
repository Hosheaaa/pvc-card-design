# PVC Card Design Platform

A professional web-based design tool for creating custom PVC, Wood, and Metal cards with multi-language support and real-time editing capabilities.

## Project Structure

```
pvc-card-design/
├── frontend/           # Frontend application
│   ├── index.html     # Main application interface
│   ├── script.js      # Core application logic
│   ├── style.css      # Styling
│   ├── AI/            # AI-powered features (background removal, expansion, etc.)
│   └── Crop/          # Image cropping functionality
│
├── server/            # Backend server
│   ├── server.js      # Express server with 300DPI/600DPI image generation
│   ├── admin.html     # Admin interface for design management
│   ├── deploy.sh      # Deployment automation script
│   └── First.pem      # AWS server key (keep secure!)
│
├── assets/            # Static assets
│   ├── QR_Website.png # QR code for PVC cards
│   └── *.jpg          # Material preview samples
│
├── templates/         # Card templates
│   └── PVC_templates/ # PVC template collection
│
└── backup/            # Backup versions

```

## Quick Start

### Local Development

1. **Frontend** (file:// mode):
   - Open `frontend/index.html` in a browser
   - Design tools work immediately
   - AI features use mock mode by default

2. **Backend** (for full features):
   ```bash
   cd server
   npm install
   node server.js
   ```
   - Server runs on http://localhost:3000
   - Admin interface: http://localhost:3000/admin.html

### Production Deployment

See `server/deploy.sh` for automated deployment to AWS EC2.

**Production URL**: https://design.soonai.sg

## Key Features

- **Multi-Material Support**: PVC, Wood, Metal with material-specific rendering
- **Template System**: Full customization, semi-custom templates, traditional templates
- **AI Tools**: Background removal, image expansion, anime style, outline extraction
- **300/600 DPI Export**: Professional print-quality output
- **Multi-Language**: English/Chinese real-time switching
- **QR Code Integration**: Automatic QR code for PVC blank templates

## Documentation

- `CLAUDE.md` - Complete technical documentation and architecture guide
- `server/print-guide.md` - Production printing guide
- `server/public-access-setup.md` - Deployment and configuration guide

## Server Management

### PM2 Commands (Production)
```bash
pm2 list                    # View running processes
pm2 logs pvc-design-server  # View server logs
pm2 restart pvc-design-server # Restart server
```

### Deployment
```bash
# Update frontend files
scp -i server/First.pem frontend/script.js ubuntu@54.251.114.224:/home/ubuntu/pvc-card-design/frontend/

# Update backend
ssh -i server/First.pem ubuntu@54.251.114.224
cd /home/ubuntu/pvc-card-design/server
npm install --production
pm2 restart pvc-design-server
```

## Technology Stack

### Frontend
- Vanilla JavaScript (ES6+)
- HTML5 Canvas API
- CSS3 (Flexbox, Grid)
- Class-based architecture

### Backend
- Node.js + Express
- Canvas (node-canvas) for 300/600DPI rendering
- Multer for file uploads
- PM2 for process management

### Infrastructure
- AWS EC2 (Ubuntu 22.04)
- Nginx reverse proxy
- Let's Encrypt SSL/TLS
- GoDaddy DNS

## License

Proprietary - SoonAI Singapore
