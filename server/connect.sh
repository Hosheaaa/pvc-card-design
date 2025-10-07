#!/bin/bash

# AWS服务器连接脚本
# 使用方法: ./connect.sh

# 服务器信息
SERVER_IP="13.214.160.245"
KEY_FILE="First.pem"
USER="ubuntu"

# 检查密钥文件是否存在
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ 密钥文件 $KEY_FILE 不存在"
    echo "请确保 $KEY_FILE 在当前目录中"
    exit 1
fi

# 设置密钥文件权限
chmod 600 "$KEY_FILE"

echo "🔗 连接到AWS服务器..."
echo "服务器IP: $SERVER_IP"
echo "用户: $USER"
echo "密钥文件: $KEY_FILE"
echo ""

# 连接到服务器
ssh -i "$KEY_FILE" "$USER@$SERVER_IP" -o StrictHostKeyChecking=no

echo "🔌 连接已断开"