/**
 * 检测是否为 Safari 浏览器
 */
function isSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /safari/.test(ua) && !/chrome/.test(ua) && !/chromium/.test(ua);
}

/**
 * 将 Blob 转换为 base64 数据 URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result && typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Invalid blob conversion result'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Blob to base64 conversion failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 将图片 File 转为 base64 数据 URL，兼容微信等移动端浏览器和 Safari。
 * 优先使用 FileReader.readAsDataURL；在微信 X5 / iOS 内置浏览器中若失败或超时，
 * 则降级为 createObjectURL → Image → Canvas → toBlob/toDataURL('image/jpeg')。
 * 
 * Safari 特殊处理：
 * - 使用 toBlob() 替代 toDataURL() 以避免黑屏问题
 * - 添加延迟处理，避免时序问题
 * - 支持 Live Photo（iOS 上会自动选择静态图片部分）
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
   * 降级方案：blob URL → Image → Canvas → toBlob/toDataURL('image/jpeg')。
   * 不对 blob: 设置 crossOrigin，同源无 CORS 问题。
   * Safari 优先使用 toBlob() 以避免 toDataURL() 的黑屏问题。
   */
  const tryCanvas = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      
      img.onload = () => {
        // Safari 需要延迟处理，避免时序问题
        const delay = isSafari() ? 100 : 0;
        
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url);
            let w = img.naturalWidth || img.width;
            let h = img.naturalHeight || img.height;
            
            // 检查图片尺寸是否有效
            if (!w || !h || w <= 0 || h <= 0) {
              reject(new Error('Invalid image dimensions'));
              return;
            }
            
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
            
            // 绘制图片到 Canvas
            ctx.drawImage(img, 0, 0, w, h);
            
            // Safari 优先使用 toBlob()，其他浏览器使用 toDataURL()
            if (isSafari() && canvas.toBlob) {
              canvas.toBlob(
                (blob) => {
                  if (blob) {
                    blobToDataURL(blob)
                      .then(resolve)
                      .catch(reject);
                  } else {
                    reject(new Error('Canvas toBlob returned null'));
                  }
                },
                'image/jpeg',
                0.9
              );
            } else {
              // 非 Safari 或 toBlob 不可用时，使用 toDataURL
              try {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                // 检查是否返回了有效的 data URL
                if (dataUrl && dataUrl.startsWith('data:image/')) {
                  resolve(dataUrl);
                } else {
                  reject(new Error('Canvas toDataURL returned invalid result'));
                }
              } catch (e) {
                // toDataURL 失败时，尝试使用 toBlob（如果可用）
                if (canvas.toBlob) {
                  canvas.toBlob(
                    (blob) => {
                      if (blob) {
                        blobToDataURL(blob)
                          .then(resolve)
                          .catch(reject);
                      } else {
                        reject(new Error('Canvas toBlob returned null'));
                      }
                    },
                    'image/jpeg',
                    0.9
                  );
                } else {
                  reject(e);
                }
              }
            }
          } catch (e) {
            URL.revokeObjectURL(url);
            reject(e);
          }
        }, delay);
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
