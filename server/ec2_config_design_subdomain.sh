#!/usr/bin/env bash
set -euo pipefail

# EC2 Ubuntu one‑shot setup for design.soonai.sg
# - Serves static front-end from Nginx
# - Proxies /api and /health to Node (Server/server.js on :3000)
# - Preps for Certbot TLS (run certbot after this script)

# ---- Config ----
DOMAIN=${DOMAIN:-"design.soonai.sg"}
WEB_ROOT=${WEB_ROOT:-"/var/www/soonai"}
PROJECT_DIR=${PROJECT_DIR:-"$PWD"}
SERVICE_NAME=${SERVICE_NAME:-"pvc-design-server"}
INCLUDE_WWW=${INCLUDE_WWW:-"false"}   # true to also answer www.design.soonai.sg
# If site file already exists and FORCE_NGINX!=true, preserve existing Nginx config (incl. TLS) and skip rewriting
FORCE_NGINX=${FORCE_NGINX:-"false"}

echo "Config:" 
echo "  DOMAIN       = $DOMAIN"
echo "  WEB_ROOT     = $WEB_ROOT"
echo "  PROJECT_DIR  = $PROJECT_DIR"
echo "  SERVICE_NAME = $SERVICE_NAME"
echo "  INCLUDE_WWW  = $INCLUDE_WWW"
echo "  FORCE_NGINX  = $FORCE_NGINX"

if [[ $(id -u) -ne 0 ]]; then
  echo "Please run with sudo: sudo DOMAIN=$DOMAIN bash $0" >&2
  exit 1
fi

echo "Updating apt and installing prerequisites..."
apt-get update -y
apt-get install -y nginx curl jq unzip

# Optionally install Node.js (if not present)
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 18..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing pm2..."
  npm i -g pm2
fi

echo "Preparing web root at $WEB_ROOT ..."
mkdir -p "$WEB_ROOT"

echo "Syncing static frontend to $WEB_ROOT ..."
# Copy frontend files from frontend/ directory
rsync -a --delete \
  "$PROJECT_DIR/frontend/index.html" \
  "$PROJECT_DIR/frontend/script.js" \
  "$PROJECT_DIR/frontend/style.css" \
  "$WEB_ROOT/" 2>/dev/null || true

# Copy assets and templates directories (referenced by frontend as ../assets and ../templates)
rsync -a "$PROJECT_DIR/assets" "$WEB_ROOT/" 2>/dev/null || true
rsync -a "$PROJECT_DIR/templates" "$WEB_ROOT/" 2>/dev/null || true

# AI 前端资源（模块加载器等）
rsync -a "$PROJECT_DIR/frontend/AI" "$WEB_ROOT/" 2>/dev/null || true
rsync -a "$PROJECT_DIR/frontend/Crop" "$WEB_ROOT/" 2>/dev/null || true

SITE_FILE="/etc/nginx/sites-available/$DOMAIN"
if [[ -f "$SITE_FILE" && "$FORCE_NGINX" != "true" ]]; then
  echo "Preserving existing Nginx site config ($SITE_FILE). Skipping rewrite to avoid breaking TLS."
else
  echo "Writing Nginx site for $DOMAIN ..."
  SERVER_NAMES=$DOMAIN
  if [[ "$INCLUDE_WWW" == "true" ]]; then
    SERVER_NAMES="$DOMAIN www.$DOMAIN"
  fi

  cat >"$SITE_FILE" <<NGINX
server {
    listen 80;
    server_name $SERVER_NAMES;

    # Increase upload limit for form-data
    client_max_body_size 100M;

    root $WEB_ROOT;
    index index.html;

    # Static frontend
    location / {
        try_files \$uri /index.html;
    }

    # Proxy API to Node on 127.0.0.1:3000
    location /api {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 300;
    }

    # Health check to backend
    location = /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host \$host;
    }
}
NGINX

  ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  systemctl enable nginx
fi

echo "Starting backend with pm2 ..."
pm2 describe "$SERVICE_NAME" >/dev/null 2>&1 || pm2 start "$PROJECT_DIR/server/server.js" --name "$SERVICE_NAME"
pm2 save
echo "If pm2 suggests a 'pm2 startup' command, run it to enable boot autostart."

echo "UFW (firewall) quick allow for 80/443 (ignored if UFW not installed) ..."
if command -v ufw >/dev/null 2>&1; then
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi

echo "Done. Next steps:"
echo "  1) Issue TLS certificate:"
if [[ "$INCLUDE_WWW" == "true" ]]; then
  echo "     sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect"
else
  echo "     sudo certbot --nginx -d $DOMAIN --redirect"
fi
echo "  2) Verify:"
echo "     curl -I https://$DOMAIN"
echo "     curl -sS https://$DOMAIN/health"
echo "  3) Update static files later by re-running this script or rsyncing to $WEB_ROOT"

echo "All set for $DOMAIN."
