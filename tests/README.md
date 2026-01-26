# 测试文档

本文档说明如何运行和维护 Wing 项目的测试。

## 测试框架

- **单元测试**：使用 [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react)
- **E2E 测试**：使用 [Playwright](https://playwright.dev/)

## 安装依赖

```bash
npm install
```

## 运行测试

### 单元测试

```bash
# 运行所有单元测试
npm run test

# 以监听模式运行（开发时推荐）
npm run test -- --watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 打开测试 UI（可视化界面）
npm run test:ui
```

### E2E 测试

```bash
# 运行所有 E2E 测试（会自动启动开发服务器）
npm run test:e2e

# 以 UI 模式运行 E2E 测试（可视化界面）
npm run test:e2e:ui

# 在特定浏览器运行
npx playwright test --project=chromium
```

## 测试结构

```
tests/
├── setup.ts              # 测试环境设置
├── utils/                # 工具函数测试
│   ├── errorHandler.test.ts
│   └── date.test.ts
├── services/             # 服务层测试
│   └── dataService.test.ts
└── e2e/                  # E2E 测试
    ├── app.spec.ts
    └── data-flow.spec.ts
```

## 编写测试

### 单元测试示例

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '../../utils/myUtils';

describe('myFunction', () => {
  it('应该正确执行功能', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### E2E 测试示例

```typescript
import { test, expect } from '@playwright/test';

test('应该能够完成用户流程', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Wing/i);
});
```

## 测试覆盖率

目标覆盖率：
- 关键工具函数：> 80%
- 服务层：> 70%
- 组件：> 60%

查看覆盖率报告：
```bash
npm run test:coverage
# 打开 coverage/index.html 查看详细报告
```

## CI/CD 集成

在 CI/CD 中运行测试：

```yaml
# 示例 GitHub Actions
- name: Run tests
  run: |
    npm run test
    npm run test:e2e
```

## 注意事项

1. **Mock 数据**：单元测试使用 `MockDataService`，不会影响实际数据
2. **环境变量**：E2E 测试需要开发服务器运行在 `http://localhost:3000`
3. **浏览器**：Playwright 会自动下载所需浏览器，首次运行可能需要一些时间
4. **异步操作**：确保正确处理异步操作和等待条件

## 故障排除

### 测试失败

1. 检查测试环境是否正确设置
2. 确认所有依赖已安装
3. 查看测试输出中的错误信息

### E2E 测试无法连接

1. 确认开发服务器正在运行：`npm run dev`
2. 检查 `playwright.config.ts` 中的 `baseURL` 配置
3. 查看 Playwright 日志获取详细错误信息
