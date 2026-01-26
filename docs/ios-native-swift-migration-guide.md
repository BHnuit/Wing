# iOS 纯原生 Swift/SwiftUI 改造完整流程指南

## 📋 概述

本指南将帮助你将 Wing Web 应用（React + TypeScript）完全重写为纯原生 iOS 应用（Swift + SwiftUI）。这是一个大型工程，需要重新实现所有功能，但能获得最佳性能和原生体验。

## 🎯 改造方案

### 技术栈对比

| 项目 | Web 版本 | iOS 原生版本 |
|------|---------|-------------|
| **语言** | TypeScript | Swift |
| **UI 框架** | React | SwiftUI |
| **存储** | IndexedDB | Core Data / SQLite |
| **网络** | Fetch API | URLSession |
| **路由** | React Router | NavigationStack |
| **状态管理** | React Hooks | @State, @ObservableObject |
| **构建工具** | Vite | Xcode |

### 优势

- ✅ **极致性能**：完全原生，无 WebView 开销
- ✅ **原生体验**：符合 iOS 设计规范，流畅动画
- ✅ **完整功能**：可访问所有 iOS 原生 API
- ✅ **包体积**：通常比混合应用更小
- ✅ **离线优先**：更好的离线体验

### 挑战

- ⚠️ **开发周期**：需要数周至数月
- ⚠️ **代码重写**：所有功能需要重新实现
- ⚠️ **学习曲线**：需要掌握 Swift 和 SwiftUI
- ⚠️ **维护成本**：需要维护独立的 iOS 代码库

---

## 📦 第一阶段：环境准备

### 1.1 系统要求

- ✅ **macOS 13+**（推荐 macOS 14+，已验证：macOS 25.1.0）
- ✅ **Xcode 15+**（已验证：Xcode 26.2）
- ✅ **Apple Developer 账号**（免费账号可用于开发，发布需要付费账号）
- ✅ **iOS 17+** 作为最低部署目标（推荐，Xcode 26.2 支持）

### 1.2 安装 Xcode

1. 从 App Store 安装 Xcode
2. 打开 Xcode，接受许可协议
3. 安装 Command Line Tools：
   ```bash
   xcode-select --install
   ```

### 1.3 验证环境

运行以下命令验证环境是否配置正确：

```bash
# 检查 Xcode 版本
xcodebuild -version

# 检查 Swift 版本
swift --version

# 检查 CocoaPods（如需要，本项目不使用）
pod --version
```

#### ✅ 验证结果（2026-01-27）

**已验证环境配置：**

```bash
$ xcodebuild -version
Xcode 26.2
Build version 17C52

$ swift --version
swift-driver version: 1.127.14.1 
Apple Swift version 6.2.3 (swiftlang-6.2.3.3.21 clang-1700.6.3.2)
Target: arm64-apple-macosx26.0

$ xcode-select -p
/Applications/Xcode.app/Contents/Developer
```

**环境状态：**
- ✅ Xcode 26.2 已安装并配置正确
- ✅ Swift 6.2.3 已安装
- ✅ Command Line Tools 已配置
- ℹ️ CocoaPods 未安装（本项目不需要，纯 Swift/SwiftUI 开发）

**注意：** 
- Xcode 26.2 是较新版本，支持最新的 Swift 6.2.3
- 本项目使用纯 Swift/SwiftUI，不需要 CocoaPods
- 如果后续需要使用第三方库，可以通过 Swift Package Manager (SPM) 添加

---

## 🏗️ 第二阶段：创建 Xcode 项目

### 2.1 创建新项目

1. 打开 Xcode
2. 选择 **File → New → Project**
3. 选择 **iOS → App**
4. 填写项目信息：
   - **Product Name**: `Wing`
   - **Team**: 选择你的 Apple Developer 账号
   - **Organization Identifier**: `com.wing.journal`
   - **Interface**: `SwiftUI`
   - **Language**: `Swift`
   - **Storage**: `None`（我们将使用 Core Data）
   - **Include Tests**: ✅

5. 选择保存位置（建议在项目根目录的 `wing-ios/` 文件夹下）

### 2.2 项目结构规划

