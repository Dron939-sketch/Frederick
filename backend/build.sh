#!/usr/bin/env bash
# build.sh - скрипт сборки для Render.com

echo "🔧 Installing system dependencies..."
apt-get update
apt-get install -y ffmpeg

echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Build completed!"
