#!/bin/bash

# PVC Card Design Server Deployment Script
# AWS服务器部署脚本
# 使用方法: ./deploy.sh

set -e

echo "🚀 开始部署PVC卡片设计服务器..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用root权限运行此脚本"
    echo "使用: sudo ./deploy.sh"
    exit 1
fi

# 系统信息
echo "📋 系统信息:"
echo "操作系统: $(uname -o)"
echo "内核版本: $(uname -r)"
echo "架构: $(uname -m)"

# 更新系统
echo "🔄 更新系统包..."
apt update -y
apt upgrade -y

# 安装必要的系统依赖
echo "📦 安装系统依赖..."
apt install -y curl wget git build-essential python3 python3-pip nginx

# 安装Node.js (使用NodeSource官方仓库)
echo "🟢 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# 验证Node.js安装
node_version=$(node --version)
npm_version=$(npm --version)
echo "✅ Node.js版本: $node_version"
echo "✅ npm版本: $npm_version"

# 安装PM2进程管理器
echo "🔧 安装PM2进程管理器..."
npm install -g pm2

# 创建应用目录
APP_DIR="/var/www/pvc-card-server"
echo "📁 创建应用目录: $APP_DIR"
mkdir -p $APP_DIR
cd $APP_DIR

# 复制服务器文件
echo "📄 复制服务器文件..."
cp /home/ubuntu/Server/* . 2>/dev/null || cp /root/Server/* . 2>/dev/null || echo "请手动复制服务器文件到$APP_DIR"

# 安装项目依赖
echo "📦 安装项目依赖..."
npm install

# 创建必要的目录
echo "📁 创建存储目录..."
mkdir -p uploads designs high_res logs

# 设置目录权限
echo "🔒 设置文件权限..."
chown -R ubuntu:ubuntu $APP_DIR
chmod -R 755 $APP_DIR

# 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

# 配置Nginx反向代理
echo "🌐 配置Nginx反向代理..."
cat > /etc/nginx/sites-available/pvc-card-server << 'EOF'
server {
    listen 80;
    server_name _;
    
    # 增加文件上传限制
    client_max_body_size 50M;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # 静态文件服务
    location /uploads/ {
        alias /var/www/pvc-card-server/uploads/;
        expires 30d;
    }
    
    location /high-res/ {
        alias /var/www/pvc-card-server/high_res/;
        expires 30d;
    }
}
EOF

# 启用Nginx站点
ln -sf /etc/nginx/sites-available/pvc-card-server /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试Nginx配置
nginx -t

# 重启Nginx
systemctl restart nginx
systemctl enable nginx

# 创建PM2配置文件
echo "⚙️  创建PM2配置文件..."
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'pvc-card-server',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: 'logs/combined.log',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    max_memory_restart: '1G'
  }]
};
EOF

# 启动服务器
echo "🚀 启动服务器..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 创建状态检查脚本
echo "📊 创建状态检查脚本..."
cat > status.sh << 'EOF'
#!/bin/bash
echo "=== PVC Card Design Server Status ==="
echo "时间: $(date)"
echo ""
echo "🔧 PM2 状态:"
pm2 status
echo ""
echo "🌐 Nginx 状态:"
systemctl status nginx --no-pager -l
echo ""
echo "🔥 防火墙状态:"
ufw status
echo ""
echo "💾 磁盘使用情况:"
df -h
echo ""
echo "🧠 内存使用情况:"
free -h
echo ""
echo "📡 网络连接:"
ss -tuln | grep :3000
echo ""
echo "📁 存储目录大小:"
du -sh uploads/ designs/ high_res/ 2>/dev/null || echo "存储目录未找到"
EOF

chmod +x status.sh

# 创建日志轮转配置
echo "📝 配置日志轮转..."
cat > /etc/logrotate.d/pvc-card-server << 'EOF'
/var/www/pvc-card-server/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 ubuntu ubuntu
    postrotate
        pm2 reload pvc-card-server > /dev/null 2>&1 || true
    endscript
}
EOF

# 创建定时任务进行健康检查
echo "⏰ 创建健康检查定时任务..."
(crontab -l 2>/dev/null; echo "*/5 * * * * curl -f http://localhost:3000/health > /dev/null 2>&1 || pm2 restart pvc-card-server") | crontab -

echo ""
echo "✅ 部署完成！"
echo ""
echo "🌍 服务器信息:"
echo "内部地址: http://localhost:3000"
echo "外部地址: http://13.214.160.245"
echo "Nginx代理: http://13.214.160.245:80"
echo ""
echo "🔧 管理命令:"
echo "查看状态: ./status.sh"
echo "查看日志: pm2 logs pvc-card-server"
echo "重启服务: pm2 restart pvc-card-server"
echo "停止服务: pm2 stop pvc-card-server"
echo ""
echo "📁 重要目录:"
echo "应用目录: $APP_DIR"
echo "上传文件: $APP_DIR/uploads/"
echo "设计数据: $APP_DIR/designs/"
echo "高分辨率图片: $APP_DIR/high_res/"
echo "日志文件: $APP_DIR/logs/"
echo ""
echo "🎉 PVC卡片设计服务器已成功部署并运行！"