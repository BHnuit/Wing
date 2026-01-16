# Wing - 轻盈的 AI 日记应用

<div align="center">
  <h3>一个注重隐私、轻量级的 AI 日记应用</h3>
  <p>像羽毛一样轻盈，记录你的每一天</p>
</div>

## ✨ 特性

### 核心功能
- **碎片化记录**：随时记录零散的想法和图片，无需立即处理
- **AI 智能合成**：使用 Gemini API 将碎片化记录合成为结构化的日记
- **图片支持**：支持上传图片，AI 会在日记中智能插入
- **心情分析**：AI 分析你的心情，提供心理学洞察
- **待办提取**：自动从记录中提取待办事项

### 数据管理
- **本地优先**：所有数据首先存储在本地（localStorage）
- **WebDAV 同步**：支持通过 WebDAV 备份到云端（默认支持坚果云）
- **数据导入/导出**：支持 JSON 格式的数据导入和导出
- **隐私保护**：所有 API 密钥本地存储，不会上传到服务器

### 用户体验
- **极简设计**：简约优雅的界面设计，大量留白
- **多语言支持**：支持简体中文和英文
- **响应式布局**：适配不同屏幕尺寸
- **实时反馈**：操作即时反馈，流畅的动画效果

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

3. **配置环境变量**
创建 `.env.local` 文件：
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

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

## 📁 项目结构

```
Wing/
├── components/          # React 组件
│   ├── ChatView.tsx    # 聊天记录界面
│   ├── JournalView.tsx # 日记列表界面
│   ├── JournalDetail.tsx # 日记详情界面
│   └── SettingsView.tsx # 设置界面
├── services/           # 服务层
│   ├── geminiService.ts # Gemini AI 服务
│   ├── webdavService.ts # WebDAV 同步服务
│   ├── dataService.ts  # 数据导入/导出服务
│   └── mockDataService.ts # 本地存储服务
├── types.ts            # TypeScript 类型定义
├── i18n.ts             # 国际化配置
├── App.tsx             # 主应用组件
└── vite.config.ts      # Vite 配置
```

## 🔧 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **路由**: React Router v7
- **UI 组件**: Lucide React (图标)
- **样式**: Tailwind CSS (CDN)
- **AI 服务**: Google Gemini API
- **数据存储**: localStorage
- **同步协议**: WebDAV

## ⚙️ 配置说明

### Gemini API 配置
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 创建 API 密钥
3. 在设置页面填入 API 密钥

### WebDAV 配置（坚果云）
1. 登录坚果云，进入"账户安全"
2. 生成"应用密码"（非登录密码）
3. 在设置页面配置：
   - 服务器 URL: `https://dav.jianguoyun.com/dav/`
   - 用户名: 坚果云用户名或邮箱
   - 密码: 应用密码

## 📱 使用流程

1. **记录碎片**：在聊天界面输入文字或上传图片
2. **智能合成**：点击"智能编织今日"按钮，AI 会生成结构化日记
3. **查看日记**：在日记库中浏览所有生成的日记
4. **云端备份**：在设置中配置 WebDAV 并同步数据

## 🔒 隐私与安全

- 所有数据存储在本地浏览器中
- API 密钥仅存储在本地，不会上传
- WebDAV 同步使用 HTTPS 加密传输
- 支持完全离线使用（除 AI 合成功能外）

## 📝 开发计划

- [x] 基础聊天记录功能
- [x] AI 智能合成
- [x] 图片上传和显示
- [x] WebDAV 同步
- [x] 数据导入/导出
- [ ] Markdown 渲染优化
- [ ] 自动同步功能
- [ ] 数据统计和可视化
- [ ] PWA 支持（离线使用）

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

---

<div align="center">
  <p>Inspired by the lightness of feathers.</p>
  <p>Wing Version 1.0.0</p>
</div>