#### ✅ 已完成（2026-01-27）

项目结构已创建，包含以下文件夹和基础文件：

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
│   ├── Services/                      ✅ 业务逻辑服务
│   │   ├── StorageService.swift       ✅ 存储服务（基础实现）
│   │   └── AIService.swift           ✅ AI 服务（占位）
│   ├── Utils/                         ✅ 工具类
│   │   ├── DateUtils.swift            ✅ 日期工具
│   │   └── ImageUtils.swift           ✅ 图片工具
│   └── Resources/                     ✅ 资源文件目录
│       └── Fonts/                     ✅ 字体目录
├── Wing.xcodeproj/                    ✅ Xcode 项目文件
└── WingTests/                        ✅ 测试目录（如已创建）
```

**重要提示**：
1. ✅ 所有文件夹和基础文件已创建在文件系统中
2. ⚠️ **需要在 Xcode 中将文件添加到项目**：
   - 在 Xcode 项目导航器中，右键点击 `Wing` 文件夹
   - 选择 "Add Files to Wing..."
   - 选择所有新创建的文件夹和文件
   - 确保勾选 "Create groups" 和你的 Target
   - 点击 "Add"

3. 📝 大部分文件包含基础结构和 TODO 注释，需要逐步实现完整功能
4. 📄 详细的项目结构说明请参考：`wing-ios/PROJECT_STRUCTURE.md`

---

## 📊 第三阶段：数据模型迁移

### 3.1 创建 Swift 数据模型

将 TypeScript 接口转换为 Swift 结构体/类。

#### RawFragment.swift

```swift
import Foundation

enum FragmentType: String, Codable {
    case text = "TEXT"
    case image = "IMAGE"
}

struct RawFragment: Identifiable, Codable {
    let id: String
    var content: String
    var imageData: String?
    let timestamp: Int64
    var type: FragmentType
    var editedAt: Int64?
    
    init(id: String = UUID().uuidString,
         content: String,
         imageData: String? = nil,
         timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
         type: FragmentType = .text,
         editedAt: Int64? = nil) {
        self.id = id
        self.content = content
        self.imageData = imageData
        self.timestamp = timestamp
        self.type = type
        self.editedAt = editedAt
    }
}
```

#### WingEntry.swift

```swift
import Foundation

struct WingTodo: Codable, Identifiable {
    let id = UUID()
    var title: String
    var priority: TodoPriority
    var completed: Bool = false
    
    enum TodoPriority: String, Codable {
        case high, medium, low
    }
}

struct EditHistoryItem: Codable {
    let createdAt: Int64
    let title: String
    let markdownContent: String
}

struct WingEntry: Identifiable, Codable {
    let id: String
    var title: String
    var summary: String
    var mood: String
    var markdownContent: String
    var aiInsights: String
    var todos: [WingTodo]
    let createdAt: Int64
    var images: [String: String]?
    var editedAt: Int64?
    var editHistory: [EditHistoryItem]?
    var generatedAt: Int64?
    
    init(id: String = UUID().uuidString,
         title: String,
         summary: String,
         mood: String,
         markdownContent: String,
         aiInsights: String,
         todos: [WingTodo] = [],
         createdAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
         images: [String: String]? = nil,
         editedAt: Int64? = nil,
         editHistory: [EditHistoryItem]? = nil,
         generatedAt: Int64? = nil) {
        self.id = id
        self.title = title
        self.summary = summary
        self.mood = mood
        self.markdownContent = markdownContent
        self.aiInsights = aiInsights
        self.todos = todos
        self.createdAt = createdAt
        self.images = images
        self.editedAt = editedAt
        self.editHistory = editHistory
        self.generatedAt = generatedAt
    }
}
```

#### DailySession.swift

```swift
import Foundation

enum SessionStatus: String, Codable {
    case recording = "RECORDING"
    case processing = "PROCESSING"
    case completed = "COMPLETED"
}

struct GatherCompletion: Codable {
    let completedAt: Int64
    let entryId: String
    let title: String
}

