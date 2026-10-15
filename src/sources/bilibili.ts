/**
 * B 站收藏采集。
 *
 * 链路：nav 取 wbi 密钥 → 列出全部收藏夹 → 逐夹翻页 → （可选）稍后再看。
 * 全部走带 Cookie 的普通 HTTP + WBI 签名，不需要浏览器。
 *
 * 与 omni-collector 的关键差异：**保留收藏夹归属**，
 * 同一视频出现在多个收藏夹时合并为一条、folders 记录全部来源。
 */
import type { CollectItem, HttpClient, ProgressFn } from "../types";
import type { BilibiliSettings } from "../settings";
import type { FolderMark } from "../core/index-store";
import { getMixinKey, keyFromUrl, signParams } from "./wbi";
import { parseCookie, sleep, tsToIso } from "../core/util";
import { t } from "../i18n";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NAV_URL = "https://api.bilibili.com/x/web-interface/nav";
const FOLDERS_URL = "https://api.bilibili.com/x/v3/fav/folder/created/list-all";
const FAV_LIST_URL = "https://api.bilibili.com/x/v3/fav/resource/list";
const WATCH_LATER_URL = "https://api.bilibili.com/x/v2/medialist/watch/later/list";

interface BiliFolder {
  id: number;
  title: string;
  media_count?: number;
}

interface BiliMedia {
  id?: number;
  bvid?: string;
  title?: string;
  cover?: string;
  intro?: string;
  duration?: number;
  /** attr 非 0 表示失效（被删/私密）。 */
  attr?: number;
  pubtime?: number;
  ctime?: number;
  fav_time?: number;
  upper?: { mid?: number; name?: string };
}

function headers(cookie: string): Record<string, string> {
  return {
    "User-Agent": UA,
    Referer: "https://www.bilibili.com/",
    Origin: "https://www.bilibili.com",
    Cookie: cookie,
  };
}

/** B 站接口统一响应外壳。 */
interface BiliResp<T> {
  code: number;
  message?: string;
  data?: T;
}

export class BilibiliError extends Error {}

/**
 * 安全解析 B 站响应。
 * 触发风控时接口会返回一个 HTML 页面而不是 JSON，
 * 直接 JSON.parse 会抛出难以理解的 "Unexpected token '<'"，这里换成人话。
 */
function parseBili<T>(res: { status: number; text: string; json<X>(): X }, what: string): BiliResp<T> {
  const head = res.text.trimStart().slice(0, 1);
  if (head === "<") {
    throw new BilibiliError(t("error.bili.htmlResponse", { what }));
  }
  try {
    return res.json<BiliResp<T>>();
  } catch {
    throw new BilibiliError(t("error.bili.unparsable", { what, status: res.status }));
  }
}

/** 取 wbi 混淆密钥，同时验证 cookie 是否有效。 */
async function fetchMixinKey(http: HttpClient, cookie: string): Promise<string> {
  const res = await http.get(NAV_URL, { headers: headers(cookie) });
  const json = parseBili<{ isLogin?: boolean; wbi_img?: { img_url?: string; sub_url?: string } }>(res, t("error.bili.loginCheck"));
  const img = json.data?.wbi_img;
  const key = getMixinKey(keyFromUrl(img?.img_url), keyFromUrl(img?.sub_url));
  if (!key) throw new BilibiliError(t("error.bili.noWbiKey"));
  if (json.data?.isLogin === false) {
    throw new BilibiliError(t("error.bili.notLoggedIn"));
  }
  return key;
}

/** 列出当前账号创建的全部收藏夹。 */
async function fetchFolders(http: HttpClient, cookie: string, mid: string): Promise<BiliFolder[]> {
  const res = await http.get(FOLDERS_URL, {
    params: { up_mid: mid, jsonp: "jsonp" },
    headers: headers(cookie),
  });
  const json = parseBili<{ list?: BiliFolder[] }>(res, t("error.bili.folderList"));
  if (json.code !== 0) {
    throw new BilibiliError(t("error.bili.folderListFailed", { code: json.code, message: json.message ?? "" }));
  }
  return json.data?.list ?? [];
}

