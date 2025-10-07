#!/bin/bash

# PVC Card Design Server Setup Script
# 简单的服务器设置脚本
# 使用方法: ./setup.sh

set -e

echo "🛠️  设置PVC卡片设计服务器..."

# 检查Node.js是否已安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js 14+版本"
    echo "Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash - && sudo apt install -y nodejs"
    echo "CentOS/RHEL: curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash - && sudo yum install -y nodejs"
    exit 1
fi

# 检查npm是否可用
if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装，请先安装npm"
    exit 1
fi

# 显示Node.js版本
node_version=$(node --version)
npm_version=$(npm --version)
echo "✅ Node.js版本: $node_version"
echo "✅ npm版本: $npm_version"

# 安装项目依赖
echo "📦 安装项目依赖..."
npm install

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p uploads designs high_res logs

# 设置目录权限
echo "🔒 设置目录权限..."
chmod 755 uploads designs high_res logs

# 检查端口3000是否可用
if lsof -i :3000 &> /dev/null; then
    echo "⚠️  端口3000已被占用，服务器可能已在运行"
    echo "使用以下命令检查: lsof -i :3000"
else
    echo "✅ 端口3000可用"
fi

# 测试服务器启动
echo "🧪 测试服务器启动..."
timeout 10s node server.js &
SERVER_PID=$!

# 等待服务器启动
sleep 3

# 检查服务器是否启动成功
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "✅ 服务器测试启动成功"
    kill $SERVER_PID
else
    echo "❌ 服务器启动失败"
    exit 1
fi

echo ""
echo "🎉 设置完成！"
echo ""
echo "🚀 启动服务器:"
echo "开发模式: npm run dev"
echo "生产模式: npm start"
echo ""
echo "🌐 访问地址:"
echo "本地: http://localhost:3000"
echo "服务器: http://13.214.160.245:3000"
echo ""
echo "📋 API端点:"
echo "健康检查: GET /health"
echo "提交设计: POST /api/submit-design"
echo "查看设计: GET /api/designs"
echo ""
echo "✅ 服务器已准备就绪！"