# Wing 项目文档

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

- **碎片化记录**：随时记录想法和图片，支持消息编辑与编辑标记
- **按日查看与切换**：记录页按日期展示，支持 `?date=` 切换历史；日记详情可「查看当天记录」跳回
- **AI 智能合成**：支持 Gemini、OpenAI、DeepSeek、自定义 Base URL；将碎片合成为结构化日记
- **图片支持**：上传图片（Base64），AI 在正文中保留 `[Image]`，详情页正确渲染
- **心情与洞察**：AI 心情 emoji、心理学洞察；支持单独重新生成洞察
- **待办提取**：自动提取待办事项（高/中/低优先级）

### 日记详情

- **手动编辑**：编辑标题与 Markdown 正文，可选保留编辑历史并恢复旧版本
- **重新生成**：合并当日全部记录重新 AI 生成，支持覆盖当前或另存为新版本
- **生成长图、复制、复制为新日记、删除**：更多菜单内一站式操作

### 数据与同步

- **本地优先**：localStorage 存储；支持导出 ZIP（`data.json` + `images/`）、导入 `.json` / `.zip`
- **WebDAV**：坚果云等；测试连接、立即同步；可选「实时同步」在关键操作后自动备份
- **隐私**：API 密钥按供应商本地保存；导出时可选择是否备份密钥

### 体验与界面

- **主题**：跟随系统 / 亮色 / 暗色；黄昏色与暗色（nocturnal）主题
- **猫头鹰意象**：OwlLogo、空状态与加载态插画、羽毛/收拢等文案
- **多语言**：简体中文、英文；模型输出语言可单独设置（与页面一致 / 中文 / 英文）
- **个人/设置**：记录热力图、今日挥动次数、羽毛总数；模型配置、显示选项、存储管理

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
- **WebDAV**：生产环境需支持 CORS 的 WebDAV 服务器，或使用 Netlify Functions（付费计划）等方案

**配置文件**：`netlify.toml`、`.netlifyignore` 已包含构建与忽略规则。

### 部署到 Vercel

