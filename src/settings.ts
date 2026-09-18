import type { Platform } from "./types";

/** 每个平台共有的组织方式配置：目录、文件名、标签怎么生成。 */
export interface OrganizeSettings {
  /**
   * 目录模板，`/` 分隔。可用 token：
   * {platform} {folder} {author} {year} {month} {date}
   */
  dirTemplate: string;
  /** 文件名模板（不含扩展名）。可用 token 同上，另有 {title} {id}。 */
  fileTemplate: string;
  /** 标签模板列表，逐条渲染；渲染结果为空则跳过。 */
  tagTemplates: string[];
  /** 一条内容属于多个收藏夹时：primary=只放首个目录，all=每个收藏夹各写一份。 */
  multiFolderMode: "primary" | "all";
}

export interface BilibiliSettings extends OrganizeSettings {
  enabled: boolean;
  /** Cookie-Editor 的 JSON 或 `k=v; k2=v2` 字符串，二者皆可。 */
  cookie: string;
  /** 同步“稍后再看”。 */
  includeWatchLater: boolean;
  /** “稍后再看”在目录/标签里显示的名字。 */
  watchLaterName: string;
  /** 只同步这些收藏夹（名称，留空=全部）。 */
  folderAllowlist: string[];
  /** 排除这些收藏夹。 */
  folderBlocklist: string[];
  /** 每个收藏夹最多翻多少页。 */
  maxPagesPerFolder: number;
  /** 每页条数（B 站上限 20）。 */
  pageSize: number;
  /** 请求间隔毫秒，防风控。 */
  requestDelayMs: number;
}

export interface XSettings extends OrganizeSettings {
  enabled: boolean;
  /** x.com 的 auth_token cookie。 */
  authToken: string;
  /** x.com 的 ct0 cookie（同时用作 x-csrf-token）。 */
  csrfToken: string;
  /** Bookmarks GraphQL 的 queryId，X 改版时需要更新。 */
  queryId: string;
  /** 每页条数。 */
  pageSize: number;
  /** 最多翻多少页。 */
  maxPages: number;
  requestDelayMs: number;
}

export interface FavSyncSettings {
  /** 所有笔记的根目录。 */
  rootFolder: string;
  bilibili: BilibiliSettings;
  x: XSettings;
  /** 已存在的笔记是否刷新机器区（用户手写区始终保留）。 */
  updateExisting: boolean;
  /** 增量同步：只拉上次同步之后新增的内容，大幅减少请求数。 */
  incrementalSync: boolean;
  /** 是否在正文中嵌入封面图（没有播放器时的兜底）。 */
  embedCover: boolean;
  /** 用 iframe 嵌入官方播放器，可在笔记里直接播放。 */
  embedPlayer: boolean;
  /** 自动同步。 */
  autoSyncEnabled: boolean;
  autoSyncIntervalMinutes: number;
  /** 上次自动同步时间（ISO），按平台记录。 */
  lastSyncAt: Partial<Record<Platform, string>>;
}

/** X 网页端公开使用的 Bearer（所有访客一致，非个人凭证）。 */
export const X_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

export const DEFAULT_SETTINGS: FavSyncSettings = {
  rootFolder: "favorites",
  updateExisting: true,
  incrementalSync: true,
  embedCover: true,
  embedPlayer: true,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 180,
  lastSyncAt: {},
  bilibili: {
    enabled: true,
    cookie: "",
    dirTemplate: "{platform}/{folder}",
    fileTemplate: "{title}",
    tagTemplates: ["favorites/bilibili", "bilibili/{folder}"],
    multiFolderMode: "primary",
    includeWatchLater: true,
    watchLaterName: "稍后再看",
    folderAllowlist: [],
    folderBlocklist: [],
    maxPagesPerFolder: 20,
    pageSize: 20,
    requestDelayMs: 800,
  },
  x: {
    enabled: false,
    authToken: "",
    csrfToken: "",
    queryId: "QUjXply7fA7fk05FRyajEg",
    dirTemplate: "{platform}",
    fileTemplate: "{published} {title}",
    tagTemplates: ["favorites/x"],
    multiFolderMode: "primary",
    pageSize: 50,
    maxPages: 20,
    requestDelayMs: 1200,
  },
};

/** 深合并用户设置与默认值，保证新增字段有默认。 */
export function mergeSettings(saved: unknown): FavSyncSettings {
  const s = (saved ?? {}) as Partial<FavSyncSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    bilibili: { ...DEFAULT_SETTINGS.bilibili, ...(s.bilibili ?? {}) },
    x: { ...DEFAULT_SETTINGS.x, ...(s.x ?? {}) },
    lastSyncAt: { ...(s.lastSyncAt ?? {}) },
  };
}
