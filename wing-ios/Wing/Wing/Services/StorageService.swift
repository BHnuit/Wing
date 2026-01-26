/**
 * 存储服务
 * 提供数据持久化功能，使用 UserDefaults + 文件系统
 * 后续可迁移到 Core Data
 */

import Foundation

class StorageService: ObservableObject {
    static let shared = StorageService()
    
    private let entriesKey = "wing_entries"
    private let sessionsKey = "wing_sessions"
    private let settingsKey = "wing_settings"
    
    private var documentsURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }
    
    private init() {}
    
    // MARK: - WingEntry 操作
    
    func saveEntry(_ entry: WingEntry) {
        var entries = getEntries()
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = entry
        } else {
            entries.append(entry)
        }
        saveEntries(entries)
    }
    
    func getEntries() -> [WingEntry] {
        guard let data = UserDefaults.standard.data(forKey: entriesKey),
              let entries = try? JSONDecoder().decode([WingEntry].self, from: data) else {
            return []
        }
        return entries
    }
    
    func deleteEntry(_ id: String) {
        var entries = getEntries()
        entries.removeAll { $0.id == id }
        saveEntries(entries)
    }
    
    private func saveEntries(_ entries: [WingEntry]) {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: entriesKey)
        }
    }
    
    // MARK: - DailySession 操作
    
    func getSession(byDate date: String) -> DailySession? {
        let sessions = getSessions()
        return sessions.first { $0.date == date }
    }
    
    func getSessions() -> [DailySession] {
        guard let data = UserDefaults.standard.data(forKey: sessionsKey),
              let sessions = try? JSONDecoder().decode([DailySession].self, from: data) else {
            return []
        }
        return sessions
    }
    
    func saveSession(_ session: DailySession) {
        var sessions = getSessions()
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        } else {
            sessions.append(session)
        }
        saveSessions(sessions)
    }
    
    private func saveSessions(_ sessions: [DailySession]) {
        if let data = try? JSONEncoder().encode(sessions) {
            UserDefaults.standard.set(data, forKey: sessionsKey)
        }
    }
    
    // MARK: - AppSettings 操作
    
    func getSettings() -> AppSettings {
        guard let data = UserDefaults.standard.data(forKey: settingsKey),
              let settings = try? JSONDecoder().decode(AppSettings.self, from: data) else {
            return AppSettings.default
        }
        return settings
    }
    
    func saveSettings(_ settings: AppSettings) {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: settingsKey)
        }
    }
    
    // MARK: - 图片存储
    
    func saveImage(_ imageData: Data, fragmentId: String) -> URL? {
        let imagesDir = documentsURL.appendingPathComponent("images")
        try? FileManager.default.createDirectory(at: imagesDir, withIntermediateDirectories: true)
        
        let imageURL = imagesDir.appendingPathComponent("\(fragmentId).jpg")
        try? imageData.write(to: imageURL)
        return imageURL
    }
    
    func getImage(fragmentId: String) -> Data? {
        let imageURL = documentsURL.appendingPathComponent("images/\(fragmentId).jpg")
        return try? Data(contentsOf: imageURL)
    }
}
