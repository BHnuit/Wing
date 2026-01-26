/**
 * 设置视图模型
 * 管理应用设置的状态
 * TODO: 实现完整的 ViewModel 逻辑
 */

import Foundation
import SwiftUI

class SettingsViewModel: ObservableObject {
    @Published var settings: AppSettings
    
    private let storage = StorageService.shared
    
    init() {
        self.settings = storage.getSettings()
    }
    
    func saveSettings() {
        storage.saveSettings(settings)
    }
}
