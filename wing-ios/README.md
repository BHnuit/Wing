# Wing iOS 原生应用

这是 Wing 应用的纯原生 iOS 版本，使用 Swift 和 SwiftUI 开发。

## 📋 项目说明

本项目是 Wing Web 应用的 iOS 原生实现，完全使用 Swift/SwiftUI 重写，不依赖 WebView 或混合框架。

## 🚀 快速开始

### 环境要求

- macOS 13+（推荐 macOS 14+）
- Xcode 15+
- iOS 17+ 作为最低部署目标
- Apple Developer 账号（开发需要）

### 创建 Xcode 项目

1. 打开 Xcode
2. 选择 **File → New → Project**
3. 选择 **iOS → App**
4. 填写项目信息：
   - **Product Name**: `Wing`
   - **Organization Identifier**: `com.wing.journal`
   - **Interface**: `SwiftUI`
   - **Language**: `Swift`
   - **Storage**: `None`（或根据需要选择 Core Data）

5. 将项目保存到此 `wing-ios/` 目录下

### 项目结构

```
wing-ios/
├── Wing/                          # Xcode 项目主目录
│   ├── App/
│   │   ├── WingApp.swift          # 应用入口
│   │   └── ContentView.swift      # 根视图
│   ├── Models/                    # 数据模型
│   ├── Views/                     # SwiftUI 视图
│   ├── ViewModels/               # 视图模型（MVVM）
│   ├── Services/                  # 业务逻辑服务
│   ├── Utils/                     # 工具类
│   └── Resources/                 # 资源文件
├── WingTests/                     # 单元测试
└── README.md                      # 本文件
```

## 📚 开发指南

详细的开发指南请参考：

📄 [iOS 原生 Swift/SwiftUI 改造完整流程指南](../docs/ios-native-swift-migration-guide.md)

## 🔗 相关文档

- [项目主文档](../docs/guide.md)
- [iOS 迁移指南](../docs/ios-native-swift-migration-guide.md)
- [开发路线图](../docs/development-roadmap.md)

## 📝 开发状态

- [ ] 项目初始化
- [ ] 数据模型实现
- [ ] 存储服务实现
- [ ] AI 服务集成
- [ ] UI 视图实现
- [ ] 功能测试
- [ ] App Store 准备

## 🎯 目标

实现与 Web 版本功能对等的 iOS 原生应用，包括：

- ✅ 碎片化记录（文本/图片）
- ✅ AI 智能合成
- ✅ 日记管理
- ✅ 数据导入/导出
- ✅ WebDAV 同步
- ✅ 设置管理

## 📄 许可证

MIT License
