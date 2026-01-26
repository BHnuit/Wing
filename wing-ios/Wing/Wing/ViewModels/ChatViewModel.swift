/**
 * 聊天视图模型
 * 管理聊天视图的状态和业务逻辑
 * TODO: 实现完整的 ViewModel 逻辑
 */

import Foundation
import SwiftUI

class ChatViewModel: ObservableObject {
    @Published var fragments: [RawFragment] = []
    @Published var currentSession: DailySession?
    
    private let storage = StorageService.shared
    
    // TODO: 实现发送文本、发送图片、AI 合成等功能
}
