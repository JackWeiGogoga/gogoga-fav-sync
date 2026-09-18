/**
 * 同步索引：记录「平台条目 id → 笔记路径」，用于去重和增量。
 *
 * 存在插件目录下的 index.json，而不是塞进 data.json，
 * 这样设置文件保持干净、体积也不会被上万条 id 撑爆。
 */
import type { App } from "obsidian";
import { normalizePath } from "obsidian";
import type { Platform } from "../types";

export interface IndexEntry {
  path: string;
  syncedAt: string;
  /**
   * 首次见到这条内容的时间。
   * X 的书签接口不返回收藏时间，用它当 collected 的替代，保证排序稳定。
   */
  firstSeenAt?: string;
}

/** 单个收藏夹的增量水位。 */
export interface FolderMark {
  /** 上次见过的最新 fav_time（秒）。 */
  mark: number;
  /** 上次同步时该收藏夹的条目数，用于整夹跳过。 */
  count: number;
}

/** 增量同步水位：记录上次同步到哪儿，下次据此提前收手。 */
export interface SyncState {
  /** B 站按收藏夹记录：最新一条的 fav_time（秒）与当时的条目数。 */
  bilibili?: { folders: Record<string, FolderMark> };
  /** X 记录上次见过的最新一条书签 id。 */
  x?: { newestId?: string };
}

interface IndexData {
  version: 1;
  entries: Record<string, IndexEntry>;
  state?: SyncState;
}

/** 索引 key：平台 + id，避免跨平台撞号。 */
function keyOf(platform: Platform, id: string): string {
  return `${platform}:${id}`;
}

export class IndexStore {
  private data: IndexData = { version: 1, entries: {} };

  constructor(
    private readonly app: App,
    private readonly filePath: string,
  ) {}

  async load(): Promise<void> {
    const path = normalizePath(this.filePath);
    try {
      if (await this.app.vault.adapter.exists(path)) {
        const raw = await this.app.vault.adapter.read(path);
        const parsed = JSON.parse(raw) as Partial<IndexData>;
        if (parsed?.entries) this.data = { version: 1, entries: parsed.entries };
      }
    } catch {
      // 索引损坏不该阻塞插件启动，重建即可
      this.data = { version: 1, entries: {} };
    }
  }

  async save(): Promise<void> {
    const path = normalizePath(this.filePath);
    const dir = path.slice(0, path.lastIndexOf("/"));
    if (dir && !(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    await this.app.vault.adapter.write(path, JSON.stringify(this.data));
  }

  get(platform: Platform, id: string): IndexEntry | undefined {
    return this.data.entries[keyOf(platform, id)];
  }

  has(platform: Platform, id: string): boolean {
    return keyOf(platform, id) in this.data.entries;
  }

  getState(): SyncState {
    return this.data.state ?? {};
  }

  setState(state: SyncState): void {
    this.data.state = state;
  }

  /** 清空增量水位，下次同步回到全量。 */
  clearState(): void {
    this.data.state = {};
  }

  set(platform: Platform, id: string, path: string): void {
    const key = keyOf(platform, id);
    const now = new Date().toISOString();
    // firstSeenAt 一旦写入就不再改动，否则每次同步排序都会被打乱
    const firstSeenAt = this.data.entries[key]?.firstSeenAt;
    this.data.entries[key] = { path, syncedAt: now, ...(firstSeenAt ? { firstSeenAt } : {}) };
  }

  /** 读取首次见到的时间。 */
  getFirstSeen(platform: Platform, id: string): string | undefined {
    return this.data.entries[keyOf(platform, id)]?.firstSeenAt;
  }

  /** 首次见到时间默认只写一次；force=true 用于全量同步重建基线。 */
  setFirstSeen(platform: Platform, id: string, iso: string, force = false): void {
    const key = keyOf(platform, id);
    const existing = this.data.entries[key];
    if (existing?.firstSeenAt && !force) return;
    this.data.entries[key] = existing
      ? { ...existing, firstSeenAt: iso }
      : { path: "", syncedAt: new Date().toISOString(), firstSeenAt: iso };
  }

  delete(platform: Platform, id: string): void {
    delete this.data.entries[keyOf(platform, id)];
  }

  clear(): void {
    this.data = { version: 1, entries: {} };
  }

  get size(): number {
    return Object.keys(this.data.entries).length;
  }

  /** 用扫描到的结果整体替换（重建索引用）。 */
  replaceAll(entries: Record<string, IndexEntry>): void {
    this.data = { version: 1, entries };
  }

  static buildKey = keyOf;
}
