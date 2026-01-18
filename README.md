# Wing - 黄昏的猫头鹰日记

<div align="center">
  <h3>一个注重隐私、轻量级的 AI 日记应用</h3>
  <p>像羽毛笔一样记录思绪，像黄昏的猫头鹰一样整理一天的回忆</p>
</div>

## 🦉 关于 Wing

**Wing** 这个名字承载着双重意象：

- **羽毛笔（Quill）**：象征着书写与记录，用轻盈的笔触捕捉生活的片段
- **翅膀（Wing）**：像黄昏时分的猫头鹰收拢翅膀，整理一天的思绪与回忆

黄昏是猫头鹰最活跃的时刻，也是我们回顾一天、整理思绪的最佳时机。Wing 就像一只智慧的猫头鹰，在黄昏时分帮你将零散的记录编织成完整的日记，让思绪如羽毛般轻盈，如翅膀般自由。

## ✨ 特性

### 核心功能
- **碎片化记录**：随时记录零散的想法和图片，支持消息编辑与编辑标记
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

## 🚀 快速开始

### 环境要求
- Node.js 16+ 
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd Wing
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量（可选）**
   创建 `.env.local`：
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   也可在应用内 **设置 → 模型配置** 填入各供应商 API Key（应用内优先）。

4. **启动开发服务器**
```bash
npm run dev
```

应用将在 `http://localhost:3000` 运行

### 构建生产版本
```bash
npm run build
npm run preview
```

## 🌐 部署到 Netlify

Wing 支持一键部署到 Netlify，提供免费的静态网站托管服务。

### 部署方式

#### 方法 1：通过 GitHub 自动部署（推荐）

