/**
 * X（Twitter）书签采集。
 *
 * 走 x.com 网页端自己在用的内部 GraphQL 接口，用浏览器里的
 * auth_token + ct0 两个 Cookie 认证，不需要开发者账号或付费 API。
 *
 * 注意：这是非公开接口，X 改版时 queryId / features 可能需要更新，
 * 因此二者都做成可在设置里覆盖。
 */
import type { CollectItem, HttpClient, MediaRef, ProgressFn } from "../types";
import { X_BEARER, type XSettings } from "../settings";
import { sleep, truncate } from "../core/util";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Bookmarks 查询需要的特性开关；缺字段会被服务端拒绝，故尽量给全。 */
const FEATURES: Record<string, boolean> = {
  graphql_timeline_v2_bookmark_timeline: true,
  rweb_video_screen_enabled: false,
  payments_enabled: false,
  profile_label_improvements_pcf_label_in_post_enabled: true,
  rweb_tipjar_consumption_enabled: true,
  verified_phone_label_enabled: false,
  creator_subscriptions_tweet_preview_api_enabled: true,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  premium_content_api_read_enabled: false,
  communities_web_enable_tweet_community_results_fetch: true,
  c9s_tweet_anatomy_moderator_badge_enabled: true,
  responsive_web_grok_analyze_button_fetch_trends_enabled: false,
  responsive_web_grok_analyze_post_followups_enabled: true,
  responsive_web_jetfuel_frame: false,
  responsive_web_grok_share_attachment_enabled: true,
  articles_preview_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweet_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: true,
  tweet_awards_web_tipping_enabled: false,
  responsive_web_grok_show_grok_translated_post: false,
  responsive_web_grok_analysis_button_from_backend: false,
  creator_subscriptions_quote_tweet_preview_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweet_rich_text_read_enabled: true,
  longform_notetweet_inline_media_enabled: true,
  responsive_web_grok_image_annotation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
};

export class XError extends Error {}

function headers(s: XSettings): Record<string, string> {
  return {
    "User-Agent": UA,
    Authorization: `Bearer ${X_BEARER}`,
    "x-csrf-token": s.csrfToken,
    "x-twitter-auth-type": "OAuth2Session",
    "x-twitter-active-user": "yes",
    "x-twitter-client-language": "en",
    "content-type": "application/json",
    Referer: "https://x.com/i/bookmarks",
    Cookie: `auth_token=${s.authToken}; ct0=${s.csrfToken}`,
  };
}

/* GraphQL 响应结构复杂且多变，这里只声明用到的部分，其余按 unknown 处理。 */
type Json = Record<string, any>;

function pickUser(result: Json): { name?: string; screenName?: string } {
  const user = result?.core?.user_results?.result ?? {};
  // 新版把字段挪到了 core 下，旧版在 legacy，两者都兜住
  const screenName = user?.core?.screen_name ?? user?.legacy?.screen_name;
  const name = user?.core?.name ?? user?.legacy?.name;
  return { name, screenName };
}

function pickText(result: Json): string {
  const note = result?.note_tweet?.note_tweet_results?.result?.text;
  if (typeof note === "string" && note.length > 0) return note;
  const full = result?.legacy?.full_text;
  return typeof full === "string" ? full : "";
}

function pickMedia(result: Json): MediaRef[] {
  const list: Json[] =
    result?.legacy?.extended_entities?.media ?? result?.legacy?.entities?.media ?? [];
  const out: MediaRef[] = [];
  for (const m of list) {
    const thumb = typeof m?.media_url_https === "string" ? m.media_url_https : undefined;
    if (m?.type === "photo") {
      if (thumb) out.push({ type: "image", url: thumb });
      continue;
    }
    // video / animated_gif：挑码率最高的 mp4
    const variants: Json[] = m?.video_info?.variants ?? [];
    const mp4 = variants
      .filter((v) => v?.content_type === "video/mp4" && typeof v?.url === "string")
      .sort((a, b) => (b?.bitrate ?? 0) - (a?.bitrate ?? 0))[0];
    if (mp4?.url) {
      out.push({ type: m?.type === "animated_gif" ? "gif" : "video", url: mp4.url, thumb });
    } else if (thumb) {
      out.push({ type: "image", url: thumb });
    }
  }
  return out;
}

function pickHashtags(result: Json): string[] {
  const tags: Json[] = result?.legacy?.entities?.hashtags ?? [];
  return tags.map((t) => String(t?.text ?? "")).filter(Boolean);
}

