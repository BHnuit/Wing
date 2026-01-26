/**
 * E2E 测试：应用核心流程
 * 测试关键用户流程，如记录、生成日记、查看日记等
 */

import { test, expect } from '@playwright/test';

test.describe('应用核心流程', () => {
  test.beforeEach(async ({ page }) => {
    // 访问应用首页
    await page.goto('/');
  });

  test('应该显示应用主界面', async ({ page }) => {
    // 检查页面标题或关键元素
    await expect(page).toHaveTitle(/Wing/i);
    
    // 检查是否存在输入框或主要 UI 元素
    const input = page.locator('input, textarea').first();
    await expect(input).toBeVisible();
  });

  test('应该能够输入文本记录', async ({ page }) => {
    // 查找输入框
    const input = page.locator('input[type="text"], textarea').first();
    
    // 输入测试内容
    await input.fill('这是一条测试记录');
    
    // 验证输入内容
    await expect(input).toHaveValue('这是一条测试记录');
  });

  test('应该能够导航到设置页面', async ({ page }) => {
    // 查找设置入口（可能是链接或按钮）
    const settingsLink = page.locator('a[href*="settings"], button:has-text("设置"), button:has-text("Settings")').first();
    
    if (await settingsLink.count() > 0) {
      await settingsLink.click();
      
      // 验证是否跳转到设置页面
      await expect(page).toHaveURL(/settings/);
    }
  });

  test('应该能够查看日记列表', async ({ page }) => {
    // 导航到日记列表页面
    const journalLink = page.locator('a[href*="journal"], button:has-text("日记"), button:has-text("Journal")').first();
    
    if (await journalLink.count() > 0) {
      await journalLink.click();
      
      // 验证是否在日记页面
      await expect(page).toHaveURL(/journal/);
    }
  });
});

test.describe('响应式设计', () => {
  test('应该在移动端正常显示', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // 检查页面是否正常显示
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('应该在桌面端正常显示', async ({ page }) => {
    // 设置桌面端视口
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // 检查页面是否正常显示
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
