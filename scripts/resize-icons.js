/**
 * 调整 PWA 图标尺寸
 * 从 owl.png 生成 192x192 和 512x512 的图标
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const sourceIcon = join(rootDir, 'owl.png');

async function resizeIcons() {
  if (!existsSync(sourceIcon)) {
    console.error(`源图标文件不存在: ${sourceIcon}`);
    process.exit(1);
  }

  try {
    // 生成 192x192 图标
    await sharp(sourceIcon)
      .resize(192, 192, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-192.png'));

    console.log('✓ 已生成 icon-192.png');

    // 生成 512x512 图标
    await sharp(sourceIcon)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(publicDir, 'icon-512.png'));

    console.log('✓ 已生成 icon-512.png');
    console.log('✓ 图标调整完成！');
  } catch (error) {
    console.error('调整图标时出错:', error);
    process.exit(1);
  }
}

resizeIcons();
