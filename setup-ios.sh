#!/bin/bash

# Wing iOS 项目设置脚本

echo "🚀 开始设置 iOS 项目..."

# 检查是否已安装 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查是否在 macOS 上
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  警告: iOS 开发需要在 macOS 上进行"
    echo "   你可以先完成 Web 应用的开发，然后在 macOS 上运行此脚本"
fi

# 安装 Capacitor 依赖
echo "📦 安装 Capacitor 依赖..."
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 检查是否已初始化 Capacitor
if [ ! -f "capacitor.config.ts" ]; then
    echo "⚙️  初始化 Capacitor..."
    npx cap init "Wing" "com.wing.journal" --web-dir=dist
else
    echo "✅ Capacitor 已配置"
fi

# 构建 Web 应用
echo "🔨 构建 Web 应用..."
npm run build

# 添加 iOS 平台
if [ ! -d "ios" ]; then
    echo "📱 添加 iOS 平台..."
    npx cap add ios
else
    echo "✅ iOS 平台已存在"
fi

# 同步文件
echo "🔄 同步文件到 iOS 项目..."
npx cap sync ios

echo ""
echo "✅ 完成！"
echo ""
echo "📝 下一步："
echo "   1. 在 macOS 上打开 Xcode:"
echo "      npx cap open ios"
echo "   2. 或者手动打开:"
echo "      open ios/Wing.xcodeproj"
echo ""
echo "⚠️  注意: 如果不在 macOS 上，请将项目复制到 macOS 后再运行:"
echo "   npx cap open ios"

