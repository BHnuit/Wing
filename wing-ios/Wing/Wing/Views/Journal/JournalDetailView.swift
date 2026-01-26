/**
 * 日记详情视图
 * 显示单个日记的完整内容
 * TODO: 实现完整的 UI 和交互逻辑
 */

import SwiftUI

struct JournalDetailView: View {
    let entry: WingEntry
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(entry.title)
                    .font(.largeTitle)
                Text(entry.summary)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Text(entry.markdownContent)
                    .font(.body)
            }
            .padding()
        }
        .navigationTitle(entry.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationView {
        JournalDetailView(entry: WingEntry(
            title: "示例日记",
            summary: "这是一篇示例日记",
            mood: "😊",
            markdownContent: "这是日记内容...",
            aiInsights: "这是 AI 洞察..."
        ))
    }
}