1. **登录 Netlify**
   - 访问 [Netlify](https://www.netlify.com/)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "Add new site" → "Import an existing project"
   - 选择 GitHub，授权并选择 `BHnuit/Wing` 仓库

3. **配置构建设置**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - 这些设置通常会自动检测，项目已包含 `netlify.toml` 配置文件

4. **配置环境变量（可选）**
   - 进入 "Site settings" → "Environment variables"
   - 添加 `GEMINI_API_KEY`（可选，用户也可以在应用内设置页面配置）

5. **部署**
   - 点击 "Deploy site"，Netlify 会自动构建并部署
   - 部署完成后会获得一个免费的 `.netlify.app` 域名

#### 方法 2：手动部署

1. **本地构建**
   ```bash
   npm run build
   ```

2. **上传到 Netlify**
   - 登录 Netlify
   - 将 `dist` 文件夹拖拽到部署区域

### 部署注意事项

- ✅ **路由支持**：项目使用 HashRouter，Netlify 无需额外配置
- ✅ **环境变量**：可在 Netlify 中配置 `GEMINI_API_KEY`，但用户也可以在应用内设置
- ✅ **AI 连接**：生产构建会通过 `/api/ai` 走 Netlify Function 代理，自动规避浏览器 CORS，可正常连接 Gemini / OpenAI / DeepSeek / 自定义接口
- ⚠️ **WebDAV 功能**：开发环境的 WebDAV 代理在 Netlify 上无法使用。生产环境需要：
  - 使用支持 CORS 的 WebDAV 服务器，或
  - 使用 Netlify Functions（需要付费计划），或
  - 客户端直接访问（如果服务器支持 CORS）

### 配置文件说明

项目已包含以下 Netlify 配置文件：

- `netlify.toml` - Netlify 部署配置（构建命令、路由规则、安全头、`/api/ai` 重定向等）
- `.netlifyignore` - 忽略不需要部署的文件（如 `node_modules`、`.env` 等）

## 🌐 部署到 Vercel

1. **导入项目**：在 [Vercel](https://vercel.com) 中导入 Git 仓库。
2. **构建设置**（通常可自动检测）：
   - Build command: `npm run build`
   - Output directory: `dist`
3. **AI 代理**：项目中的 `api/ai.ts` 会作为 Serverless 部署到 `/api/ai`，生产环境的前端会自动通过该接口请求 Gemini / OpenAI / DeepSeek / 自定义，避免浏览器 CORS 限制。
4. **环境变量**：可选。用户可在应用内配置自己的 API 密钥；若需服务端默认密钥，可配置 `GEMINI_API_KEY` 等。

## 🔌 连接 AI 供应商（Vercel、Netlify 等）

在 Vercel、Netlify 等静态/边缘平台上，页面在**浏览器**中运行。若从前端直接 `fetch` 到 `api.openai.com`、`api.deepseek.com` 或部分自定义接口，会因对方未放行 CORS 而被浏览器拦截，导致「无法连接 AI 供应商」。

**做法：使用自建 AI 代理（Serverless）**

- 前端不再直连 AI 供应商，而是请求**同源**的 `/api/ai`（例如 `https://你的域名/api/ai`）。
- 该接口由 Vercel 的 `api/ai.ts` 或 Netlify 的 `netlify/functions/ai.ts` 在**服务端**转发到 Gemini、OpenAI、DeepSeek 或自定义 Base URL；服务端请求不受 CORS 限制。
- **生产构建**（`import.meta.env.PROD === true`）下，`aiService` 会自动走 `/api/ai`；开发时仍可直接连 AI（仅当供应商支持 CORS 时可用）。

**环境变量（可选）**

| 变量 | 说明 |
|------|------|
| `VITE_AI_PROXY` | 设为 `true` 时，在开发环境也走 `/api/ai`（需配合 `netlify dev` 或 `vercel dev` 使用）。 |
| `VITE_AI_PROXY_URL` | 代理地址，默认 `/api/ai`。Capacitor 等若将前端与接口部署在不同域名，可设为完整 URL，如 `https://你的后端域名/api/ai`。 |

**平台对应关系**

- **Vercel**：使用 `api/ai.ts`，无需额外配置，部署后即提供 `/api/ai`。
- **Netlify**：使用 `netlify/functions/ai.ts`，并在 `netlify.toml` 中通过 redirect 将 `/api/ai` 转到 `/.netlify/functions/ai`（已配置）。

**超时与体积**

- 免费/基础计划下，Vercel / Netlify 的 Serverless 超时约 10–26 秒；AI 合成若较慢可能超时，可考虑升级或压缩当日碎片/图片后再请求。
- 请求体过大会受平台限制（约 4.5–5MB），含大量 base64 图片时请注意控制大小。

## 📁 项目结构

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

## 🔧 技术栈

- **前端**：React 19 + TypeScript、Vite 6、React Router v7
- **UI**：Lucide React、Tailwind CSS（黄昏 / 暗色主题）
- **AI**：统一 `aiService`，支持 Gemini、OpenAI、DeepSeek、自定义 Base；生产环境经 `/api/ai` 代理
- **存储**：localStorage；导出/导入支持 `.json`、`.zip`（data.json + images/）
- **同步**：WebDAV（坚果云等）

## ⚙️ 配置说明

### AI 配置（设置 → 模型配置）
- **供应商**：Gemini、OpenAI、DeepSeek、自定义（需填 Base URL）
- **API Key**：按供应商分别保存；提供「测试连接」
- **模型名称**：可留空使用默认，或选预设/自定义

### WebDAV（设置 → 存储管理）
- 服务器 URL 默认 `https://dav.jianguoyun.com/dav/`
- 用户名、应用密码（坚果云在「账户安全」生成）
- 可选「实时同步」：记录、编辑等操作后自动备份

## 📱 使用流程

1. **记录碎片**：在记录页输入文字或上传图片；可点击消息编辑纠错或补充
2. **按日切换**：顶部左右箭头在有记录的日期间切换；日记详情「更多 → 查看当天记录」可跳回该日记录
3. **收拢羽毛**：点击「收拢今日羽毛」或「再次收拢羽毛」，AI 生成结构化日记；当日已有日记时会覆盖
4. **查看与编辑**：日记库进入详情；可编辑、重新生成、生成长图、复制、删除等
5. **备份**：设置 → 存储管理 中配置 WebDAV，可开启「实时同步」或手动「立即同步」

## 🔒 隐私与安全

- 所有数据存储在本地浏览器中
- API 密钥仅存储在本地，不会上传
- WebDAV 同步使用 HTTPS 加密传输
- 支持完全离线使用（除 AI 合成功能外）

## 📝 开发计划

### ✅ 已完成功能

**记录与合成**
- [x] 碎片化记录（文本、图片 Base64）、消息编辑与编辑标记
- [x] 记录页按日期展示、`?date=` 切换、日期选择器（仅在有记录的日期间）
- [x] 日记详情「查看当天记录」跳转
- [x] AI 智能合成（Gemini / OpenAI / DeepSeek / 自定义 Base）、生产环境 `/api/ai` 代理
- [x] 测试 API 连接；按供应商的 API Key、模型名
- [x] 当日已有日记时「再次收拢」覆盖该日记

**日记详情**
- [x] 手动编辑标题与 Markdown、编辑历史（可选）、恢复旧版本
- [x] 重新生成（合并当日全部记录，覆盖或另存为新版本）
- [x] 单独重新生成洞察
- [x] 生成长图、复制到剪贴板、复制为新日记、删除；更多菜单聚合

**数据与同步**
- [x] 导出 ZIP（`data.json` + `images/`）、导入 `.json` / `.zip`、替换
- [x] WebDAV（坚果云、测试连接、立即同步）、实时同步开关
- [x] 保留编辑历史、导出时是否备份 API Key 等选项

**界面与设置**
- [x] 主题：跟随系统 / 亮色 / 暗色；黄昏与暗色（nocturnal）主题
- [x] 猫头鹰意象：OwlLogo、EmptyStateOwl、LoadingOwl、羽毛/收拢文案
- [x] 多语言（zh/en）、模型输出语言（与页面一致 / 中文 / 英文）
- [x] 个人/设置页：记录热力图、今日挥动、羽毛总数；模型配置、显示选项、存储管理
- [x] 欢迎日记（首次空数据注入）、错误边界与 Toast

**基础设施**
- [x] `getSessionByDate` / `getOrCreateSessionByDate`、`updateFragment`、`updateEntry`、`deleteEntry`
- [x] `getActivityDateSet`、`getDatesWithRecordsForPicker`、`getTodayMessageCount`、`getTotalFeatherCount`
- [x] `utils/date`（`getLocalDateString`）、`EditHistoryItem`、`RawFragment.editedAt`

---

### 🔜 计划中功能

- [ ] **定时/后台自动同步**：在现有「实时同步」基础上，增加定时或后台触发 WebDAV 备份
- [ ] **PWA**：离线可用、安装到主屏
- [ ] **IndexedDB**：突破 localStorage 容量，适配大量日记与图片
- [ ] **统计扩展**：心情趋势、词云、连续记录天数（Streak）等（在现有热力图与基础统计上扩展）

---

### 🎯 待优化功能

以下功能已规划，尚未实现：

#### 1. 空白引导提示
- **描述**：聊天为空时随机展示 3–5 个引导问题，点击填入输入框
- **要点**：引导问题库（工作、生活、情感、成长等），随机展示，点击即填入

#### 2. 待办事项导出
- **描述**：日记详情支持将待办单独导出为 JSON / TXT / CSV，或一键复制
- **要点**：导出待办按钮，按优先级筛选，多格式与复制到剪贴板

#### 3. 文风选择
- **描述**：书信体、散文体、报告体及自定义描述，写入合成时的 system prompt
- **要点**：文风选择器（设置或合成旁），预设 + 自定义，合成时带入提示词

#### 4. 日记导入（多平台）
- **描述**：从 Day One、Journey 等导出内容导入，自动识别日期/标题、排版与命名
- **要点**：多格式（JSON、TXT、MD、CSV）、批量与预览、字段映射（与现有 Wing 专用 .json/.zip 导入区分）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

<div align="center">
  <p>Inspired by the owl at dusk, gathering thoughts like feathers.</p>
  <p>Wing Version 1.0.0</p>
</div>
