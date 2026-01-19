# Wing - 黄昏的猫头鹰日记

<div align="center">
  <h3>一个注重隐私、轻量级的 AI 日记应用</h3>
  <p>像羽毛笔一样记录思绪，像黄昏的猫头鹰一样整理一天的回忆</p>
</div>

## 应用简介

**Wing** 寓意「羽毛笔」与「翅膀」：用轻盈的笔触记录生活片段，在黄昏时分像猫头鹰般收拢翅膀，将零散记录编织成结构化日记。应用本地优先、注重隐私，AI 仅在你主动「收拢羽毛」时参与合成。

## 核心功能

- **碎片化记录**：随时记录文字与图片，支持编辑；按日查看、日期切换与「查看当天记录」跳转
- **AI 智能合成**：支持 Gemini、OpenAI、DeepSeek、自定义 Base URL；生成标题、心情、摘要、正文、洞察与待办
- **日记详情**：手动编辑、重新生成、生成长图、复制、复制为新日记、删除；可选编辑历史与恢复
- **数据与同步**：localStorage 本地优先；导出 ZIP、导入 .json/.zip；WebDAV（如坚果云）与可选实时同步
- **体验与界面**：主题（跟随系统 / 亮色 / 暗色）、多语言（中文 / 英文）、猫头鹰意象与个人/设置页

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装与运行

```bash
git clone <repository-url>
cd Wing
npm install
npm run dev
```

应用将在 `http://localhost:3000` 运行。可选：在 `.env.local` 中配置 `GEMINI_API_KEY`，或在应用内 **设置 → 模型配置** 填入各供应商 API Key。

### 构建

```bash
npm run build
npm run preview
```

> 部署说明、项目结构、技术栈、配置与开发计划等详见 [项目文档](docs/README.md)。

## 许可证

MIT License

---

<div align="center">
  <p>Inspired by the owl at dusk, gathering thoughts like feathers.</p>
  <p>Wing</p>
</div>
