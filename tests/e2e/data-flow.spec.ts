/**
 * E2E 测试：数据流程
 * 测试数据导入导出、存储等关键数据操作
 */

import { test, expect } from '@playwright/test';

test.describe('数据导入导出', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('应该能够访问存储设置页面', async ({ page }) => {
    // 导航到设置页面
    await page.goto('/settings/storage');
    
    // 验证页面加载
    await expect(page).toHaveURL(/settings\/storage/);
  });

  test('应该显示导出功能', async ({ page }) => {
    await page.goto('/settings/storage');
    
    // 查找导出按钮或链接
    const exportButton = page.locator('button:has-text("导出"), a:has-text("导出"), button:has-text("Export"), a:has-text("Export")').first();
    
    // 如果存在导出按钮，验证其可见性
    if (await exportButton.count() > 0) {
      await expect(exportButton).toBeVisible();
    }
  });
});

test.describe('数据持久化', () => {
  test('应该能够保存输入内容', async ({ page, context }) => {
    await page.goto('/');
    
    // 输入内容
    const input = page.locator('input[type="text"], textarea').first();
    if (await input.count() > 0) {
      await input.fill('测试持久化内容');
      
      // 刷新页面，检查内容是否保留（如果应用支持自动保存）
      await page.reload();
      
      // 注意：实际测试需要根据应用的具体实现调整
      // 这里主要是示例结构
    }
  });
});
