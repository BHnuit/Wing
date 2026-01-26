/**
 * 日记条目模型
 * 表示由 AI 合成的完整日记，包含标题、摘要、正文、洞察、待办等
 */

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
