/**
 * Vercel Serverless：AI 代理接口
 * 部署到 Vercel 时，请求 /api/ai 会由此函数处理，在服务端转发到 Gemini / OpenAI / DeepSeek / 自定义，避免浏览器 CORS
 * action=synthesize 且 stream=true 时以 SSE 流式返回，降低 TTFB 超时
 */

import { handleAiRequest, handleSynthesizeStream, type AiProxyBody } from '../server/aiHandler';

type VercelReq = { method?: string; body?: unknown };
type VercelRes = {
  setHeader: (k: string, v: string) => void;
  status: (n: number) => VercelRes;
  json: (d: unknown) => void;
  writeHead?: (status: number, headers: Record<string, string>) => void;
  write?: (chunk: string) => void;
  end?: () => void;
};

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.status(405).json({ error: '仅支持 POST' });
    return;
  }

  let body: AiProxyBody;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    res.setHeader('Content-Type', 'application/json');
    res.status(400).json({ error: '请求体须为 JSON' });
    return;
  }

  if (body.action === 'synthesize' && body.stream === true && typeof res.writeHead === 'function' && typeof res.write === 'function' && typeof res.end === 'function') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    try {
      for await (const ev of handleSynthesizeStream(body)) {
        if (ev.type === 'chunk') {
          res.write!(`data: ${JSON.stringify({ chunk: ev.chunk })}\n\n`);
        } else if (ev.type === 'done') {
          res.write!(`data: ${JSON.stringify({ done: true, entry: ev.entry })}\n\n`);
        } else {
          res.write!(`data: ${JSON.stringify({ error: ev.error, code: ev.code })}\n\n`);
        }
      }
    } catch (e) {
      res.write!(`data: ${JSON.stringify({ error: (e as Error).message, code: 'STREAM_ERROR' })}\n\n`);
    } finally {
      res.end!();
    }
    return;
  }

  res.setHeader('Content-Type', 'application/json');
  const result = await handleAiRequest(body);
  if (result.data != null) {
    res.status(result.status).json(result.data);
  } else {
    res.status(result.status).json({ error: result.error, code: result.code });
  }
}
