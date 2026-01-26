# 项目结构说明

## ✅ 第二阶段：项目结构规划 - 已完成

### 创建日期
2026-01-27

### 项目结构

```
Wing/
├── Wing/
│   ├── App/
│   │   ├── WingApp.swift              ✅ 应用入口（已存在）
│   │   └── ContentView.swift          ✅ 根视图（已存在）
│   ├── Models/                        ✅ 数据模型
│   │   ├── RawFragment.swift          ✅ 原始碎片模型
│   │   ├── WingEntry.swift            ✅ 日记条目模型
│   │   ├── DailySession.swift         ✅ 每日会话模型
│   │   ├── AppSettings.swift          ✅ 应用设置模型
│   │   └── Memory.swift               ✅ 长期记忆模型
│   ├── Views/                         ✅ SwiftUI 视图
│   │   ├── Chat/
│   │   │   └── ChatView.swift        ✅ 聊天视图（占位）
│   │   ├── Journal/
│   │   │   ├── JournalView.swift     ✅ 日记列表视图（占位）
│   │   │   └── JournalDetailView.swift ✅ 日记详情视图（占位）
│   │   └── Settings/
│   │       ├── SettingsView.swift     ✅ 设置主视图（占位）
│   │       ├── SettingsAIView.swift   ✅ AI 设置视图（占位）
│   │       └── SettingsStorageView.swift ✅ 存储设置视图（占位）
│   ├── ViewModels/                    ✅ 视图模型（MVVM）
│   │   ├── ChatViewModel.swift        ✅ 聊天视图模型（占位）
│   │   ├── JournalViewModel.swift     ✅ 日记视图模型（占位）
│   │   └── SettingsViewModel.swift   ✅ 设置视图模型（占位）
│   ├── Services/                     ✅ 业务逻辑服务
│   │   ├── StorageService.swift       ✅ 存储服务（基础实现）
│   │   └── AIService.swift           ✅ AI 服务（占位）
│   ├── Utils/                        ✅ 工具类
│   │   ├── DateUtils.swift            ✅ 日期工具
│   │   └── ImageUtils.swift           ✅ 图片工具
│   └── Resources/                     ✅ 资源文件目录
│       └── Fonts/                     ✅ 字体目录
├── Wing.xcodeproj/                    ✅ Xcode 项目文件
└── WingTests/                        ✅ 测试目录（如已创建）
```

## 文件说明

### Models（数据模型）
- **RawFragment.swift**: 原始碎片记录（文本/图片）
- **WingEntry.swift**: 日记条目（包含标题、摘要、正文、洞察、待办等）
- **DailySession.swift**: 每日会话（管理一天的碎片记录）
- **AppSettings.swift**: 应用设置（AI 配置、界面设置等）
- **Memory.swift**: 长期记忆（语义、情景、程序性记忆）

### Views（视图）
- **ChatView.swift**: 记录界面（用户输入碎片）
- **JournalView.swift**: 日记列表（显示所有日记）
- **JournalDetailView.swift**: 日记详情（显示单个日记完整内容）
- **SettingsView.swift**: 设置主界面
- **SettingsAIView.swift**: AI 配置界面
- **SettingsStorageView.swift**: 存储管理界面

### ViewModels（视图模型）
- **ChatViewModel.swift**: 管理聊天视图的状态和业务逻辑
- **JournalViewModel.swift**: 管理日记列表的状态
- **SettingsViewModel.swift**: 管理应用设置的状态

### Services（服务）
- **StorageService.swift**: 数据存储服务（UserDefaults + 文件系统）
- **AIService.swift**: AI 服务（Gemini、OpenAI 等 API 调用）

### Utils（工具类）
- **DateUtils.swift**: 日期格式化和解析
- **ImageUtils.swift**: 图片格式转换（Base64）

## 下一步

### 在 Xcode 中添加文件到项目

1. 打开 Xcode 项目
2. 在项目导航器中，右键点击 `Wing` 文件夹
3. 选择 "Add Files to Wing..."
4. 选择所有新创建的文件夹和文件
5. 确保勾选 "Create groups"（不是 "Create folder references"）
6. 确保勾选你的 Target（Wing）
7. 点击 "Add"

### 后续开发任务

- [ ] 在 Xcode 中将文件添加到项目
- [ ] 实现 ChatView 的完整 UI
- [ ] 实现 StorageService 的完整功能
- [ ] 实现 AIService 的 API 调用
- [ ] 实现 Markdown 渲染
- [ ] 实现数据导入/导出
- [ ] 添加国际化支持
- [ ] 实现主题切换
- [ ] 添加单元测试

## 注意事项

1. **文件已创建但未添加到 Xcode 项目**：需要在 Xcode 中手动添加这些文件
2. **占位代码**：大部分文件包含基础结构和 TODO 注释，需要逐步实现
3. **存储方案**：当前使用 UserDefaults，后续可迁移到 Core Data
4. **AI 服务**：AIService 包含基础框架，需要实现具体的 API 调用逻辑

## 相关文档

- [iOS 迁移完整指南](../docs/ios-native-swift-migration-guide.md)
- [环境验证检查](./ENVIRONMENT_CHECK.md)
