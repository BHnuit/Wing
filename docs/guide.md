# Wing 项目指南

本文档描述 Wing 的详细功能、技术实现、部署与配置，并预留扩展。部署相关可后续在 `docs/deployment.md` 等文件中单独展开。

---

## 关于 Wing

**Wing** 承载双重意象：

- **羽毛笔（Quill）**：书写与记录，用轻盈的笔触捕捉生活片段
- **翅膀（Wing）**：像黄昏的猫头鹰收拢翅膀，整理一天的思绪与回忆

黄昏是猫头鹰最活跃的时刻，也是回顾一天、整理思绪的时机。Wing 在此时帮你将零散记录编织成完整日记。

---

## 特性详解

### 核心功能

- **碎片化记录**：文字与图片（Base64），消息编辑与编辑标记（`editedAt`）
- **按日查看与切换**：记录页按日期展示，支持 `?date=`、日期选择器；日记详情「查看当天记录」跳回
- **AI 交互**：发送后猫头鹰自动回复并带跳转；输入框留空且当天已有记录时，长按/双击切换 AI 生成模式；AI 生成的时间戳与提示语支持多条，再次生成时叠加；5 分钟内时间戳合并
- **AI 智能合成**：Gemini、OpenAI、DeepSeek、自定义 Base URL；标题、心情、摘要、正文（保留 `[Image]`）、洞察、待办（高/中/低）；**文风**：书信体、散文体、报告体、自定义（写入合成 system prompt）；再次收拢覆盖当日已有日记
- **心情与洞察**：AI 心情 emoji、心理学洞察；支持单独重新生成洞察

### 日记详情

- **手动编辑**：编辑标题与 Markdown 正文，可选保留编辑历史并恢复旧版本
- **重新生成**：合并当日全部记录重新 AI 生成，支持覆盖当前或另存为新版本
- **生成长图、复制、复制为新日记、删除**：更多菜单内一站式操作
- **待办**：一键复制到剪贴板（多格式导出 JSON/TXT/CSV 规划中）

### 数据与同步

- **本地存储**：**IndexedDB**（`indexedDBStorage.ts`），突破 localStorage 5–10MB 限制，自动从 localStorage 迁移；容纳更多图片与日记
- **导出**：ZIP（`data.json` + `images/`）；可选「包含所有设置」或「仅日记与记录」；导出时是否备份 API Key 可配置
- **导入**：`.json`、`.zip`，替换现有数据
- **WebDAV**：坚果云等；**云盘逻辑**为「备份到云盘」与「从云盘恢复」；测试连接、立即同步；生产环境经 **Netlify `/api/webdav`** 代理规避 CORS
- **实时同步**：开关 `realtimeWebdavSync`，关键操作后自动备份

### 体验与界面

- **主题**：跟随系统 / 亮色 / 暗色；黄昏色与暗色（nocturnal）主题
- **显示选项**：**页面字体**（系统 / 思源黑体 / 思源宋体 / 霞鹜文楷）、**字号**（大 / 中 / 小）；根据标题层级（h1–h6）统一字号与字重
- **多语言**：简体中文、英文；模型输出语言（与页面一致 / 中文 / 英文）
- **分享**：Open Graph、Twitter Card（`og-image.svg`）
- **猫头鹰意象**：OwlLogo、空状态与加载态插画、羽毛/收拢等文案
- **个人/设置**：记录热力图、今日挥动、羽毛总数；模型配置、显示选项、存储管理

---

## 部署

> 更详细的部署步骤、环境差异与故障排查可在后续 `docs/deployment.md` 中扩展。

### 部署到 Netlify

Wing 支持一键部署到 Netlify。

#### 通过 GitHub 自动部署（推荐）

