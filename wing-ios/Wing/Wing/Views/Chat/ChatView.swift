/**
 * 聊天视图（记录界面）
 * 用户输入碎片化记录的界面
 * TODO: 实现完整的 UI 和交互逻辑
 */

import SwiftUI

struct ChatView: View {
    @EnvironmentObject var storage: StorageService
    @State private var inputText = ""
    
    var body: some View {
        VStack {
            Text("Chat View")
                .font(.largeTitle)
            Text("TODO: 实现记录界面")
                .foregroundColor(.secondary)
        }
    }
}

#Preview {
    ChatView()
        .environmentObject(StorageService.shared)
}
