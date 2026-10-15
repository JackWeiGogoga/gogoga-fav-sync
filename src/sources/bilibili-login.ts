/**
 * B 站扫码登录。
 *
 * 用官方的 passport 二维码接口换取登录 Cookie，免去手动从浏览器
 * 导出 Cookie 的步骤，过期后重扫一次即可。
 *
 * 流程：generate 拿二维码内容与 qrcode_key → 轮询 poll →
 * 成功时 data.url 的查询串里带着 SESSDATA / bili_jct / DedeUserID。
 */
import type { HttpClient } from "../types";
import { t } from "../i18n";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const GENERATE_URL = "https://passport.bilibili.com/x/passport-login/web/qrcode/generate";
const POLL_URL = "https://passport.bilibili.com/x/passport-login/web/qrcode/poll";

/** 登录接口只需要这两个头，不带任何身份信息。 */
function headers(): Record<string, string> {
  return { "User-Agent": UA, Referer: "https://www.bilibili.com/" };
}

export class BilibiliLoginError extends Error {}

export interface QrSession {
  /** 二维码里要编码的内容。 */
  url: string;
  /** 轮询用的 key。 */
  key: string;
}

export type QrStatus =
  | { state: "pending" }
  | { state: "scanned" }
  | { state: "expired" }
  | { state: "ok"; cookie: string; refreshToken?: string };

interface BiliResp<T> {
  code: number;
  message?: string;
  data?: T;
}

function parseJson<T>(res: { status: number; text: string; json<X>(): X }, what: string): BiliResp<T> {
  if (res.text.trimStart().startsWith("<")) {
    throw new BilibiliLoginError(t("error.login.htmlResponse", { what }));
  }
  try {
    return res.json<BiliResp<T>>();
  } catch {
    throw new BilibiliLoginError(t("error.bili.unparsable", { what, status: res.status }));
  }
}

/** 申请一个新的登录二维码。 */
export async function generateQr(http: HttpClient): Promise<QrSession> {
  const res = await http.get(GENERATE_URL, { headers: headers() });
  const json = parseJson<{ url?: string; qrcode_key?: string }>(res, t("error.login.generate"));
  if (json.code !== 0 || !json.data?.url || !json.data?.qrcode_key) {
    throw new BilibiliLoginError(t("error.login.generateFailed", { code: json.code, message: json.message ?? "" }));
  }
  return { url: json.data.url, key: json.data.qrcode_key };
}

/** 登录需要保存的 Cookie，顺序即写入顺序。 */
const WANTED_COOKIES = ["SESSDATA", "bili_jct", "DedeUserID", "DedeUserID__ckMd5", "sid"] as const;

/**
 * 从响应头的 Set-Cookie 里取出登录 Cookie —— 这是当前 B 站实际下发的位置。
 *
 * 不同 HTTP 实现对多条 Set-Cookie 的处理不一样（数组，或用逗号拼成一个字符串），
 * 而 Cookie 属性里的 `Expires=Wed, 17 Sep 2026` 本身就带逗号，按逗号切分会切坏。
 * 所以这里不做切分，直接按已知的 Cookie 名逐个正则提取。
 */
export function cookieFromSetCookie(headers: Record<string, string | string[]>): string {
  let raw: string | string[] | undefined;
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === "set-cookie") {
      raw = v;
      break;
    }
  }
  if (!raw) return "";
  const text = Array.isArray(raw) ? raw.join("\n") : String(raw);

  const parts: string[] = [];
  for (const name of WANTED_COOKIES) {
    // 前面必须是行首或分隔符，避免 DedeUserID 命中 DedeUserID__ckMd5
    const m = new RegExp(`(?:^|[;,\\s])${name}=([^;,\\s]+)`).exec(text);
    if (m?.[1]) parts.push(`${name}=${m[1]}`);
  }
  return parts.join("; ");
}

/**
 * 从跨域回调 URL 的查询串里取出 Cookie（旧版接口的形态，保留作兜底）。
 *
 * 必须按原样保留百分号编码：SESSDATA 的真实 Cookie 值本身就含 %2C / %2A，
 * 用 URLSearchParams 解码反而会得到一个无效的 Cookie。
 */
export function cookieFromCrossDomainUrl(url: string): string {
  const qs = url.split("?")[1] ?? "";
  const want = new Set<string>(WANTED_COOKIES);
  const parts: string[] = [];
  for (const pair of qs.split("&")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const name = pair.slice(0, idx);
    if (!want.has(name)) continue;
    parts.push(`${name}=${pair.slice(idx + 1)}`);
  }
  return parts.join("; ");
}

/** 轮询二维码状态。 */
export async function pollQr(http: HttpClient, key: string): Promise<QrStatus> {
  const res = await http.get(POLL_URL, { params: { qrcode_key: key }, headers: headers() });
  const json = parseJson<{ url?: string; refresh_token?: string; code?: number; message?: string }>(
    res,
    t("error.login.poll"),
  );
  if (json.code !== 0) {
    throw new BilibiliLoginError(t("error.login.pollFailed", { code: json.code, message: json.message ?? "" }));
  }
  switch (json.data?.code) {
    case 0: {
      // 现在 Cookie 在 Set-Cookie 响应头里；旧版接口放在回调 URL 的查询串，保留兜底
      const cookie =
        cookieFromSetCookie(res.headers) || cookieFromCrossDomainUrl(json.data?.url ?? "");
      if (!cookie.includes("SESSDATA=")) {
        const seen = Object.keys(res.headers).join(", ") || t("error.login.none");
        throw new BilibiliLoginError(t("error.login.noSessdata", { headers: seen }));
      }
      return { state: "ok", cookie, refreshToken: json.data?.refresh_token };
    }
    case 86090:
      return { state: "scanned" };
    case 86038:
      return { state: "expired" };
    default:
      return { state: "pending" };
  }
}