1. 在 [Vercel](https://vercel.com) 导入 Git 仓库
2. 构建设置：Build command: `npm run build`，Output directory: `dist`
3. **AI 代理**：`api/ai.ts` 会作为 Serverless 部署到 `/api/ai`，前端通过该接口请求 AI，避免 CORS
4. 可选：配置 `GEMINI_API_KEY` 等环境变量；用户也可在应用内配置 API 密钥

### 连接 AI 供应商（Vercel、Netlify 等）

浏览器直连 `api.openai.com`、`api.deepseek.com` 等可能因 CORS 被拦截。**做法：使用自建 AI 代理**。

- 前端请求同源 `/api/ai`，由 Vercel 的 `api/ai.ts` 或 Netlify 的 `netlify/functions/ai.ts` 在服务端转发到各 AI 供应商
- 生产构建下 `aiService` 自动走 `/api/ai`；开发时默认直连（若供应商支持 CORS）

**环境变量（可选）**

| 变量 | 说明 |
|------|------|
| `VITE_AI_PROXY` | 设为 `true` 时，开发环境也走 `/api/ai`（需配合 `netlify dev` 或 `vercel dev`） |
| `VITE_AI_PROXY_URL` | 代理地址，默认 `/api/ai`；Capacitor 等可设为完整 URL |

**平台**：Vercel 使用 `api/ai.ts`；Netlify 使用 `netlify/functions/ai.ts`，`netlify.toml` 中 redirect 已配置。

**限制**：Serverless 超时约 10–26 秒；请求体过大约 4.5–5MB，含大量 base64 图片时需注意。

---

## 项目结构

```
Wing/
├── api/                    # Vercel Serverless（/api/ai 代理）
│   └── ai.ts
├── netlify/functions/      # Netlify Functions（/api/ai 代理）
│   └── ai.ts
├── server/                 # 服务端共享（AI 代理 handler）
│   └── aiHandler.ts
├── components/
│   ├── ChatView.tsx        # 记录页（按日、编辑、合成）
│   ├── JournalView.tsx     # 日记库
│   ├── JournalDetail.tsx   # 日记详情（编辑、重新生成、长图、更多）
│   ├── MarkdownRenderer.tsx
│   ├── OwlAssets.tsx       # 猫头鹰 Logo、空状态、加载态
│   ├── SettingsMainView.tsx   # 设置首页（热力图、入口）
│   ├── SettingsAiView.tsx     # 模型配置（供应商、API Key、测试）
│   ├── SettingsLanguageView.tsx # 显示选项（主题、语言、模型输出语言）
│   ├── SettingsStorageView.tsx  # 存储（编辑历史、实时同步、WebDAV、导入导出）
│   ├── ErrorBoundary.tsx
│   └── ErrorToast.tsx
├── services/
│   ├── aiService.ts        # 统一 AI（Gemini/OpenAI/DeepSeek/自定义、代理）
│   ├── geminiService.ts
│   ├── webdavService.ts    # WebDAV、triggerRealtimeSyncIfEnabled
│   ├── dataService.ts      # 导出 ZIP、导入 .json/.zip、替换
│   ├── mockDataService.ts  # localStorage、getSessionByDate、updateFragment 等
│   └── welcomeEntry.ts     # 欢迎日记
├── utils/
│   └── date.ts             # getLocalDateString
├── types.ts
├── i18n.ts
├── App.tsx
└── vite.config.ts
```

---

## 技术栈

- **前端**：React 19 + TypeScript、Vite 6、React Router v7
- **UI**：Lucide React、Tailwind CSS（黄昏 / 暗色主题）
- **AI**：统一 `aiService`，支持 Gemini、OpenAI、DeepSeek、自定义 Base；生产环境经 `/api/ai` 代理
- **存储**：localStorage；导出/导入支持 `.json`、`.zip`（data.json + images/）
- **同步**：WebDAV（坚果云等）

---

## 配置说明

### AI 配置（设置 → 模型配置）

- **供应商**：Gemini、OpenAI、DeepSeek、自定义（需填 Base URL）
- **API Key**：按供应商分别保存；提供「测试连接」
- **模型名称**：可留空使用默认，或选预设/自定义

### WebDAV（设置 → 存储管理）

- 服务器 URL 默认 `https://dav.jianguoyun.com/dav/`
- 用户名、应用密码（坚果云在「账户安全」生成）
- 可选「实时同步」：记录、编辑等操作后自动备份

---

## 使用流程

1. **记录碎片**：在记录页输入文字或上传图片；可点击消息编辑纠错或补充
2. **按日切换**：顶部左右箭头在有记录的日期间切换；日记详情「更多 → 查看当天记录」可跳回该日记录
3. **收拢羽毛**：点击「收拢今日羽毛」或「再次收拢羽毛」，AI 生成结构化日记；当日已有日记时会覆盖
4. **查看与编辑**：日记库进入详情；可编辑、重新生成、生成长图、复制、删除等
5. **备份**：设置 → 存储管理 中配置 WebDAV，可开启「实时同步」或手动「立即同步」

---

## 隐私与安全

- 所有数据存储在本地浏览器中
- API 密钥仅存储在本地，不会上传
- WebDAV 同步使用 HTTPS 加密传输
- 支持完全离线使用（除 AI 合成功能外）

---

## 开发计划

### 已完成功能

**记录与合成**：碎片化记录（文本、图片 Base64）、消息编辑与编辑标记；记录页按日期、`?date=`、日期选择器；日记详情「查看当天记录」；AI 智能合成（Gemini / OpenAI / DeepSeek / 自定义）、生产 `/api/ai` 代理；测试 API 连接；当日已有日记时「再次收拢」覆盖。

**日记详情**：手动编辑标题与 Markdown、编辑历史（可选）、恢复旧版本；重新生成（覆盖或新版本）；单独重新生成洞察；生成长图、复制、复制为新日记、删除。

**数据与同步**：导出 ZIP、导入 .json/.zip、替换；WebDAV（坚果云、测试连接、立即同步）、实时同步；保留编辑历史、导出时是否备份 API Key 等。

**界面与设置**：主题、黄昏与暗色主题；猫头鹰意象、多语言、模型输出语言；个人/设置页（热力图、今日挥动、羽毛总数；模型、显示、存储）；欢迎日记、错误边界与 Toast。

**基础设施**：`getSessionByDate` / `getOrCreateSessionByDate`、`updateFragment`、`updateEntry`、`deleteEntry`；`getActivityDateSet`、`getDatesWithRecordsForPicker`、`getTodayMessageCount`、`getTotalFeatherCount`；`utils/date`、`EditHistoryItem`、`RawFragment.editedAt`。

### 计划中

- 定时/后台自动同步 WebDAV
- PWA：离线可用、安装到主屏
- IndexedDB：突破 localStorage 容量
- 统计扩展：心情趋势、词云、连续记录天数（Streak）等

### 待优化

- **空白引导提示**：聊天为空时随机展示引导问题，点击填入输入框
- **待办事项导出**：待办单独导出为 JSON / TXT / CSV 或一键复制
- **文风选择**：书信体、散文体、报告体及自定义，写入合成 system prompt
- **日记导入（多平台）**：从 Day One、Journey 等导入，多格式与字段映射

---

## 贡献

欢迎提交 Issue 和 Pull Request。

---

*部署、运维与进阶配置可在此文档基础上扩展，例如 `docs/deployment.md`。*
