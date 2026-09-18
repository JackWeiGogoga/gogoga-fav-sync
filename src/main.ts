import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import type { Platform, ProgressFn, SyncReport } from "./types";
import { DEFAULT_SETTINGS, mergeSettings, type FavSyncSettings } from "./settings";
import { IndexStore } from "./core/index-store";
import { SyncService } from "./core/sync";
import { obsidianHttp } from "./core/http";
import { normalizeCookieInput } from "./core/util";
import { listBilibiliFolders } from "./sources/bilibili";
import { fetchX } from "./sources/x";
import { FavSyncSettingTab } from "./settings-tab";
import { BilibiliQrLoginModal } from "./ui/qr-login-modal";
import { FavSyncView, VIEW_TYPE_FAV_SYNC } from "./ui/sidebar";

export default class FavSyncPlugin extends Plugin {
  settings: FavSyncSettings = DEFAULT_SETTINGS;
  index!: IndexStore;
  sync!: SyncService;
  private autoSyncTimer: number | null = null;
  private syncing = false;

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());

    this.index = new IndexStore(this.app, `${this.manifest.dir}/index.json`);
    await this.index.load();
    this.sync = new SyncService(this.app, () => this.settings, this.index);

    this.registerView(VIEW_TYPE_FAV_SYNC, (leaf: WorkspaceLeaf) => new FavSyncView(leaf, this));
    this.addSettingTab(new FavSyncSettingTab(this.app, this));

    this.addRibbonIcon("bookmark", "收藏同步", () => void this.activateView());

    this.addCommand({
      id: "open-sidebar",
      name: "打开收藏同步面板",
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "sync-all",
      name: "同步全部平台",
      callback: () => void this.runSyncWithNotice(null),
    });
    this.addCommand({
      id: "sync-bilibili",
      name: "同步 B 站收藏",
      callback: () => void this.runSyncWithNotice("bilibili"),
    });
    this.addCommand({
      id: "sync-x",
      name: "同步 X 书签",
      callback: () => void this.runSyncWithNotice("x"),
    });
    this.addCommand({
      id: "sync-all-full",
      name: "全量同步（忽略增量记录，重扫全部）",
      callback: () => void this.runSyncWithNotice(null, true),
    });
    this.addCommand({
      id: "bilibili-qr-login",
      name: "B 站扫码登录",
      callback: () => this.openBilibiliQrLogin(),
    });
    this.addCommand({
      id: "rebuild-index",
      name: "重建同步索引",
      callback: async () => {
        const n = await this.sync.rebuildIndex();
        new Notice(`索引已重建：${n} 条`);
      },
    });

    this.rescheduleAutoSync();
  }

  onunload(): void {
    if (this.autoSyncTimer !== null) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** 打开（或聚焦）右侧面板。 */
  async activateView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_FAV_SYNC);
    if (existing.length > 0 && existing[0]) {
      await workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_FAV_SYNC, active: true });
    await workspace.revealLeaf(leaf);
  }

  openSettings(): void {
    // Obsidian 未在公开类型里暴露 setting，这里按运行时结构调用
    const app = this.app as unknown as {
      setting: { open(): void; openTabById(id: string): void };
    };
    app.setting.open();
    app.setting.openTabById(this.manifest.id);
  }

  /**
   * 同步入口：platform 为 null 表示所有已启用平台。
   * full=true 忽略增量水位，做一次彻底重扫。
   */
  async runSync(
    platform: Platform | null,
    onProgress?: ProgressFn,
    full = false,
  ): Promise<SyncReport[]> {
    if (this.syncing) {
      new Notice("同步正在进行中");
      return [];
    }
    this.syncing = true;
    try {
      const targets: Platform[] = platform
        ? [platform]
        : ([
            this.settings.bilibili.enabled ? "bilibili" : null,
            this.settings.x.enabled ? "x" : null,
          ].filter(Boolean) as Platform[]);

      const reports: SyncReport[] = [];
      for (const p of targets) {
        const report = await this.sync.syncPlatform(p, onProgress, full);
        reports.push(report);
        if (report.errors.length === 0) {
          this.settings.lastSyncAt[p] = new Date().toISOString();
          await this.saveSettings();
        }
      }
      return reports;
    } finally {
      this.syncing = false;
    }
  }

  private async runSyncWithNotice(platform: Platform | null, full = false): Promise<void> {
    const notice = new Notice(full ? "全量同步中…" : "同步中…", 0);
    try {
      const reports = await this.runSync(
        platform,
        (p) => notice.setMessage(`同步中：${p.message}`),
        full,
      );
      if (reports.length === 0) {
        notice.setMessage("没有启用的平台");
      } else {
        const summary = reports
          .map((r) => {
            const label = r.platform === "bilibili" ? "B 站" : "X";
            return r.errors.length > 0
              ? `${label} 失败：${r.errors[0]}`
              : `${label} 新增 ${r.created} / 更新 ${r.updated}`;
          })
          .join("\n");
        notice.setMessage(summary);
      }
    } catch (err) {
      notice.setMessage(`同步失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      window.setTimeout(() => notice.hide(), 6000);
    }
  }

  /** 按设置重建定时器。 */
  rescheduleAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (!this.settings.autoSyncEnabled) return;
    const ms = Math.max(30, this.settings.autoSyncIntervalMinutes) * 60_000;
    this.autoSyncTimer = window.setInterval(() => {
      void this.runSync(null);
    }, ms);
    this.registerInterval(this.autoSyncTimer);
  }

  /** 扫码登录：成功后把 Cookie 写入设置。 */
  openBilibiliQrLogin(onDone?: () => void): void {
    new BilibiliQrLoginModal(this.app, async (cookie) => {
      this.settings.bilibili.cookie = cookie;
      await this.saveSettings();
      onDone?.();
    }).open();
  }

  /** 设置面板里的「测试连接」：返回收藏夹名列表。 */
  async testBilibili(): Promise<string[]> {
    const cookie = normalizeCookieInput(this.settings.bilibili.cookie);
    if (!cookie) throw new Error("请先填写 Cookie");
    return listBilibiliFolders(obsidianHttp, cookie);
  }

  /** 设置面板里的「测试连接」：返回首页拿到的书签条数。 */
  async testX(): Promise<number> {
    const items = await fetchX(obsidianHttp, { ...this.settings.x, maxPages: 1 });
    return items.length;
  }
}
