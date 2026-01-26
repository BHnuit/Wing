/**
 * 日期工具类
 * 提供日期格式化和解析功能
 */

import Foundation

extension Date {
    /// 转换为本地日期字符串 (YYYY-MM-DD)
    func toLocalDateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.string(from: self)
    }
    
    /// 从本地日期字符串创建 Date
    static func fromLocalDateString(_ string: String) -> Date? {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.date(from: string)
    }
    
    /// 获取今天的日期字符串
    static func todayString() -> String {
        return Date().toLocalDateString()
    }
}
