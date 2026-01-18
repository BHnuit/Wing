/**
 * Vercel Serverless：AI 代理接口
 * 部署到 Vercel 时，请求 /api/ai 会由此函数处理，在服务端转发到 Gemini / OpenAI / DeepSeek / 自定义，避免浏览器 CORS
 */

import { handleAiRequest, type AiProxyBody } from '../server/aiHandler';

type VercelReq = { method?: string; body?: unknown };
type VercelRes = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => VercelRes;
  json: (d: unknown) => void;
};

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    res.status(405).json({ error: '仅支持 POST' });
    return;
  }

  let body: AiProxyBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    res.status(400).json({ error: '请求体须为 JSON' });
    return;
  }

  const result = await handleAiRequest(body);
  if (result.data != null) {
    res.status(result.status).json(result.data);
  } else {
    res.status(result.status).json({ error: result.error, code: result.code });
  }
}
