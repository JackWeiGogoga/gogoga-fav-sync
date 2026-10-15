/**
 * 同步编排：采集 → 组织 → 写入 vault。
 *
 * 写入策略：
 * - 索引里没有 → 新建
 * - 索引里有且文件在 → 按设置刷新机器区（用户手写区保留）
 * - 目标路径变了（比如换了收藏夹）→ 连同笔记一起重命名，不产生重复
 */
import type { App } from "obsidian";
import { normalizePath, TFolder } from "obsidian";
import type { CollectItem, Platform, ProgressFn, SyncReport } from "../types";
import { emptyReport } from "../types";
import type { FavSyncSettings, OrganizeSettings } from "../settings";
import type { IndexStore } from "./index-store";
import { targetsFor, tagsFor } from "./organizer";
import { buildNote, updateNote } from "./note-builder";
import { obsidianHttp } from "./http";
import { fetchBilibili } from "../sources/bilibili";
import { fetchX } from "../sources/x";
import { normalizeCookieInput } from "./util";
import { t } from "../i18n";

/** 写进笔记的用户区标题。属于笔记数据而非界面文案，不随语言变化，否则已有笔记的结构会变。 */
const USER_SECTION = "我的笔记";

export class SyncService {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => FavSyncSettings,
    private readonly index: IndexStore,
  ) {}

  /**
   * 采集并写入某个平台。
   * full=true 时忽略增量水位做一次彻底重扫。
   */
  async syncPlatform(
    platform: Platform,
    onProgress?: ProgressFn,
    full = false,
  ): Promise<SyncReport> {
    const settings = this.getSettings();
    const report = emptyReport(platform);
    const incremental = settings.incrementalSync && !full;
    const state = this.index.getState();

    let items: CollectItem[] = [];
    try {
      if (platform === "bilibili") {
        const cookie = normalizeCookieInput(settings.bilibili.cookie);
        if (!cookie) throw new Error(t("error.noBilibiliCookie"));
        const res = await fetchBilibili(obsidianHttp, settings.bilibili, cookie, onProgress, {
          incremental,
          watermarks: state.bilibili?.folders ?? {},
        });
        items = res.items;
        report.requests = res.requests;
        report.skippedGroups = res.skippedFolders;
        this.index.setState({ ...state, bilibili: { folders: res.watermarks } });
      } else {
        items = await fetchX(obsidianHttp, settings.x, onProgress, {
          incremental,
          isKnown: (id) => this.index.has("x", id),
        });
      }
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : String(err));
      report.finishedAt = new Date().toISOString();
      onProgress?.({ phase: "error", message: report.errors[0] ?? t("progress.fetchFailed") });
      return report;
    }

    report.fetched = items.length;
    // X 没有收藏时间，用「首次见到」补上，否则排序无依据
    if (platform === "x") this.assignFirstSeen(items, full);
    const org: OrganizeSettings = platform === "bilibili" ? settings.bilibili : settings.x;
    await this.writeItems(items, org, settings, report, onProgress);

    report.finishedAt = new Date().toISOString();
    await this.index.save();
    onProgress?.({
      phase: "done",
      message: t("progress.done", {
        created: report.created,
        updated: report.updated,
        skipped: report.skipped,
      }),
    });
    return report;
  }

  /**
   * 给 X 条目补上 collectedAt。
   *
   * X 的书签接口只返回推文发布时间，不返回收藏时间，但列表本身是按收藏时间
   * 倒序返回的——顺序信息在，只是没有时间戳。于是：
   * - 已见过的条目：沿用首次记录的时间，保证每次同步排序不变
   * - 新条目：按时间线顺序依次赋值，且一定排在所有已见条目之后
   *
   * 首批回填的绝对时间是近似的，相对顺序是真实的。
   */
  private assignFirstSeen(items: CollectItem[], rebaseline = false): void {
    const STEP_MS = 1000;
    const now = Date.now();

    // 全量同步拿到的是完整时间线，直接以它为准重建基线。
    // 增量时不能这么做（只看得到顶部若干条），但增量也不需要——新书签本来就从顶部进。
    if (rebaseline) {
      items.forEach((item, idx) => {
        const iso = new Date(now - idx * STEP_MS).toISOString();
        item.collectedAt = iso;
        this.index.setFirstSeen("x", item.id, iso, true);
      });
      return;
    }

    // 已见过的直接沿用，同时记下最新的水位
    let floorMs = 0;
    const fresh: CollectItem[] = [];
    for (const item of items) {
      const seen = this.index.getFirstSeen("x", item.id);
      if (seen) {
        item.collectedAt = seen;
        floorMs = Math.max(floorMs, new Date(seen).getTime() || 0);
      } else {
        fresh.push(item);
      }
    }
    if (fresh.length === 0) return;

    // 新条目整体排在 floor 之后；fresh[0] 是时间线上最新的一条，给最大的时间
    const base = Math.max(floorMs, now - fresh.length * STEP_MS);
    fresh.forEach((item, idx) => {
      const iso = new Date(base + (fresh.length - idx) * STEP_MS).toISOString();
      item.collectedAt = iso;
      this.index.setFirstSeen("x", item.id, iso);
    });
  }

  private async writeItems(
    items: CollectItem[],
    org: OrganizeSettings,
    settings: FavSyncSettings,
    report: SyncReport,
    onProgress?: ProgressFn,
  ): Promise<void> {
    const buildOpts = {
      embedCover: settings.embedCover,
      embedPlayer: settings.embedPlayer,
      userSectionHeading: USER_SECTION,
    };

    // 按收藏时间升序写入：最新收藏的最后落盘，于是文件创建时间也与 collected 同序，
    // 这样即使不配置按 frontmatter 排序，「创建时间倒序」也等于「收藏时间倒序」。
    const ordered = [...items].sort((a, b) => (a.collectedAt ?? "").localeCompare(b.collectedAt ?? ""));

    // 扁平目录下不同条目可能算出同一个文件名，若不拦住会互相覆盖
    const claimed = new Map<string, string>();

    for (let i = 0; i < ordered.length; i += 1) {
      const item = ordered[i];
      if (!item) continue;
      if (i % 20 === 0) {
        onProgress?.({ phase: "write", message: t("progress.writing"), current: i, total: ordered.length });
      }

      const targets = targetsFor(item, org, settings.rootFolder);
      for (let ti = 0; ti < targets.length; ti += 1) {
        const target = targets[ti];
        if (!target) continue;
        // multiFolderMode=all 时，同一条目的第 2 个及以后的副本用带后缀的索引 key
        const indexId = ti === 0 ? item.id : `${item.id}#${ti}`;
        try {
          const tags = tagsFor(item, org, target.folder);

          // 同名冲突：本次已被别的条目占用就加 id 短后缀，避免一篇覆盖另一篇
          let targetPath = target.path;
          const owner = claimed.get(targetPath);
          if (owner !== undefined && owner !== indexId) {
            targetPath = targetPath.replace(/\.md$/, ` (${item.id.slice(-6)}).md`);
          }
          claimed.set(targetPath, indexId);

          const known = this.index.get(item.platform, indexId);
          const existingFile = known ? this.app.vault.getFileByPath(known.path) : null;

          if (existingFile && known && known.path !== targetPath) {
            // 目录规则或收藏夹变了 → 移动到新位置，保持一条笔记
            await this.ensureFolder(target.dir);
            await this.app.fileManager.renameFile(existingFile, targetPath);
          }

          const file = this.app.vault.getFileByPath(targetPath);
          if (file) {
            if (!settings.updateExisting) {
              report.skipped += 1;
              this.index.set(item.platform, indexId, targetPath);
              continue;
            }
            const before = await this.app.vault.read(file);
            const after = updateNote(before, item, tags, buildOpts);
            if (after !== before) {
              await this.app.vault.modify(file, after);
              report.updated += 1;
            } else {
              report.skipped += 1;
            }
          } else {
            await this.ensureFolder(target.dir);
            await this.app.vault.create(targetPath, buildNote(item, tags, buildOpts));
            report.created += 1;
          }
          this.index.set(item.platform, indexId, targetPath);
        } catch (err) {
          report.failed += 1;
          const msg = err instanceof Error ? err.message : String(err);
          if (report.errors.length < 10) report.errors.push(t("error.itemFailed", { title: item.title, error: msg }));
        }
      }
    }
  }

  /** 逐级创建目录。 */
  private async ensureFolder(dir: string): Promise<void> {
    if (!dir) return;
    const path = normalizePath(dir);
    if (this.app.vault.getFolderByPath(path)) return;
    const parts = path.split("/");
    let cur = "";
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      if (!this.app.vault.getFolderByPath(cur)) {
        try {
          await this.app.vault.createFolder(cur);
        } catch {
          // 并发/已存在时忽略
        }
      }
    }
  }

  /**
   * 扫描根目录下的笔记重建索引。
   * 用于换了机器、索引丢了、或手工整理过笔记之后恢复增量能力。
   */
  async rebuildIndex(onProgress?: ProgressFn): Promise<number> {
    const settings = this.getSettings();
    const root = this.app.vault.getFolderByPath(normalizePath(settings.rootFolder));
    if (!(root instanceof TFolder)) return 0;

    const entries: Record<string, { path: string; syncedAt: string; firstSeenAt?: string }> = {};
    const files = this.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(`${root.path}/`));
    const now = new Date().toISOString();

    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      if (!file) continue;
      if (i % 50 === 0) {
        onProgress?.({ phase: "write", message: t("progress.scanning"), current: i, total: files.length });
      }
      const cache = this.app.metadataCache.getFileCache(file);
      const fm = cache?.frontmatter as { source?: string; id?: string; collected?: string } | undefined;
      if (!fm?.source || !fm?.id) continue;
      if (fm.source !== "bilibili" && fm.source !== "x") continue;
      // 笔记里的 collected 就是当初记下的首次见到时间，从这里恢复，
      // 否则重建索引后 X 的排序会整体错乱
      const firstSeenAt =
        fm.source === "x" && fm.collected ? new Date(fm.collected).toISOString() : undefined;
      entries[`${fm.source}:${fm.id}`] = {
        path: file.path,
        syncedAt: now,
        ...(firstSeenAt ? { firstSeenAt } : {}),
      };
    }

    this.index.replaceAll(entries);
    await this.index.save();
    return Object.keys(entries).length;
  }
}
