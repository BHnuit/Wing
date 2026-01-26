/**
 * 存储管理视图
 * 数据导入/导出功能
 * TODO: 实现完整的 UI 和交互逻辑
 */

import SwiftUI

struct SettingsStorageView: View {
    @EnvironmentObject var storage: StorageService
    
    var body: some View {
        Text("Storage Settings")
            .navigationTitle("存储管理")
    }
}

#Preview {
    NavigationView {
        SettingsStorageView()
            .environmentObject(StorageService.shared)
    }
}