struct DailySession: Identifiable, Codable {
    let id: String
    let date: String  // YYYY-MM-DD
    var status: SessionStatus
    var fragments: [RawFragment]
    var finalEntryId: String?
    var gatherStartedAt: [Int64]?
    var gatherCompletions: [GatherCompletion]?
    
    init(id: String = UUID().uuidString,
         date: String,
         status: SessionStatus = .recording,
         fragments: [RawFragment] = [],
         finalEntryId: String? = nil,
         gatherStartedAt: [Int64]? = nil,
         gatherCompletions: [GatherCompletion]? = nil) {
        self.id = id
        self.date = date
        self.status = status
        self.fragments = fragments
        self.finalEntryId = finalEntryId
        self.gatherStartedAt = gatherStartedAt
        self.gatherCompletions = gatherCompletions
    }
}
```

#### AppSettings.swift

```swift
import Foundation

enum AiProvider: String, Codable {
    case gemini, openai, deepseek, custom
}

enum WritingStyle: String, Codable {
    case letter, prose, report, custom
}

enum Language: String, Codable {
    case zh, en
}

enum Theme: String, Codable {
    case system, light, dark
}

enum PageFont: String, Codable {
    case system, sourceHanSans, sourceHanSerif, xlwk
}

enum FontSize: String, Codable {
    case large, medium, small
}

struct AppSettings: Codable {
    var apiKey: String?
    var apiKeys: [String: String]?
    var aiProvider: AiProvider?
    var aiBaseUrl: String?
    var aiModel: String?
    var aiModels: [String: String]?
    var language: Language = .zh
    var theme: Theme = .system
    var pageFont: PageFont = .system
    var fontSize: FontSize = .medium
    var modelLanguage: String = "same"
    var keepEditHistory: Bool = false
    var backupApiKeys: Bool = true
    var writingStyle: WritingStyle = .letter
    var writingStylePrompt: String?
    var insightPrompt: String?
    var enableLongTermMemory: Bool = false
    var memoryExtractionAuto: Bool = false
    var memoryRetrievalEnabled: Bool = false
    
    static let `default` = AppSettings()
}
```

### 3.2 设置 Core Data

1. 在 Xcode 中：**File → New → File → Data Model**
2. 命名为 `WingDataModel.xcdatamodeld`
3. 创建实体（Entities）：
   - **WingEntryEntity**（对应 WingEntry）
   - **DailySessionEntity**（对应 DailySession）
   - **RawFragmentEntity**（对应 RawFragment）
   - **SettingsEntity**（存储 AppSettings）

4. 为每个实体添加属性和关系

---

## 💾 第四阶段：存储服务实现

### 4.1 创建 StorageService

使用 Core Data 或 UserDefaults + 文件系统存储。

#### 方案一：Core Data（推荐，适合复杂查询）

```swift
import CoreData
import Foundation

class StorageService: ObservableObject {
    static let shared = StorageService()
    
    lazy var persistentContainer: NSPersistentContainer = {
        let container = NSPersistentContainer(name: "WingDataModel")
        container.loadPersistentStores { description, error in
            if let error = error {
                fatalError("Core Data 加载失败: \(error)")
            }
        }
        return container
    }()
    
    var viewContext: NSManagedObjectContext {
        persistentContainer.viewContext
    }
    
    func save() {
        if viewContext.hasChanges {
            try? viewContext.save()
        }
    }
    
    // MARK: - WingEntry 操作
    
    func saveEntry(_ entry: WingEntry) {
        // 实现保存逻辑
    }
    
    func getEntries() -> [WingEntry] {
        // 实现查询逻辑
        return []
    }
    
    func deleteEntry(_ id: String) {
        // 实现删除逻辑
    }
    
    // MARK: - DailySession 操作
    
    func getSession(byDate date: String) -> DailySession? {
        // 实现查询逻辑
        return nil
    }
    
    func saveSession(_ session: DailySession) {
        // 实现保存逻辑
    }
}
```

#### 方案二：UserDefaults + 文件系统（简单，适合快速开发）

```swift
import Foundation

class StorageService: ObservableObject {
    static let shared = StorageService()
    
    private let entriesKey = "wing_entries"
    private let sessionsKey = "wing_sessions"
    private let settingsKey = "wing_settings"
    
