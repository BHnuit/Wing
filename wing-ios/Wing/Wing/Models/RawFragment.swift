/**
 * 原始碎片记录模型
 * 表示用户输入的单个记录片段（文本或图片）
 */

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
