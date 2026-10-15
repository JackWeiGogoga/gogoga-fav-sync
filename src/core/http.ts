/**
 * 基于 Obsidian requestUrl 的 HTTP 客户端。
 *
 * requestUrl 走 Obsidian 自己的网络栈，不受浏览器 CORS 限制，
 * 也允许自定义 Cookie 头——这正是我们不需要独立后台进程的原因。
 */
import { requestUrl } from "obsidian";
import type { HttpClient, HttpResponse } from "../types";
import { t } from "../i18n";

function withQuery(url: string, params?: Record<string, string>): string {
  if (!params || Object.keys(params).length === 0) return url;
  const qs = new URLSearchParams(params).toString();
  return url.includes("?") ? `${url}&${qs}` : `${url}?${qs}`;
}

export const obsidianHttp: HttpClient = {
  async get(url, init): Promise<HttpResponse> {
    const res = await requestUrl({
      url: withQuery(url, init?.params),
      method: "GET",
      headers: init?.headers,
      // 自己判断状态码，避免 4xx 直接抛出后拿不到响应体
      throw: false,
    });
    const text = res.text ?? "";
    return {
      status: res.status,
      text,
      headers: res.headers ?? {},
      json<T>(): T {
        try {
          return JSON.parse(text) as T;
        } catch {
          throw new Error(t("error.http.invalidJson", { status: res.status, body: text.slice(0, 120) }));
        }
      },
    };
  },
};
