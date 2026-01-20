/**
 * Netlify Serverless：WebDAV 代理
 * 通过 /api/webdav/* 重定向到此函数，在服务端转发到 WebDAV 服务器，避免浏览器 CORS
 * 支持 GET、PUT、DELETE、MKCOL、PROPFIND 等 WebDAV 操作
 */

import { Buffer } from 'buffer';

type NetlifyHeaders = Record<string, string | string[] | undefined>;

interface NetlifyEvent {
  httpMethod?: string;
  path?: string;
  headers?: NetlifyHeaders;
  body?: string | null;
  isBase64Encoded?: boolean;
  /** 使用 ?path=:splat 重定向时，路径会出现在此处 */
  queryStringParameters?: Record<string, string> | null;
}

interface NetlifyResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

/** 从请求路径中提取 /api/webdav/ 之后的相对路径，如 "Wing/xxx" 或 "Wing/" */
function getPathAfterPrefix(path: string, prefix: string): string {
  if (!path || !path.startsWith(prefix)) return '';
  const rest = path.slice(prefix.length);
  return rest.startsWith('/') ? rest.slice(1) : rest;
}

/** 规范化 Base URL，确保以 / 结尾 */
function normalizeBaseUrl(url: string): string {
  const u = (url || '').trim();
  return u.endsWith('/') ? u : u + '/';
}

/** 构建需要转发到 WebDAV 的请求头（过滤掉浏览器/代理专用头） */
function buildForwardHeaders(ev: NetlifyEvent): Record<string, string> {
  const h: Record<string, string> = {};
  const headers = ev.headers || {};
  const toForward = ['authorization', 'content-type', 'depth', 'destination', 'if', 'lock-token', 'overwrite'];
  for (const key of toForward) {
    const v = headers[key] ?? headers[key.toLowerCase()];
    if (typeof v === 'string') h[key] = v;
    else if (Array.isArray(v) && v[0]) h[key] = v[0];
  }
  return h;
}

/** 从响应中提取需要返回给客户端的头 */
function buildResponseHeaders(res: Response): Record<string, string> {
  const h: Record<string, string> = { 'Access-Control-Allow-Origin': '*' };
  const allow = ['content-type', 'content-length', 'content-disposition', 'etag', 'last-modified'];
  for (const k of allow) {
    const v = res.headers.get(k);
    if (v) h[k] = v;
  }
  return h;
}

/**
 * Netlify Function 入口：将 /api/webdav/* 请求转发到 X-WebDAV-Base-URL 指定的 WebDAV 服务器。
 * 请求头须包含：X-WebDAV-Base-URL、Authorization（Basic）。响应为透传，二进制内容以 base64 回传。
 */
export const handler = async (event: NetlifyEvent): Promise<NetlifyResponse> => {
  const corsHeaders: Record<string, string> = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, MKCOL, PROPFIND, MOVE, COPY, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, X-WebDAV-Base-URL, Destination, If, Lock-Token, Overwrite', 'Access-Control-Max-Age': '86400' };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  const method = (event.httpMethod || 'GET').toUpperCase();
  const headers = (event.headers || {}) as Record<string, string>;
  const baseUrl = headers['x-webdav-base-url'] || headers['X-WebDAV-Base-URL'];

  // 优先从 ?path=:splat 取路径（Netlify 重写时显式传入）；否则从 event.path 解析
  let relativePath = '';
  const fromQuery = event.queryStringParameters?.path;
  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    try {
      relativePath = decodeURIComponent(fromQuery).replace(/^\/*|\/*$/g, '').trim() || '';
    } catch {
      relativePath = '';
    }
  }
  if (!relativePath) {
    const path = event.path || '';
    const prefix = '/api/webdav';
    relativePath = getPathAfterPrefix(path, prefix + '/') || getPathAfterPrefix(path, prefix) || '';
  }

  if (!baseUrl || !relativePath) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: '缺少 X-WebDAV-Base-URL 或路径无效' })
    };
  }

  const targetBase = normalizeBaseUrl(baseUrl);
  const targetUrl = targetBase + relativePath;

  let body: string | Buffer | undefined;
  if (event.body) {
    if (event.isBase64Encoded) {
      body = Buffer.from(event.body, 'base64');
    } else {
      body = event.body;
    }
  }

  const forwardHeaders = buildForwardHeaders(event);

  try {
    const res = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body: body as BodyInit | undefined
    });

    const outHeaders = { ...corsHeaders, ...buildResponseHeaders(res) };
    let outBody: string;
    let isBase64 = false;

    const ct = res.headers.get('content-type') || '';
    const isLikelyBinary = /octet-stream|zip|image|pdf/i.test(ct) || (res.headers.get('content-length') && parseInt(res.headers.get('content-length')!, 10) > 64 * 1024);

    if (isLikelyBinary) {
      const buf = await res.arrayBuffer();
      outBody = Buffer.from(buf).toString('base64');
      isBase64 = true;
    } else {
      outBody = await res.text();
    }

    return { statusCode: res.status, headers: outHeaders, body: outBody, isBase64Encoded: isBase64 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误';
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'WebDAV 代理请求失败', detail: msg })
    };
  }
};
