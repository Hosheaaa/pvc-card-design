#!/bin/bash

# 更新服务器脚本
# 使用方法: ./update-server.sh

# 服务器信息
SERVER_IP="13.214.160.245"
KEY_FILE="First.pem"
USER="ubuntu"
REMOTE_DIR="/var/www/pvc-card-server"

# 检查密钥文件是否存在
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ 密钥文件 $KEY_FILE 不存在"
    exit 1
fi

# 设置密钥文件权限
chmod 600 "$KEY_FILE"

echo "🔄 更新服务器代码..."
echo "服务器IP: $SERVER_IP"
echo "目标目录: $REMOTE_DIR"
echo ""

# 上传更新的server.js
echo "📤 上传更新的server.js..."
scp -i "$KEY_FILE" "server.js" "$USER@$SERVER_IP:$REMOTE_DIR/"

# 重启服务器
echo "🔄 重启服务器..."
ssh -i "$KEY_FILE" "$USER@$SERVER_IP" "cd $REMOTE_DIR && pm2 restart pvc-card-server"

# 检查服务器状态
echo "📊 检查服务器状态..."
ssh -i "$KEY_FILE" "$USER@$SERVER_IP" "cd $REMOTE_DIR && pm2 status"

echo ""
echo "✅ 服务器更新完成！"
echo "🌐 测试地址: http://13.214.160.245:3000/health"