/**
 * 长期记忆模型
 * 支持语义记忆、情景记忆、程序性记忆
 */

import Foundation

enum MemoryType: String, Codable {
    case semantic = "semantic"
    case episodic = "episodic"
    case procedural = "procedural"
}

// 语义记忆：用户的基本事实信息
struct SemanticMemory: Codable, Identifiable {
    let id: String
    let type: MemoryType = .semantic
    var key: String
    var value: String
    var confidence: Double
    var sourceEntryIds: [String]
    let createdAt: Int64
    var updatedAt: Int64
    
    init(id: String = UUID().uuidString,
         key: String,
         value: String,
         confidence: Double = 0.5,
         sourceEntryIds: [String] = [],
         createdAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
         updatedAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        self.id = id
        self.key = key
        self.value = value
        self.confidence = confidence
        self.sourceEntryIds = sourceEntryIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// 情景记忆：特定时间、地点的事件和情绪
struct EpisodicMemory: Codable, Identifiable {
    let id: String
    let type: MemoryType = .episodic
    var event: String
    var emotion: String?
    var date: String  // YYYY-MM-DD
    var context: String?
    var sourceEntryId: String
    let createdAt: Int64
    
    init(id: String = UUID().uuidString,
         event: String,
         emotion: String? = nil,
         date: String,
         context: String? = nil,
         sourceEntryId: String,
         createdAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        self.id = id
        self.event = event
        self.emotion = emotion
        self.date = date
        self.context = context
        self.sourceEntryId = sourceEntryId
        self.createdAt = createdAt
    }
}

// 程序性记忆：用户的交互偏好和行为模式
struct ProceduralMemory: Codable, Identifiable {
    let id: String
    let type: MemoryType = .procedural
    var pattern: String
    var preference: String
    var trigger: String?
    var frequency: Int
    var sourceEntryIds: [String]
    let createdAt: Int64
    var updatedAt: Int64
    
    init(id: String = UUID().uuidString,
         pattern: String,
         preference: String,
         trigger: String? = nil,
         frequency: Int = 1,
         sourceEntryIds: [String] = [],
         createdAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
         updatedAt: Int64 = Int64(Date().timeIntervalSince1970 * 1000)) {
        self.id = id
        self.pattern = pattern
        self.preference = preference
        self.trigger = trigger
        self.frequency = frequency
        self.sourceEntryIds = sourceEntryIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

// 联合记忆类型
enum Memory {
    case semantic(SemanticMemory)
    case episodic(EpisodicMemory)
    case procedural(ProceduralMemory)
}
