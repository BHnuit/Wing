/**
 * 欢迎日记模块
 * 在本地数据为空（初始化状态）时，作为默认出现在日记库中的介绍与教程。
 * 用户可自行决定保留或删除。
 */

import { WingEntry, Language } from '../types';

/** 欢迎日记的固定 ID，便于识别；用户删除后与其他日记无异 */
export const WELCOME_ENTRY_ID = 'wing_welcome';

const CONTENT_ZH = `# 关于 Wing 的诞生

Wing 的名字承载着双重意象：**羽毛笔**与**翅膀**。

像羽毛笔一样，用轻盈的笔触捕捉生活的片段；像黄昏时分的猫头鹰收拢翅膀，整理一天的思绪与回忆。它是一个注重隐私、轻量级的 AI 日记应用，让记录与回顾都像羽毛一样轻盈、自由。

---

# 如何使用 Wing

1. **记录碎片**：在「记录」页面随时输入文字或上传图片，无需立即整理，先让思绪落下。
2. **智能创建**：在一天将尽时，点击「收拢今日羽毛」，AI 会将零散记录合成为一篇结构化的日记，包括心情、摘要、洞察与待办。
3. **日记管理**：在「日记」页面浏览所有日记，点进任意一篇可查看、编辑、重新生成或导出。
4. **备份同步**：在「设置」→「存储管理」中配置 WebDAV（如坚果云），即可将数据备份到云端；也支持 JSON 导入与导出。

---

# 为什么能够放心使用

- **本地记录**：你的碎片与日记首先保存在本机（浏览器本地存储），不会经过任何第三方服务器，只有你自己可以看到你的内容。
- **支持备份**：通过 WebDAV 将数据同步到你自己选择的云端，或导出为 JSON 文件，数据始终由你掌控，尽可能减少丢失风险。
- **自选模型**：AI 合成使用你在「设置」→「AI 配置」中自行添加的 API（如 Gemini、OpenAI、DeepSeek 等），密钥仅存在本地，应用本身不会收集或上传。

---

# 写在最后

这篇介绍会作为你的第一条日记出现在这里。你可以随时在详情页通过「更多」→「删除」将其删除，或保留作日后参考。

祝你凭借 Wing 飞向更遥远、更晴朗的明日。`;

const CONTENT_EN = `# The Birth of Wing

The name **Wing** carries two images: the **quill** and the **wing**.

Like a quill, it captures fragments of life with a light touch; like an owl folding its wings at dusk, it gathers the thoughts and memories of the day. It is a privacy-focused, feather-light AI journal app, so that both recording and looking back feel light and free.

---

# How to Use Wing

1. **Record fragments**: On the Recording page, type or upload images anytime. No need to organize at once—let your thoughts land first.
2. **Smart creation**: When the day winds down, tap **Gather Today's Feathers**. AI will turn your fragments into a structured journal entry: mood, summary, insights, and to-dos.
3. **Journal management**: Browse all entries on the Journals page. Open any one to view, edit, regenerate, or export.
4. **Backup & sync**: In **Settings → Storage**, configure WebDAV (e.g. Jianguoyun) to back up to the cloud. JSON import and export are also supported.

---

# Why You Can Use It With Confidence

- **Local-first**: Your fragments and journals are stored on your device (browser localStorage) first. They never pass through any third-party servers—only you can see your content.
- **Backup support**: Sync to a cloud of your choice via WebDAV, or export as JSON. Your data stays in your control, to minimize the risk of loss.
- **Your choice of model**: Synthesis uses the API you configure in **Settings → AI** (e.g. Gemini, OpenAI, DeepSeek). Keys are stored only on your device; the app does not collect or upload them.

---

# A Final Word

This intro appears here as your first journal entry. You can delete it anytime from the detail page via **More → Delete**, or keep it for reference.

Wishing you flights to farther and brighter tomorrows with Wing.`;

const INSIGHT_ZH = '每一次落笔都是翅膀的一次挥动；每一次收拢，都是向更明亮的自己飞近一步。';
const INSIGHT_EN = 'Each stroke is a beat of the wing; each gathering, a step toward a brighter you.';

const TITLE_ZH = 'Hello，Wing';
const TITLE_EN = 'Hello, Wing';

const SUMMARY_ZH = '关于 Wing 的诞生、使用方式与隐私设计；你可随时在详情页删除本篇。';
const SUMMARY_EN = 'About Wing’s birth, how to use it, and privacy; you can delete this entry anytime from the detail page.';

/**
 * 生成欢迎日记条目
 * @param lang 界面语言，用于选择标题、正文与洞察的语种
 * @returns 符合 WingEntry 结构的欢迎日记
 */
export function getWelcomeEntry(lang: Language): WingEntry {
  const isZh = lang === 'zh';
  return {
    id: WELCOME_ENTRY_ID,
    title: isZh ? TITLE_ZH : TITLE_EN,
    summary: isZh ? SUMMARY_ZH : SUMMARY_EN,
    mood: '🦉',
    markdownContent: isZh ? CONTENT_ZH : CONTENT_EN,
    aiInsights: isZh ? INSIGHT_ZH : INSIGHT_EN,
    todos: [],
    createdAt: Date.now()
  };
}
