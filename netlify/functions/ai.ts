/**
 * Netlify Serverless：AI 代理接口
 * 通过 /api/ai 重定向到此函数，在服务端转发到 Gemini / OpenAI / DeepSeek / 自定义，避免浏览器 CORS
 */

import { handleAiRequest, type AiProxyBody } from '../../server/aiHandler';

type NetlifyEvent = { httpMethod?: string; body?: string | null };

export const handler = async (event: NetlifyEvent) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: '仅支持 POST' }) };
  }

  let body: AiProxyBody;
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: '请求体须为 JSON' }) };
  }

  const result = await handleAiRequest(body);
  const payload = result.data != null ? result.data : { error: result.error, code: result.code };
  return { statusCode: result.status, headers, body: JSON.stringify(payload) };
};