    private var documentsURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    // MARK: - WingEntry 操作
    
    func saveEntry(_ entry: WingEntry) {
        var entries = getEntries()
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = entry
        } else {
            entries.append(entry)
        }
        saveEntries(entries)
    }
    
    func getEntries() -> [WingEntry] {
        guard let data = UserDefaults.standard.data(forKey: entriesKey),
              let entries = try? JSONDecoder().decode([WingEntry].self, from: data) else {
            return []
        }
        return entries
    }
    
    func deleteEntry(_ id: String) {
        var entries = getEntries()
        entries.removeAll { $0.id == id }
        saveEntries(entries)
    }
    
    private func saveEntries(_ entries: [WingEntry]) {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: entriesKey)
        }
    }
    
    // MARK: - DailySession 操作
    
    func getSession(byDate date: String) -> DailySession? {
        let sessions = getSessions()
        return sessions.first { $0.date == date }
    }
    
    func getSessions() -> [DailySession] {
        guard let data = UserDefaults.standard.data(forKey: sessionsKey),
              let sessions = try? JSONDecoder().decode([DailySession].self, from: data) else {
            return []
        }
        return sessions
    }
    
    func saveSession(_ session: DailySession) {
        var sessions = getSessions()
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        } else {
            sessions.append(session)
        }
        saveSessions(sessions)
    }
    
    private func saveSessions(_ sessions: [DailySession]) {
        if let data = try? JSONEncoder().encode(sessions) {
            UserDefaults.standard.set(data, forKey: sessionsKey)
        }
    }
    
    // MARK: - AppSettings 操作
    
    func getSettings() -> AppSettings {
        guard let data = UserDefaults.standard.data(forKey: settingsKey),
              let settings = try? JSONDecoder().decode(AppSettings.self, from: data) else {
            return AppSettings.default
        }
        return settings
    }
    
    func saveSettings(_ settings: AppSettings) {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: settingsKey)
        }
    }
    
    // MARK: - 图片存储
    
    func saveImage(_ imageData: Data, fragmentId: String) -> URL? {
        let imagesDir = documentsURL.appendingPathComponent("images")
        try? FileManager.default.createDirectory(at: imagesDir, withIntermediateDirectories: true)
        
        let imageURL = imagesDir.appendingPathComponent("\(fragmentId).jpg")
        try? imageData.write(to: imageURL)
        return imageURL
    }
    
    func getImage(fragmentId: String) -> Data? {
        let imageURL = documentsURL.appendingPathComponent("images/\(fragmentId).jpg")
        return try? Data(contentsOf: imageURL)
    }
}
```

---

## 🤖 第五阶段：AI 服务实现

### 5.1 创建 AIService

```swift
import Foundation

class AIService {
    static let shared = AIService()
    
    private let session = URLSession.shared
    
    enum AIError: Error {
        case invalidURL
        case noAPIKey
        case networkError(Error)
        case invalidResponse
        case decodingError(Error)
    }
    
    // MARK: - Gemini API
    
