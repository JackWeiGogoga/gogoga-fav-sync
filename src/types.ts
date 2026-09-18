/** 平台标识。 */
export type Platform = "bilibili" | "x";

/** 一条收藏在写入笔记前的统一形态：各平台适配器都产出它。 */
export interface CollectItem {
  platform: Platform;
  /** 平台内唯一 id：B 站 bvid / X tweet id。用于去重与回查。 */
  id: string;
  title: string;
  url: string;
  author?: string;
  authorUrl?: string;
  cover?: string;
  /** 正文/简介（B 站视频简介、X 推文全文）。 */
  description?: string;
  /** 归属分组：B 站收藏夹名（可多个）、X 书签文件夹；无分组时为空数组。 */
  folders: string[];
  /** 平台自带话题标签（X hashtag 等）。 */
  tags: string[];
  durationSec?: number;
  /** 内容发布时间 ISO。 */
  publishedAt?: string;
  /** 收藏时间 ISO。 */
  collectedAt?: string;
  /** invalid = 已失效（下架/删除/私密），笔记保留但标记。 */
  status: "active" | "invalid";
  media: MediaRef[];
  /** 平台特有的额外字段，写入 frontmatter 的 extra 区。 */
  extra?: Record<string, string | number | boolean>;
}

export interface MediaRef {
  type: "image" | "video" | "gif";
  url: string;
  thumb?: string;
}

/** 最小 HTTP 抽象：插件内用 Obsidian requestUrl 实现，测试脚本用 fetch 实现。 */
export interface HttpClient {
  get(
    url: string,
    init?: { params?: Record<string, string>; headers?: Record<string, string> },
  ): Promise<HttpResponse>;
}

export interface HttpResponse {
  status: number;
  text: string;
  /**
   * 响应头。set-cookie 在不同实现下可能是字符串或字符串数组，
   * B 站扫码登录要靠它拿 Cookie，所以这里不收窄类型。
   */
  headers: Record<string, string | string[]>;
  json<T = unknown>(): T;
}

/** 同步过程中回传给 UI 的进度。 */
export interface SyncProgress {
  phase: "fetch" | "write" | "done" | "error";
  message: string;
  current?: number;
  total?: number;
}

export type ProgressFn = (p: SyncProgress) => void;

/** 一次同步的结果报告。 */
export interface SyncReport {
  platform: Platform;
  startedAt: string;
  finishedAt: string;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  /** 本次实际发出的网络请求数，用来观察增量是否生效。 */
  requests: number;
  /** 因未发生变化而整组跳过的数量（B 站的收藏夹）。 */
  skippedGroups: number;
  errors: string[];
}

export function emptyReport(platform: Platform): SyncReport {
  return {
    platform,
    startedAt: new Date().toISOString(),
    finishedAt: "",
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    requests: 0,
    skippedGroups: 0,
    errors: [],
  };
}
