/**
 * 设置主视图
 * 显示设置选项列表
 * TODO: 实现完整的 UI 和交互逻辑
 */

import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var storage: StorageService
    
    var body: some View {
        NavigationView {
            List {
                Section("AI 配置") {
                    NavigationLink("AI 设置") {
                        SettingsAIView()
                    }
                }
                
                Section("存储") {
                    NavigationLink("存储管理") {
                        SettingsStorageView()
                    }
                }
            }
            .navigationTitle("设置")
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(StorageService.shared)
}