    func callGemini(prompt: String, apiKey: String, model: String = "gemini-pro") async throws -> String {
        let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(model):generateContent?key=\(apiKey)")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": prompt]
                    ]
                ]
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(GeminiResponse.self, from: data)
        
        return response.candidates.first?.content.parts.first?.text ?? ""
    }
    
    // MARK: - OpenAI API
    
    func callOpenAI(prompt: String, apiKey: String, model: String = "gpt-4") async throws -> String {
        let url = URL(string: "https://api.openai.com/v1/chat/completions")!
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "model": model,
            "messages": [
                ["role": "user", "content": prompt]
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        
        let (data, _) = try await session.data(for: request)
        let response = try JSONDecoder().decode(OpenAIResponse.self, from: data)
        
        return response.choices.first?.message.content ?? ""
    }
    
    // MARK: - 统一接口
    
    func synthesize(fragments: [RawFragment], settings: AppSettings) async throws -> WingEntry {
        // 构建提示词
        let prompt = buildSynthesisPrompt(fragments: fragments, settings: settings)
        
        // 根据设置选择 API
        guard let provider = settings.aiProvider else {
            throw AIError.noAPIKey
        }
        
        let responseText: String
        
        switch provider {
        case .gemini:
            guard let apiKey = settings.apiKeys?["gemini"] ?? settings.apiKey else {
                throw AIError.noAPIKey
            }
            responseText = try await callGemini(
                prompt: prompt,
                apiKey: apiKey,
                model: settings.aiModels?["gemini"] ?? "gemini-pro"
            )
        case .openai:
            guard let apiKey = settings.apiKeys?["openai"] else {
                throw AIError.noAPIKey
            }
            responseText = try await callOpenAI(
                prompt: prompt,
                apiKey: apiKey,
                model: settings.aiModels?["openai"] ?? "gpt-4"
            )
        case .deepseek:
            // 实现 DeepSeek API 调用
            throw AIError.invalidURL
        case .custom:
            // 实现自定义 Base URL 调用
            throw AIError.invalidURL
        }
        
        // 解析 JSON 响应
        return try parseAIResponse(responseText)
    }
    
    private func buildSynthesisPrompt(fragments: [RawFragment], settings: AppSettings) -> String {
        // 构建与 Web 版本相同的提示词
        // ...
        return ""
    }
    
    private func parseAIResponse(_ text: String) throws -> WingEntry {
        // 解析 AI 返回的 JSON
        // ...
        throw AIError.decodingError(NSError())
    }
}

// MARK: - Response Models

struct GeminiResponse: Codable {
    let candidates: [Candidate]
    
    struct Candidate: Codable {
        let content: Content
    }
    
    struct Content: Codable {
        let parts: [Part]
    }
    
    struct Part: Codable {
        let text: String
    }
}

struct OpenAIResponse: Codable {
    let choices: [Choice]
    
    struct Choice: Codable {
        let message: Message
    }
    
    struct Message: Codable {
        let content: String
    }
}
```

---

## 🎨 第六阶段：UI 实现

### 6.1 创建主视图结构

#### WingApp.swift

```swift
import SwiftUI

@main
struct WingApp: App {
    @StateObject private var storageService = StorageService.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(storageService)
        }
    }
}
```

#### ContentView.swift

```swift
import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            ChatView()
                .tabItem {
                    Label("记录", systemImage: "message")
                }
                .tag(0)
            
            JournalView()
                .tabItem {
                    Label("日记", systemImage: "book")
                }
                .tag(1)
            
            SettingsView()
                .tabItem {
                    Label("设置", systemImage: "gear")
                }
                .tag(2)
        }
    }
}
```

### 6.2 实现 ChatView

```swift
import SwiftUI
import PhotosUI

struct ChatView: View {
    @EnvironmentObject var storage: StorageService
    @StateObject private var viewModel = ChatViewModel()
    @State private var inputText = ""
    @State private var selectedImage: PhotosPickerItem?
    @FocusState private var isInputFocused: Bool
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // 消息列表
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(viewModel.fragments) { fragment in
                            FragmentBubble(fragment: fragment)
                        }
                    }
                    .padding()
                }
                
                // 输入区域
                InputArea(
                    text: $inputText,
                    isFocused: $isInputFocused,
                    onSend: {
                        viewModel.sendText(inputText)
                        inputText = ""
                    },
                    onImageSelected: { image in
                        viewModel.sendImage(image)
                    }
                )
            }
            .navigationTitle("Wing")
        }
        .environmentObject(viewModel)
    }
}

struct FragmentBubble: View {
    let fragment: RawFragment
    
    var body: some View {
        HStack {
            if fragment.type == .text {
                Text(fragment.content)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(12)
            } else if let imageData = fragment.imageData,
                      let data = Data(base64Encoded: imageData),
                      let uiImage = UIImage(data: data) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 200)
                    .cornerRadius(12)
            }
            Spacer()
        }
    }
}

struct InputArea: View {
    @Binding var text: String
    @FocusState.Binding var isFocused: Bool
    let onSend: () -> Void
    let onImageSelected: (UIImage) -> Void
    
    @State private var selectedPhoto: PhotosPickerItem?
    