function mediaToItem(m: BiliMedia, folder: string): CollectItem | null {
  const bvid = m.bvid;
  if (!bvid) return null;
  const mid = m.upper?.mid;
  return {
    platform: "bilibili",
    id: bvid,
    title: (m.title ?? "").trim() || bvid,
    url: `https://www.bilibili.com/video/${bvid}`,
    author: m.upper?.name,
    authorUrl: mid ? `https://space.bilibili.com/${mid}` : undefined,
    cover: m.cover?.replace(/^http:/, "https:"),
    description: m.intro?.trim() || undefined,
    folders: folder ? [folder] : [],
    tags: [],
    durationSec: m.duration,
    publishedAt: tsToIso(m.pubtime ?? m.ctime),
    collectedAt: tsToIso(m.fav_time),
    // attr 非 0 说明内容已失效，仍然建笔记但标注出来
    status: m.attr && m.attr !== 0 ? "invalid" : "active",
    media: [],
  };
}

/** 同一 bvid 在多个收藏夹出现时合并，folders 累加。 */
function mergeItem(map: Map<string, CollectItem>, item: CollectItem): void {
  const existing = map.get(item.id);
  if (!existing) {
    map.set(item.id, item);
    return;
  }
  for (const f of item.folders) {
    if (!existing.folders.includes(f)) existing.folders.push(f);
  }
  // 保留最早的收藏时间，信息更完整的一份为准
  if (item.collectedAt && (!existing.collectedAt || item.collectedAt < existing.collectedAt)) {
    existing.collectedAt = item.collectedAt;
  }
  if (!existing.description && item.description) existing.description = item.description;
}

/** 仅验证 Cookie 并返回收藏夹名列表，供设置页「测试连接」使用。 */
export async function listBilibiliFolders(http: HttpClient, cookie: string): Promise<string[]> {
  const mid = parseCookie(cookie)["DedeUserID"];
  if (!mid) throw new BilibiliError(t("error.bili.noDedeUserId"));
  await fetchMixinKey(http, cookie);
  const folders = await fetchFolders(http, cookie, mid);
  return folders.map((f) => f.title);
}

export interface BilibiliFetchResult {
  items: CollectItem[];
  folderNames: string[];
  /** 各收藏夹的新水位，供下次增量使用。 */
  watermarks: Record<string, FolderMark>;
  /** 本次实际发出的请求数，用于向用户展示增量效果。 */
  requests: number;
  /** 因条目数未变而整夹跳过的数量。 */
  skippedFolders: number;
}

export interface BilibiliFetchOptions {
  /** 增量模式：条目数没变的收藏夹整个跳过，其余翻到上次水位就停。 */
  incremental: boolean;
  /** 上次的水位表：收藏夹 id → 水位。 */
  watermarks: Record<string, FolderMark>;
}

