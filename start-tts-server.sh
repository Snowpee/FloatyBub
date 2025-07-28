#!/bin/bash

# Fish Audio TTS 服务器启动脚本

echo "🎵 启动 Fish Audio TTS 服务器..."

# 检查是否存在 tts-server 目录
if [ ! -d "tts-server" ]; then
  echo "❌ 错误: 找不到 tts-server 目录"
  echo "请确保在项目根目录下运行此脚本"
  exit 1
fi

# 进入 tts-server 目录
cd tts-server

# 检查是否存在 .env 文件
if [ ! -f ".env" ]; then
  echo "⚠️  警告: 未找到 .env 文件"
  echo "正在从 .env.example 创建 .env 文件..."
  
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
    echo "📝 请编辑 .env 文件，添加你的 Fish Audio API 密钥:"
    echo "   FISH_AUDIO_API_KEY=your_actual_api_key_here"
    echo ""
  else
    echo "❌ 错误: 找不到 .env.example 文件"
    exit 1
  fi
fi

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
  echo "📦 安装依赖..."
  npm install
  
  if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
  fi
  
  echo "✅ 依赖安装完成"
fi

# 启动服务器
echo "🚀 启动 TTS 服务器..."
echo "📋 服务器将运行在: http://localhost:3001"
echo "📋 健康检查: http://localhost:3001/api/health"
echo "⏹️  按 Ctrl+C 停止服务器"
echo ""

npm run dev