    var body: some View {
        HStack(spacing: 12) {
            PhotosPicker(selection: $selectedPhoto) {
                Image(systemName: "photo")
                    .font(.title2)
            }
            .onChange(of: selectedPhoto) { newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        onImageSelected(image)
                    }
                }
            }
            
            TextField("记录你的想法...", text: $text, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .focused($isFocused)
                .lineLimit(1...5)
            
            Button(action: onSend) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.title2)
            }
            .disabled(text.isEmpty)
        }
        .padding()
        .background(Color(.systemBackground))
    }
}
```

### 6.3 实现 JournalView

```swift
import SwiftUI

struct JournalView: View {
    @EnvironmentObject var storage: StorageService
    @State private var entries: [WingEntry] = []
    @State private var searchText = ""
    
    var filteredEntries: [WingEntry] {
        if searchText.isEmpty {
            return entries
        }
        return entries.filter { entry in
            entry.title.localizedCaseInsensitiveContains(searchText) ||
            entry.summary.localizedCaseInsensitiveContains(searchText) ||
            entry.markdownContent.localizedCaseInsensitiveContains(searchText)
        }
    }
    
    var body: some View {
        NavigationView {
            List {
                ForEach(filteredEntries) { entry in
                    NavigationLink(destination: JournalDetailView(entry: entry)) {
                        JournalRow(entry: entry)
                    }
                }
            }
            .searchable(text: $searchText)
            .navigationTitle("日记")
            .onAppear {
                entries = storage.getEntries().sorted { $0.createdAt > $1.createdAt }
            }
        }
    }
}

struct JournalRow: View {
    let entry: WingEntry
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.title)
                .font(.headline)
            Text(entry.summary)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Text(entry.mood)
                .font(.title2)
        }
        .padding(.vertical, 4)
    }
}
```

---

## 🔧 第七阶段：功能实现清单

### 核心功能

- [ ] **数据模型**
  - [ ] RawFragment
  - [ ] WingEntry
  - [ ] DailySession
  - [ ] AppSettings
  - [ ] Memory（长期记忆）

- [ ] **存储服务**
  - [ ] Core Data 或 UserDefaults 实现
  - [ ] 图片文件存储
  - [ ] 数据导入/导出（JSON/ZIP）

- [ ] **AI 服务**
  - [ ] Gemini API 集成
  - [ ] OpenAI API 集成
  - [ ] DeepSeek API 集成
  - [ ] 自定义 Base URL 支持
  - [ ] 提示词构建
  - [ ] JSON 响应解析

- [ ] **UI 视图**
  - [ ] ChatView（记录界面）
  - [ ] JournalView（日记列表）
  - [ ] JournalDetailView（日记详情）
  - [ ] SettingsView（设置）
  - [ ] Markdown 渲染

- [ ] **功能特性**
  - [ ] 文本/图片记录
  - [ ] 消息编辑
  - [ ] AI 合成（收拢羽毛）
  - [ ] 日记编辑
  - [ ] 编辑历史
  - [ ] 重新生成
  - [ ] 分享功能
  - [ ] 复制到剪贴板
  - [ ] 待办事项
  - [ ] 数据导入/导出
  - [ ] WebDAV 同步

- [ ] **设置功能**
  - [ ] AI 配置
  - [ ] 语言切换
  - [ ] 主题切换
  - [ ] 字体设置
  - [ ] 存储管理

---

## 📝 第八阶段：开发步骤建议

### 阶段 1：基础架构（1-2 周）

1. 创建 Xcode 项目
2. 实现数据模型（Swift structs）
3. 实现基础存储服务
4. 创建基础 UI 结构（TabView）

### 阶段 2：核心功能（2-3 周）

1. 实现 ChatView（记录功能）
2. 实现图片选择和处理
3. 实现 AI 服务基础框架
4. 实现简单的 AI 合成功能

### 阶段 3：日记功能（2-3 周）

1. 实现 JournalView
2. 实现 JournalDetailView
3. 实现 Markdown 渲染
4. 实现编辑功能

### 阶段 4：高级功能（2-3 周）

1. 实现设置界面
2. 实现数据导入/导出
3. 实现 WebDAV 同步
4. 实现长期记忆功能

### 阶段 5：优化和测试（1-2 周）

1. UI/UX 优化
2. 性能优化
3. 错误处理
4. 单元测试
5. UI 测试

---

## 🛠️ 第九阶段：关键技术实现

### 9.1 Markdown 渲染

使用 Swift 的 `AttributedString` 或第三方库：

```swift
import SwiftUI

