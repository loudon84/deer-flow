/**
 * Article Studio API Client
 * REST client for Article Studio endpoints
 */

import { getArticleStudioBaseURL } from "@/core/config";

function getStudioDirectURL(path: string): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:8320${path}`;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const base = getArticleStudioBaseURL();
  const url = `${base}${path}`;
  const method = init?.method ?? "GET";
  const startedAt = Date.now();
  // 临时诊断日志：定位 Studio API 是否发到了正确地址、是否返回正常。
  console.info("[studio-api] request", { method, url });

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    // 临时兜底：若同源 /api/v1 走反代失败，自动直连同主机 8320 的 Studio 服务重试一次。
    const fallbackUrl = !base ? getStudioDirectURL(path) : null;
    if (!fallbackUrl) {
      throw err;
    }
    console.warn("[studio-api] retry-direct", { method, fallbackUrl, reason: String(err) });
    res = await fetch(fallbackUrl, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  }
  console.info("[studio-api] response", {
    method,
    url,
    status: res.status,
    ok: res.ok,
    durationMs: Date.now() - startedAt,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[studio-api] error-body", {
      method,
      url,
      status: res.status,
      body: text,
    });
    throw new Error(text || `HTTP ${res.status}`);
  }

  const text = await res.text();
  console.info("[studio-api] response-body", {
    method,
    url,
    bodyPreview: text.slice(0, 500),
  });
  return (text ? JSON.parse(text) : {}) as T;
}

export const articleStudioClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
