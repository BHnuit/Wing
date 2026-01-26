/**
 * 日记视图模型
 * 管理日记列表和详情视图的状态
 * TODO: 实现完整的 ViewModel 逻辑
 */

import Foundation
import SwiftUI

class JournalViewModel: ObservableObject {
    @Published var entries: [WingEntry] = []
    @Published var searchText: String = ""
    
    private let storage = StorageService.shared
    
    // TODO: 实现搜索、筛选、排序等功能
}