// 方案一：使用 AttributedString（iOS 15+）
func renderMarkdown(_ markdown: String) -> AttributedString {
    // 简单的 Markdown 解析
    // 或使用第三方库如 Down
}

// 方案二：使用第三方库 Down
// 在 Package.swift 中添加依赖：
// .package(url: "https://github.com/johnxnguyen/Down", from: "0.11.0")
```

### 9.2 图片处理

```swift
import UIKit

extension UIImage {
    func toBase64() -> String? {
        guard let imageData = self.jpegData(compressionQuality: 0.8) else {
            return nil
        }
        return imageData.base64EncodedString()
    }
    
    static func fromBase64(_ base64: String) -> UIImage? {
        guard let data = Data(base64Encoded: base64) else {
            return nil
        }
        return UIImage(data: data)
    }
}
```

### 9.3 日期处理

```swift
import Foundation

extension Date {
    func toLocalDateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.string(from: self)
    }
    
    static func fromLocalDateString(_ string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.date(from: string)
    }
}
```

### 9.4 国际化

1. 在 Xcode 中：**File → New → File → Strings File**
2. 命名为 `Localizable.strings`
3. 添加语言版本（中文、英文）

```swift
// Localizable.strings (zh-Hans)
"recording" = "记录";
"journals" = "日记";
"settings" = "设置";

// Localizable.strings (en)
"recording" = "Recording";
"journals" = "Journals";
"settings" = "Settings";
```

使用：
```swift
Text("recording", bundle: .main)
// 或
NSLocalizedString("recording", comment: "")
```

---

## 🐛 第十阶段：常见问题

### 问题 1：Core Data 迁移

当数据模型改变时，需要创建迁移策略：

```swift
let container = NSPersistentContainer(name: "WingDataModel")
let description = container.persistentStoreDescriptions.first
description?.shouldMigrateStoreAutomatically = true
description?.shouldInferMappingModelAutomatically = true
```

### 问题 2：网络请求权限

在 `Info.plist` 中添加：
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

### 问题 3：图片存储优化

- 使用 `UIImageJPEGRepresentation` 压缩图片
- 存储到 Documents 目录
- 定期清理未使用的图片

---

## 📚 参考资源

- [Swift 官方文档](https://swift.org/documentation/)
- [SwiftUI 教程](https://developer.apple.com/tutorials/swiftui)
- [Core Data 指南](https://developer.apple.com/documentation/coredata)
- [URLSession 文档](https://developer.apple.com/documentation/foundation/urlsession)
- [iOS 设计指南](https://developer.apple.com/design/human-interface-guidelines/ios)

---

## ✅ 检查清单

完成以下步骤后，你的 iOS 原生应用就准备好了：

- [ ] Xcode 项目创建完成
- [ ] 数据模型实现完成
- [ ] 存储服务实现完成
- [ ] AI 服务集成完成
- [ ] 主要 UI 视图实现完成
- [ ] 核心功能测试通过
- [ ] 国际化配置完成
- [ ] 应用图标和启动画面配置完成
- [ ] 真机测试通过
- [ ] App Store 准备就绪

---

## 🎉 完成！

恭喜！你已经完成了从 Web 应用到 iOS 原生应用的完整迁移。这是一个大型工程，但最终会获得：

1. **最佳性能**：完全原生，流畅体验
2. **原生体验**：符合 iOS 设计规范
3. **完整功能**：可访问所有 iOS 原生 API
4. **独立维护**：独立的 iOS 代码库

**提示**：建议分阶段开发，先实现核心功能，再逐步完善细节。保持与 Web 版本的功能同步，但可以充分利用 iOS 原生特性增强用户体验！
