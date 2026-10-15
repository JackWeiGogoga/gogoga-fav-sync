import { Notice, Plugin, WorkspaceLeaf, getLanguage } from "obsidian";
import { setLocale, t } from "./i18n";
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
    // 先定语言：之后注册的命令名、ribbon 提示都按它取文案
    setLocale(getLanguage());
    this.settings = mergeSettings(await this.loadData());

    this.index = new IndexStore(this.app, `${this.manifest.dir}/index.json`);
    await this.index.load();
    this.sync = new SyncService(this.app, () => this.settings, this.index);

    this.registerView(VIEW_TYPE_FAV_SYNC, (leaf: WorkspaceLeaf) => new FavSyncView(leaf, this));
    this.addSettingTab(new FavSyncSettingTab(this.app, this));

    this.addRibbonIcon("bookmark", t("ribbon.open"), () => void this.activateView());

    this.addCommand({
      id: "open-sidebar",
      name: t("cmd.openSidebar"),
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: "sync-all",
      name: t("cmd.syncAll"),
      callback: () => void this.runSyncWithNotice(null),
    });
    this.addCommand({
      id: "sync-bilibili",
      name: t("cmd.syncBilibili"),
      callback: () => void this.runSyncWithNotice("bilibili"),
    });
    this.addCommand({
      id: "sync-x",
      name: t("cmd.syncX"),
      callback: () => void this.runSyncWithNotice("x"),
    });
    this.addCommand({
      id: "sync-all-full",
      name: t("cmd.syncAllFull"),
      callback: () => void this.runSyncWithNotice(null, true),
    });
    this.addCommand({
      id: "bilibili-qr-login",
      name: t("cmd.bilibiliQrLogin"),
      callback: () => this.openBilibiliQrLogin(),
    });
    this.addCommand({
      id: "rebuild-index",
      name: t("cmd.rebuildIndex"),
      callback: async () => {
        const n = await this.sync.rebuildIndex();
        new Notice(t("notice.indexRebuilt", { n }));
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
      new Notice(t("notice.syncInProgress"));
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
    const notice = new Notice(full ? t("notice.fullSyncing") : t("notice.syncing"), 0);
    try {
      const reports = await this.runSync(
        platform,
        (p) => notice.setMessage(t("notice.syncingProgress", { message: p.message })),
        full,
      );
      if (reports.length === 0) {
        notice.setMessage(t("notice.noPlatforms"));
      } else {
        const summary = reports
          .map((r) => {
            const label = t(r.platform === "bilibili" ? "platform.bilibili" : "platform.x");
            return r.errors.length > 0
              ? t("notice.platformFailed", { label, error: r.errors[0] ?? "" })
              : t("notice.platformDone", { label, created: r.created, updated: r.updated });
          })
          .join("\n");
        notice.setMessage(summary);
      }
    } catch (err) {
      notice.setMessage(t("notice.syncFailed", { error: err instanceof Error ? err.message : String(err) }));
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
    if (!cookie) throw new Error(t("error.noCookie"));
    return listBilibiliFolders(obsidianHttp, cookie);
  }

  /** 设置面板里的「测试连接」：返回首页拿到的书签条数。 */
  async testX(): Promise<number> {
    const items = await fetchX(obsidianHttp, { ...this.settings.x, maxPages: 1 });
    return items.length;
  }
}
