/**
 * AI 设置视图
 * 配置 AI 供应商、API Key 等
 * TODO: 实现完整的 UI 和交互逻辑
 */

import SwiftUI

struct SettingsAIView: View {
    @EnvironmentObject var storage: StorageService
    
    var body: some View {
        Text("AI Settings")
            .navigationTitle("AI 设置")
    }
}

#Preview {
    NavigationView {
        SettingsAIView()
            .environmentObject(StorageService.shared)
    }
}
