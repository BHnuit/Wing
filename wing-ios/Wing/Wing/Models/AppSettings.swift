/**
 * 应用设置模型
 * 存储用户的所有配置选项，包括 AI 配置、界面设置、功能开关等
 */

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