1. 登录 [Netlify](https://www.netlify.com/)，使用 GitHub 登录
2. Add new site → Import an existing project，选择仓库
3. 构建设置（通常自动检测）：Build command: `npm run build`，Publish directory: `dist`
4. 可选：在 Environment variables 中添加 `GEMINI_API_KEY`
5. Deploy site

#### 手动部署

- 本地执行 `npm run build`，将 `dist` 拖拽到 Netlify 部署区域

#### 注意事项

- **路由**：项目使用 HashRouter，无需额外配置
- **AI 代理**：生产构建通过 `/api/ai` 走 Netlify Function 代理，可正常连接 Gemini / OpenAI / DeepSeek / 自定义接口
- **WebDAV 代理**：`/api/webdav`、`/api/webdav/*` 已配置指向 `netlify/functions/webdav.ts`，在服务端转发以规避浏览器 CORS；生产环境无需 WebDAV 服务端支持 CORS

**配置文件**：`netlify.toml`、`.netlifyignore` 已包含构建与忽略规则。

### 部署到 Vercel

1. 在 [Vercel](https://vercel.com) 导入 Git 仓库
2. 构建设置：Build command: `npm run build`，Output directory: `dist`
3. **AI 代理**：`api/ai.ts` 会作为 Serverless 部署到 `/api/ai`，前端通过该接口请求 AI，避免 CORS
4. 可选：配置 `GEMINI_API_KEY` 等环境变量；用户也可在应用内配置 API 密钥
5. **WebDAV**：Vercel 未提供 WebDAV 代理；若使用 WebDAV，需自建服务端代理或选用支持 CORS 的 WebDAV 服务（推荐 Netlify 部署以使用内置 `/api/webdav`）

### 连接 AI 供应商（Vercel、Netlify 等）

浏览器直连 `api.openai.com`、`api.deepseek.com` 等可能因 CORS 被拦截。**做法：使用自建 AI 代理**。

- 前端请求同源 `/api/ai`，由 Vercel 的 `api/ai.ts` 或 Netlify 的 `netlify/functions/ai.ts` 在服务端转发到各 AI 供应商
- 生产构建下 `aiService` 自动走 `/api/ai`；开发时默认直连（若供应商支持 CORS）

**环境变量（可选）**

| 变量 | 说明 |
|------|------|
| `VITE_AI_PROXY` | 设为 `true` 时，开发环境也走 `/api/ai`（需配合 `netlify dev` 或 `vercel dev`） |
| `VITE_AI_PROXY_URL` | 代理地址，默认 `/api/ai`；Capacitor 等可设为完整 URL |

**平台**：Vercel 使用 `api/ai.ts`；Netlify 使用 `netlify/functions/ai.ts`（AI）、`netlify/functions/webdav.ts`（WebDAV），`netlify.toml` 中 redirect 已配置。

**限制**：Serverless 超时约 10–26 秒；请求体过大约 4.5–5MB，含大量 base64 图片时需注意。

---

## 项目结构

```
Wing/
├── api/                    # Vercel Serverless（/api/ai 代理）
│   └── ai.ts
├── netlify/functions/      # Netlify Functions
│   ├── ai.ts               # /api/ai 代理
│   └── webdav.ts           # /api/webdav 代理，规避 CORS
├── server/                 # 服务端共享（AI 代理 handler）
│   └── aiHandler.ts
├── components/
│   ├── ChatView.tsx        # 记录页（按日、编辑、合成、AI 自动回复）
│   ├── JournalView.tsx     # 日记库
│   ├── JournalDetail.tsx  # 日记详情（编辑、重新生成、长图、更多）
│   ├── MarkdownRenderer.tsx
│   ├── OwlAssets.tsx       # 猫头鹰 Logo、空状态、加载态
│   ├── SettingsMainView.tsx   # 设置首页（热力图、入口）
│   ├── SettingsAiView.tsx     # 模型配置（供应商、API Key、测试）
│   ├── SettingsLanguageView.tsx # 显示选项（主题、语言、模型输出语言、文风、字体、字号）
│   ├── SettingsStorageView.tsx  # 存储（编辑历史、实时同步、WebDAV 备份/恢复、导入导出）
│   ├── ErrorBoundary.tsx
│   └── ErrorToast.tsx
├── services/
│   ├── aiService.ts        # 统一 AI（Gemini/OpenAI/DeepSeek/自定义、代理）
│   ├── geminiService.ts    # 合成 system prompt、文风、洞察 prompt
│   ├── webdavService.ts    # WebDAV 备份/恢复、triggerRealtimeSyncIfEnabled
│   ├── dataService.ts      # 导出 ZIP、导入 .json/.zip、替换
│   ├── indexedDBStorage.ts # IndexedDB 存储层，替代 localStorage，自动迁移
│   ├── mockDataService.ts  # 业务层，调用 IndexedDBStorage
│   └── welcomeEntry.ts     # 欢迎日记
├── utils/
│   ├── date.ts             # getLocalDateString
│   ├── imageToBase64.ts    # 图片转 Base64
│   └── storage.ts          # isQuotaExceededError 等
├── types.ts
├── i18n.ts
├── App.tsx
└── vite.config.ts
```

---

## 技术栈

- **前端**：React 19 + TypeScript、Vite 6、React Router v7
- **UI**：Lucide React、Tailwind CSS（黄昏 / 暗色主题）；思源黑体/思源宋体/霞鹜文楷字体
- **AI**：统一 `aiService`，支持 Gemini、OpenAI、DeepSeek、自定义 Base；文风（书信/散文/报告/自定义）；生产环境经 `/api/ai` 代理
- **存储**：**IndexedDB**（`indexedDBStorage`），自动从 localStorage 迁移；导出/导入 `.json`、`.zip`（data.json + images/）
- **同步**：WebDAV（坚果云等）；生产环境经 Netlify `/api/webdav` 代理

---

## 配置说明

### AI 配置（设置 → 模型配置）

- **供应商**：Gemini、OpenAI、DeepSeek、自定义（需填 Base URL）
- **API Key**：按供应商分别保存；提供「测试连接」
- **模型名称**：可留空使用默认，或选预设/自定义

### 显示选项（设置 → 显示选项）

- **主题**：跟随系统、亮色、暗色
- **文风**：书信体、散文体、报告体、自定义（自定义时可填 `writingStylePrompt`）；写入 AI 合成 system prompt
- **页面字体**：系统默认、思源黑体、思源宋体、霞鹜文楷
- **字号**：大、中、小
- **多语言与模型输出语言**：界面语言（中文/英文）；模型输出（与页面一致/中文/英文）

### 存储与 WebDAV（设置 → 存储管理）

- **云盘逻辑**：「备份到云盘」「从云盘恢复」（取代原「同步」表述）
- 服务器 URL 默认 `https://dav.jianguoyun.com/dav/`；用户名、应用密码（坚果云在「账户安全」生成应用密码）
- **实时同步**：开关 `realtimeWebdavSync`，记录、编辑等关键操作后自动备份
- **导出**：可选「包含所有设置」或「仅日记与记录」；是否备份 API Key 可配置

---

## 使用流程

1. **记录碎片**：在记录页输入文字或上传图片；发送后猫头鹰自动回复并带跳转；可点击消息编辑纠错或补充
2. **按日切换**：顶部左右箭头或日期选择器；日记详情「更多 → 查看当天记录」可跳回该日记录
3. **收拢羽毛**：点击「收拢今日羽毛」或「再次收拢羽毛」，AI 按所选文风生成结构化日记；当日已有日记时再次收拢会覆盖；输入框留空且当天已有记录时，可长按/双击切换为直接 AI 生成模式
4. **查看与编辑**：日记库进入详情；可编辑、编辑历史恢复、重新生成、单独重生成洞察、生成长图、复制、复制为新、删除
5. **备份**：设置 → 存储管理 配置 WebDAV，使用「备份到云盘」「从云盘恢复」；可开启「实时同步」或手动「立即同步」

---

## 隐私与安全

- 所有数据存储在本地（IndexedDB），不经过第三方服务器
- API 密钥按供应商仅存于本地，不会上传
- WebDAV 备份/恢复使用 HTTPS 加密；生产环境经同源 `/api/webdav` 代理转发
- 支持完全离线使用（除 AI 合成、WebDAV 外）

---

## 开发计划

### 已完成功能

**记录与合成**：碎片化记录（文本、图片 Base64）、消息编辑与编辑标记；记录页按日期、`?date=`、日期选择器；日记详情「查看当天记录」；AI 智能合成（Gemini / OpenAI / DeepSeek / 自定义）、文风（书信/散文/报告/自定义）、生产 `/api/ai` 代理；测试 API 连接；当日已有日记时「再次收拢」覆盖；**AI 自动回复**（发送后猫头鹰回复并跳转）；**长按/双击**切换 AI 生成模式；AI 时间戳与提示语多条、再次生成叠加；5 分钟内时间戳合并。

**日记详情**：手动编辑标题与 Markdown、编辑历史（可选）、恢复旧版本；重新生成（覆盖或新版本）；单独重新生成洞察；生成长图、复制、复制为新日记、删除；**待办一键复制到剪贴板**。

**数据与同步**：**IndexedDB** 存储（`indexedDBStorage`），突破 localStorage 容量，自动迁移；导出 ZIP（可选包含所有设置/仅日记与记录）、导入 .json/.zip、替换；WebDAV **备份到云盘 / 从云盘恢复**，Netlify `/api/webdav` 代理；实时同步；保留编辑历史、导出时是否备份 API Key。

**界面与设置**：主题、黄昏与暗色主题；**文风、页面字体**（系统/思源黑体/思源宋体/霞鹜文楷）、**字号**；标题层级统一字号与字重；**Open Graph、Twitter Card**；猫头鹰意象、多语言、模型输出语言；个人/设置页（热力图、今日挥动、羽毛总数；模型、显示、存储）；欢迎日记、错误边界与 Toast。

**基础设施**：`getSessionByDate` / `getOrCreateSessionByDate`、`updateFragment`、`updateEntry`、`deleteEntry`；`getActivityDateSet`、`getDatesWithRecordsForPicker`、`getTodayMessageCount`、`getTotalFeatherCount`；`utils/date`、`utils/storage`、`utils/imageToBase64`；`EditHistoryItem`、`RawFragment.editedAt`、`DailySession.gatherStartedAt` / `gatherCompletions`。

### 计划中

- **高优先级**：**PWA**（离线可用、安装到主屏）
- **中优先级**：待办多格式导出（JSON / TXT / CSV）；消息记录支持天气、温度、定位；日记库搜索；日记导入（Day One、Journey 等）；定时/后台自动同步 WebDAV
- **低优先级**：统计扩展（心情趋势、词云、Streak）

> 待办一键复制到剪贴板、空白引导提示已完成；移动端/宽屏 Tab 改造已取消。

### 待优化

- 性能：图片懒加载、虚拟滚动、防抖/节流、按路由懒加载
- 体验：键盘快捷键、拖拽排序、标签/分类
- 错误处理：网络重试、数据损坏恢复、更细粒度错误提示
- 可访问性：ARIA、键盘导航、高对比度

---

## 贡献

欢迎提交 Issue 和 Pull Request。

---

*部署、运维与进阶配置可在此文档基础上扩展，例如 `docs/deployment.md`。*
