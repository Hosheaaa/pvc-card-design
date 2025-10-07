#!/bin/bash

# 动态文件上传脚本
# 使用方法: ./upload.sh [选项]
# 选项:
#   --all: 上传所有文件包括模板
#   --templates: 只上传模板文件
#   --frontend: 只上传前端文件
#   --backend: 只上传后端文件

# 服务器信息
SERVER_IP="13.214.160.245"
KEY_FILE="First.pem"
USER="ubuntu"
REMOTE_DIR="/home/ubuntu/Server"

# 检查密钥文件是否存在
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ 密钥文件 $KEY_FILE 不存在"
    echo "请确保 $KEY_FILE 在当前目录中"
    exit 1
fi

# 设置密钥文件权限
chmod 600 "$KEY_FILE"

echo "📤 动态上传文件到AWS服务器..."
echo "服务器IP: $SERVER_IP"
echo "目标目录: $REMOTE_DIR"
echo ""

# 创建远程目录
echo "📁 创建远程目录..."
ssh -i "$KEY_FILE" "$USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"

# 根据参数决定上传内容
UPLOAD_ALL=false
UPLOAD_TEMPLATES=false
UPLOAD_FRONTEND=false
UPLOAD_BACKEND=false

# 解析参数
if [ "$1" == "--all" ] || [ -z "$1" ]; then
    UPLOAD_ALL=true
elif [ "$1" == "--templates" ]; then
    UPLOAD_TEMPLATES=true
elif [ "$1" == "--frontend" ]; then
    UPLOAD_FRONTEND=true
elif [ "$1" == "--backend" ]; then
    UPLOAD_BACKEND=true
else
    echo "❌ 未知参数: $1"
    echo "使用方法: ./upload.sh [--all|--templates|--frontend|--backend]"
    exit 1
fi

# 动态扫描并上传文件
upload_files() {
    local pattern="$1"
    local description="$2"
    
    echo "📄 上传 $description..."
    for file in $pattern; do
        if [ -f "$file" ]; then
            echo "上传: $file"
            scp -i "$KEY_FILE" "$file" "$USER@$SERVER_IP:$REMOTE_DIR/"
        fi
    done
}

# 上传前端文件
if [ "$UPLOAD_ALL" == true ] || [ "$UPLOAD_FRONTEND" == true ]; then
    upload_files "*.html *.css *.js" "前端文件"
fi

# 上传后端文件
if [ "$UPLOAD_ALL" == true ] || [ "$UPLOAD_BACKEND" == true ]; then
    upload_files "server.js package.json *.md" "后端文件"
    upload_files "*.sh" "脚本文件"
    # 设置脚本执行权限
    echo "🔒 设置脚本执行权限..."
    ssh -i "$KEY_FILE" "$USER@$SERVER_IP" "chmod +x $REMOTE_DIR/*.sh"
fi

# 上传图片和模板文件
if [ "$UPLOAD_ALL" == true ] || [ "$UPLOAD_TEMPLATES" == true ]; then
    echo "🖼️  上传图片和模板文件..."
    
    # 上传单个图片文件
    for file in *.jpg *.png; do
        if [ -f "$file" ]; then
            echo "上传: $file"
            scp -i "$KEY_FILE" "$file" "$USER@$SERVER_IP:$REMOTE_DIR/"
        fi
    done
    
    # 上传模板目录
    if [ -d "PVC_templates" ]; then
        echo "📁 创建模板目录..."
        ssh -i "$KEY_FILE" "$USER@$SERVER_IP" "mkdir -p $REMOTE_DIR/PVC_templates && sudo chown -R ubuntu:ubuntu $REMOTE_DIR/PVC_templates"
        
        echo "📁 上传模板目录..."
        scp -i "$KEY_FILE" -r PVC_templates/* "$USER@$SERVER_IP:$REMOTE_DIR/PVC_templates/"
    fi
fi

echo ""
echo "✅ 文件上传完成！"
echo ""
echo "🔧 使用PM2重启服务器:"
echo "ssh -i $KEY_FILE $USER@$SERVER_IP 'cd $REMOTE_DIR && sudo pm2 restart all'"
echo ""
echo "🌐 服务器地址: http://$SERVER_IP:3000"