/** 把 X 的 created_at（"Wed Mar 15 12:00:00 +0000 2025"）转 ISO。 */
function toIso(createdAt?: string): string | undefined {
  if (!createdAt) return undefined;
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** 从 tweet_results.result 解出统一条目；无法识别时返回 null。 */
function tweetToItem(rawResult: Json): CollectItem | null {
  // 受限可见性的推文会多包一层
  const result: Json = rawResult?.tweet ?? rawResult;
  const id = result?.rest_id ?? result?.legacy?.id_str;
  if (!id) return null;

  const { name, screenName } = pickUser(result);
  const text = pickText(result);
  const media = pickMedia(result);
  const quoted = result?.quoted_status_result?.result;
  const quotedText = quoted ? pickText(quoted?.tweet ?? quoted) : "";
  const quotedUser = quoted ? pickUser(quoted?.tweet ?? quoted) : undefined;

  const extra: Record<string, string | number | boolean> = {};
  if (quotedText) {
    extra.quoted_author = quotedUser?.screenName ? `@${quotedUser.screenName}` : "";
    extra.quoted_text = truncate(quotedText, 400);
  }

  return {
    platform: "x",
    id: String(id),
    title: truncate(text, 60) || `tweet-${id}`,
    url: `https://x.com/${screenName ?? "i"}/status/${id}`,
    author: screenName ? `@${screenName}` : name,
    authorUrl: screenName ? `https://x.com/${screenName}` : undefined,
    cover: media.find((m) => m.thumb || m.type === "image")?.thumb ?? undefined,
    description: text,
    folders: [],
    tags: pickHashtags(result),
    publishedAt: toIso(result?.legacy?.created_at),
    collectedAt: undefined,
    status: "active",
    media,
    extra,
  };
}

/** 遍历 GraphQL 返回的 instructions，取出推文条目与下一页游标。 */
function parseTimeline(json: Json): { items: CollectItem[]; cursor?: string } {
  const instructions: Json[] =
    json?.data?.bookmark_timeline_v2?.timeline?.instructions ??
    json?.data?.bookmark_timeline?.timeline?.instructions ??
    [];
  const items: CollectItem[] = [];
  let cursor: string | undefined;

  for (const ins of instructions) {
    if (ins?.type !== "TimelineAddEntries") continue;
    for (const entry of (ins?.entries ?? []) as Json[]) {
      const entryId = String(entry?.entryId ?? "");
      if (entryId.startsWith("cursor-bottom-")) {
        cursor = entry?.content?.value;
        continue;
      }
      if (!entryId.startsWith("tweet-")) continue;
      const result = entry?.content?.itemContent?.tweet_results?.result;
      if (!result) continue;
      const item = tweetToItem(result);
      if (item) items.push(item);
    }
  }
  return { items, cursor };
}

export interface XFetchOptions {
  /** 增量模式：整页都是已同步过的就停。 */
  incremental: boolean;
  /** 判断某条书签是否已经同步过。 */
  isKnown(id: string): boolean;
}

/** 拉取书签，按游标翻页直到没有新内容或达到页数上限。 */
export async function fetchX(
  http: HttpClient,
  settings: XSettings,
  onProgress?: ProgressFn,
  opts?: XFetchOptions,
): Promise<CollectItem[]> {
  if (!settings.authToken || !settings.csrfToken) {
    throw new XError("请先填写 auth_token 与 ct0");
  }

  const all = new Map<string, CollectItem>();
  let cursor: string | undefined;

  for (let page = 1; page <= settings.maxPages; page += 1) {
    const variables: Record<string, unknown> = {
      count: settings.pageSize,
      includePromotedContent: false,
    };
    if (cursor) variables.cursor = cursor;

    const url = `https://x.com/i/api/graphql/${settings.queryId}/Bookmarks`;
    const res = await http.get(url, {
      params: {
        variables: JSON.stringify(variables),
        features: JSON.stringify(FEATURES),
      },
      headers: headers(settings),
    });

    if (res.status === 404) {
      throw new XError(
        "queryId 已失效（404）。请在浏览器打开 x.com/i/bookmarks，" +
          "开发者工具 Network 里找到 Bookmarks 请求，把 URL 中 /graphql/ 后面那段填到设置里。",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new XError(`登录态无效（HTTP ${res.status}），请重新复制 auth_token 与 ct0`);
    }
    if (res.status === 429) {
      throw new XError("触发 X 速率限制（429），请稍后再试");
    }
    if (res.status >= 400) {
      throw new XError(`X 接口返回 HTTP ${res.status}`);
    }

    const json = res.json<Json>();
    if (Array.isArray(json?.errors) && json.errors.length > 0) {
      const msg = json.errors.map((e: Json) => e?.message).filter(Boolean).join("; ");
      throw new XError(`X 接口报错：${msg || "未知错误"}`);
    }

    const { items, cursor: next } = parseTimeline(json);
    let added = 0;
    let unseen = 0;
    for (const item of items) {
      if (!all.has(item.id)) {
        all.set(item.id, item);
        added += 1;
      }
      if (!opts?.isKnown(item.id)) unseen += 1;
    }
    onProgress?.({
      phase: "fetch",
      message: `第 ${page} 页，累计 ${all.size} 条`,
      current: page,
      total: settings.maxPages,
    });

    // 书签按加入时间倒序返回：整页都已同步过，说明后面全是旧的
    if (opts?.incremental && items.length > 0 && unseen === 0) break;

    // 没有新增或没有游标即到底
    if (added === 0 || !next || next === cursor) break;
    cursor = next;
    await sleep(settings.requestDelayMs);
  }

  return [...all.values()];
}