/** 拉取全部收藏（含可选的稍后再看）。 */
export async function fetchBilibili(
  http: HttpClient,
  settings: BilibiliSettings,
  cookie: string,
  onProgress?: ProgressFn,
  opts?: BilibiliFetchOptions,
): Promise<BilibiliFetchResult> {
  const jar = parseCookie(cookie);
  const mid = jar["DedeUserID"];
  if (!mid) throw new BilibiliError(t("error.bili.noDedeUserId"));

  const incremental = opts?.incremental ?? false;
  const oldMarks = opts?.watermarks ?? {};
  const watermarks: Record<string, FolderMark> = { ...oldMarks };
  let requests = 0;
  let skippedFolders = 0;

  const mixinKey = await fetchMixinKey(http, cookie);
  const allFolders = await fetchFolders(http, cookie, mid);
  requests += 2;

  const allow = settings.folderAllowlist.map((s) => s.trim()).filter(Boolean);
  const block = settings.folderBlocklist.map((s) => s.trim()).filter(Boolean);
  const folders = allFolders.filter((f) => {
    if (allow.length > 0 && !allow.includes(f.title)) return false;
    if (block.includes(f.title)) return false;
    return true;
  });

  const merged = new Map<string, CollectItem>();
  const usedFolders: string[] = [];

  for (let fi = 0; fi < folders.length; fi += 1) {
    const folder = folders[fi];
    if (!folder) continue;
    usedFolders.push(folder.title);
    onProgress?.({
      phase: "fetch",
      message: t("progress.folder", { name: folder.title }),
      current: fi + 1,
      total: folders.length,
    });

    const prev = oldMarks[String(folder.id)];
    const mark = prev?.mark ?? 0;

    // 条目数与上次一致 → 该收藏夹没有增删，整个跳过，一次请求都不发。
    // 代价：同时增删各一条会数量不变而被漏掉，用「全量同步」可兜底。
    if (incremental && prev && prev.count === folder.media_count && mark > 0) {
      skippedFolders += 1;
      continue;
    }

    let folderNewest = mark;
    // complete = 这一夹已经处理干净：要么翻到底了，要么增量下已追平水位。
    // 只有 complete 时才记录 count，否则下次会误判“没变化”而跳过未扫完的部分。
    let complete = false;

    for (let pn = 1; pn <= settings.maxPagesPerFolder; pn += 1) {
      const params = signParams(
        {
          media_id: String(folder.id),
          pn: String(pn),
          ps: String(settings.pageSize),
          platform: "web",
        },
        mixinKey,
      );
      const res = await http.get(FAV_LIST_URL, { params, headers: headers(cookie) });
      requests += 1;
      const json = parseBili<{ medias?: BiliMedia[]; has_more?: boolean }>(res, t("progress.folder", { name: folder.title }));
      if (json.code !== 0) {
        // 412/-352 是风控，直接中止本次同步，避免继续触发
        if (json.code === -412 || json.code === -352) {
          throw new BilibiliError(t("error.bili.riskControl", { code: json.code }));
        }
        break;
      }
      const medias = json.data?.medias ?? [];
      let pageNewest = 0;
      for (const m of medias) {
        const item = mediaToItem(m, folder.title);
        if (item) mergeItem(merged, item);
        pageNewest = Math.max(pageNewest, m.fav_time ?? 0);
      }
      folderNewest = Math.max(folderNewest, pageNewest);

      // 接口按 fav_time 倒序返回：本页最新的一条都不比上次水位新，
      // 说明后面全是已同步过的，已经追平，可以收手。
      if (incremental && mark > 0 && pageNewest <= mark) {
        complete = true;
        break;
      }

      // 翻到底了
      if (!json.data?.has_more || medias.length === 0) {
        complete = true;
        break;
      }
      await sleep(settings.requestDelayMs);
    }

    watermarks[String(folder.id)] = {
      mark: folderNewest,
      // 没处理干净就存 -1，保证下次一定重扫这一夹
      count: complete ? (folder.media_count ?? 0) : -1,
    };
    await sleep(settings.requestDelayMs);
  }

  if (settings.includeWatchLater) {
    onProgress?.({ phase: "fetch", message: t("progress.watchLater") });
    try {
      const params = signParams({ pn: "1", ps: "50" }, mixinKey);
      const res = await http.get(WATCH_LATER_URL, { params, headers: headers(cookie) });
      requests += 1;
      const json = parseBili<{ list?: Array<BiliMedia & { pic?: string; add_at?: number }> }>(res, t("progress.watchLater"));
      if (json.code === 0) {
        for (const m of json.data?.list ?? []) {
          const item = mediaToItem(
            { ...m, cover: m.cover ?? m.pic, fav_time: m.fav_time ?? m.add_at },
            settings.watchLaterName,
          );
          if (item) mergeItem(merged, item);
        }
        usedFolders.push(settings.watchLaterName);
      }
    } catch {
      // 稍后再看不可用不影响主流程
    }
  }

  return { items: [...merged.values()], folderNames: usedFolders, watermarks, requests, skippedFolders };
}
