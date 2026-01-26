/**
 * 每日会话模型
 * 表示一天内的所有碎片记录和对应的日记生成状态
 */

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
