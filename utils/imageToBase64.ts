/**
 * 将图片 File 转为 base64 数据 URL，兼容微信等移动端浏览器。
 * 优先使用 FileReader.readAsDataURL；在微信 X5 / iOS 内置浏览器中若失败或超时，
 * 则降级为 createObjectURL → Image → Canvas → toDataURL('image/jpeg')。
 *
 * @param file 图片文件
 * @param maxCanvasSize Canvas 降级时的最大边长，超过则等比缩放，默认 2000；0 表示不限制
 * @returns base64 数据 URL，如 data:image/png;base64,... 或 data:image/jpeg;base64,...
 */
export function convertImageToBase64(
  file: File,
  maxCanvasSize: number = 2000
): Promise<string> {
  const tryFileReader = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        if (r && typeof r === 'string' && r.startsWith('data:image/')) {
          resolve(r);
        } else {
          reject(new Error('Invalid FileReader result'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
      reader.readAsDataURL(file);
    });

  /**
   * 降级方案：blob URL → Image → Canvas → toDataURL('image/jpeg')。
   * 不对 blob: 设置 crossOrigin，同源无 CORS 问题。
   */
  const tryCanvas = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (maxCanvasSize > 0 && (w > maxCanvasSize || h > maxCanvasSize)) {
          if (w > h) {
            h = Math.round((h * maxCanvasSize) / w);
            w = maxCanvasSize;
          } else {
            w = Math.round((w * maxCanvasSize) / h);
            h = maxCanvasSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2d not available'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image load failed'));
      };
      img.src = url;
    });

  /** 为 FileReader 增加超时，避免微信等 WebView 中长时间无回调 */
  const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('FileReader timeout')), ms);
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }).catch((e) => {
        clearTimeout(t);
        reject(e);
      });
    });

  return withTimeout(tryFileReader(), 8000).catch(() => tryCanvas());
}
