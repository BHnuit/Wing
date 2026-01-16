# iOS 项目设置指南

## 方法一：使用 Capacitor（推荐）

Capacitor 可以将你的 React Web 应用打包为原生 iOS 应用，并自动生成 `.xcodeproj` 文件。

### 步骤 1: 安装依赖

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
```

### 步骤 2: 初始化 Capacitor

```bash
npx cap init
```

按照提示输入：
- App name: Wing
- App ID: com.wing.journal
- Web dir: dist

### 步骤 3: 构建 Web 应用

```bash
npm run build
```

### 步骤 4: 添加 iOS 平台

```bash
npx cap add ios
```

这会自动生成 `ios/` 目录和 `Wing.xcodeproj` 文件。

### 步骤 5: 在 Xcode 中打开

```bash
npx cap open ios
```

或者在 Finder 中打开 `ios/Wing.xcodeproj`

## 方法二：手动创建（不推荐）

如果你需要完全原生的 iOS 项目，需要：
1. 在 Xcode 中创建新项目
2. 手动迁移所有代码到 Swift/SwiftUI
3. 重新实现所有功能

这需要大量工作，不推荐。

## 注意事项

1. **需要 macOS 和 Xcode**：iOS 开发只能在 macOS 上进行
2. **需要 Apple Developer 账号**：用于真机测试和发布
3. **Capacitor 限制**：某些原生功能可能需要额外的插件

