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

1. **在设置中填入 API Key**：打开「设置」→「AI 配置」，填入你的 API Key（支持 Gemini、OpenAI、DeepSeek 等）。密钥只保存在你的设备上，应用不会上传。
2. **以消息形式记录思绪**：在「记录」页随时输入文字或上传图片，想到什么就记什么，每条都会以消息形式保存，不用马上整理。
3. **一天结束前生成日记**：当有记录后，**长按**或**双击**发送按钮（按钮会变成 ∞），再点一下即可生成今日日记；在日记详情里可以查看 AI 的**洞察**和**待办**。

---

# 为什么能够放心使用

- **本地记录**：你的碎片与日记首先保存在本机（浏览器本地存储），不会经过任何第三方服务器，只有你自己可以看到你的内容。
- **支持备份**：可以导出为 JSON 文件，数据始终由你掌控，尽可能减少丢失风险。
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

1. **Add your API key in Settings**: Open **Settings → AI**, and enter your API key (e.g. Gemini, OpenAI, DeepSeek). It is stored only on your device; the app does not upload it.
2. **Record thoughts as messages**: On the Record page, type or upload images anytime. Jot down whatever comes to mind—each item is saved as a message. No need to organize right away.
3. **Generate your diary before the day ends**: When you have at least one record, **long‑press** or **double‑click** the send button (it turns into ∞), then tap once to generate today’s journal. Open the entry to view **insights** and **to‑dos**.

---

# Why You Can Use It With Confidence

- **Local-first**: Your fragments and journals are stored on your device (browser localStorage) first. They never pass through any third-party servers—only you can see your content.
- **Backup support**: Export as JSON. Your data stays in your control, to minimize the risk of loss.
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
