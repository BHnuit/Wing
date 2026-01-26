/**
 * 日记列表视图
 * 显示所有日记条目的列表
 * TODO: 实现完整的 UI 和交互逻辑
 */

import SwiftUI

struct JournalView: View {
    @EnvironmentObject var storage: StorageService
    @State private var entries: [WingEntry] = []
    
    var body: some View {
        NavigationView {
            List {
                ForEach(entries) { entry in
                    NavigationLink(destination: JournalDetailView(entry: entry)) {
                        Text(entry.title)
                    }
                }
            }
            .navigationTitle("日记")
            .onAppear {
                entries = storage.getEntries()
            }
        }
    }
}

#Preview {
    JournalView()
        .environmentObject(StorageService.shared)
}
