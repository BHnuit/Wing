/**
 * AI 服务
 * 提供与 AI API 的交互功能（Gemini, OpenAI, DeepSeek, Custom）
 * TODO: 实现具体的 API 调用逻辑
 */

import Foundation

class AIService {
    static let shared = AIService()
    
    private let session = URLSession.shared
    
    enum AIError: Error {
        case invalidURL
        case noAPIKey
        case networkError(Error)
        case invalidResponse
        case decodingError(Error)
    }
    
    private init() {}
    
    // MARK: - 统一接口
    
    func synthesize(fragments: [RawFragment], settings: AppSettings) async throws -> WingEntry {
        // TODO: 实现 AI 合成逻辑
        // 1. 构建提示词
        // 2. 根据设置选择 API
        // 3. 调用 API
        // 4. 解析响应
        
        throw AIError.noAPIKey
    }
    
    // MARK: - Gemini API
    
    func callGemini(prompt: String, apiKey: String, model: String = "gemini-pro") async throws -> String {
        // TODO: 实现 Gemini API 调用
        throw AIError.invalidURL
    }
    
    // MARK: - OpenAI API
    
    func callOpenAI(prompt: String, apiKey: String, model: String = "gpt-4") async throws -> String {
        // TODO: 实现 OpenAI API 调用
        throw AIError.invalidURL
    }
}
