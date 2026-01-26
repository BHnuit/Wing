/**
 * 图片工具类
 * 提供图片格式转换和处理功能
 */

import UIKit

extension UIImage {
    /// 转换为 Base64 字符串
    func toBase64() -> String? {
        guard let imageData = self.jpegData(compressionQuality: 0.8) else {
            return nil
        }
        return imageData.base64EncodedString()
    }
    
    /// 从 Base64 字符串创建 UIImage
    static func fromBase64(_ base64: String) -> UIImage? {
        guard let data = Data(base64Encoded: base64) else {
            return nil
        }
        return UIImage(data: data)
    }
}
