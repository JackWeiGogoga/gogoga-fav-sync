import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type FavSyncPlugin from "../main";
import type { Platform, SyncProgress, SyncReport } from "../types";
import { t, type I18nKey } from "../i18n";

export const VIEW_TYPE_FAV_SYNC = "fav-sync-view";

interface PlatformMeta {
  key: Platform;
  /** 文案 key，而非文案本身：模块加载时语言还没确定，用到时再取。 */
  labelKey: I18nKey;
  icon: string;
}

const PLATFORMS: PlatformMeta[] = [
  { key: "bilibili", labelKey: "platform.bilibili", icon: "tv" },
  { key: "x", labelKey: "platform.x", icon: "message-circle" },
];

export class FavSyncView extends ItemView {
  private statusEl!: HTMLElement;
  private barEl!: HTMLElement;
  private barWrapEl!: HTMLElement;
  private reportEl!: HTMLElement;
  private cardsEl!: HTMLElement;
  private busy = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: FavSyncPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_FAV_SYNC;
  }

  getDisplayText(): string {
    return t("view.title");
  }

  getIcon(): string {
    return "bookmark";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    root.addClass("fav-sync-view");

    // 头部
    const header = root.createDiv({ cls: "fav-sync-header" });
    header.createEl("h3", { text: t("view.title"), cls: "fav-sync-title" });
    const settingsBtn = header.createEl("button", { cls: "fav-sync-icon-btn", attr: { "aria-label": t("view.settings") } });
    setIcon(settingsBtn, "settings");
    settingsBtn.onclick = () => this.plugin.openSettings();

    // 主操作
    const syncAll = root.createEl("button", { text: t("view.syncAll"), cls: "fav-sync-primary" });
    syncAll.onclick = () => void this.runSync(null);

    // 状态区
    this.statusEl = root.createDiv({ cls: "fav-sync-status", text: t("view.ready") });
    this.barWrapEl = root.createDiv({ cls: "fav-sync-bar-wrap" });
    this.barEl = this.barWrapEl.createDiv({ cls: "fav-sync-bar" });
    this.barWrapEl.hide();

    // 平台卡片
    this.cardsEl = root.createDiv({ cls: "fav-sync-cards" });
    this.renderCards();

    // 上次结果
    this.reportEl = root.createDiv({ cls: "fav-sync-report" });

    // 底部链接
    const footer = root.createDiv({ cls: "fav-sync-footer" });
    const rebuild = footer.createEl("a", { text: t("view.rebuildIndex"), cls: "fav-sync-link" });
    rebuild.onclick = async (e) => {
      e.preventDefault();
      if (this.busy) return;
      this.setBusy(true, t("view.scanningNotes"));
      const n = await this.plugin.sync.rebuildIndex((p) => this.onProgress(p));
      this.setBusy(false, t("notice.indexRebuilt", { n }));
      this.renderCards();
    };
  }

  private renderCards(): void {
    this.cardsEl.empty();
    const s = this.plugin.settings;

    for (const p of PLATFORMS) {
      const enabled = p.key === "bilibili" ? s.bilibili.enabled : s.x.enabled;
      const card = this.cardsEl.createDiv({ cls: `fav-sync-card${enabled ? "" : " is-disabled"}` });

      const left = card.createDiv({ cls: "fav-sync-card-left" });
      const iconEl = left.createDiv({ cls: "fav-sync-card-icon" });
      setIcon(iconEl, p.icon);

      const info = left.createDiv({ cls: "fav-sync-card-info" });
      info.createDiv({ text: t(p.labelKey), cls: "fav-sync-card-name" });
      const last = s.lastSyncAt[p.key];
      info.createDiv({
        text: enabled
          ? last
            ? t("view.lastSync", { time: this.relTime(last) })
            : t("view.neverSynced")
          : t("view.disabled"),
        cls: "fav-sync-card-sub",
      });

      const btn = card.createEl("button", { text: t("view.sync"), cls: "fav-sync-card-btn" });
      btn.disabled = !enabled || this.busy;
      btn.onclick = () => void this.runSync(p.key);
    }
  }

  private relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return "—";
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("view.justNow");
    if (min < 60) return t("view.minutesAgo", { n: min });
    const h = Math.floor(min / 60);
    if (h < 24) return t("view.hoursAgo", { n: h });
    return t("view.daysAgo", { n: Math.floor(h / 24) });
  }

  private setBusy(busy: boolean, status?: string): void {
    this.busy = busy;
    if (status) this.statusEl.setText(status);
    this.barWrapEl.toggle(busy);
    if (!busy) this.barEl.setCssProps({ width: "0%" });
    this.renderCards();
  }

  private onProgress(p: SyncProgress): void {
    this.statusEl.setText(p.message);
    if (p.total && p.total > 0 && p.current !== undefined) {
      this.barEl.setCssProps({ width: `${Math.min(100, Math.round((p.current / p.total) * 100))}%` });
    }
    if (p.phase === "error") this.statusEl.addClass("is-error");
    else this.statusEl.removeClass("is-error");
  }

  /** platform 为 null 表示同步全部已启用平台。 */
  private async runSync(platform: Platform | null): Promise<void> {
    if (this.busy) return;
    this.setBusy(true, t("view.startingSync"));
    try {
      const reports = await this.plugin.runSync(platform, (p) => this.onProgress(p));
      this.showReports(reports);
    } finally {
      this.setBusy(false);
      this.renderCards();
    }
  }

  private showReports(reports: SyncReport[]): void {
    this.reportEl.empty();
    if (reports.length === 0) {
      this.statusEl.setText(t("notice.noPlatforms"));
      return;
    }
    this.reportEl.createDiv({ text: t("view.lastResult"), cls: "fav-sync-report-title" });
    let ok = true;
    for (const r of reports) {
      const row = this.reportEl.createDiv({ cls: "fav-sync-report-row" });
      const label = t(r.platform === "bilibili" ? "platform.bilibili" : "platform.x");
      if (r.errors.length > 0) {
        ok = false;
        row.addClass("is-error");
        row.setText(t("view.reportError", { label, error: r.errors[0] ?? "" }));
      } else {
        const requests = r.requests > 0 ? t("view.reportRequests", { n: r.requests }) : "";
        const skipped = r.skippedGroups > 0 ? t("view.reportSkipped", { n: r.skippedGroups }) : "";
        row.setText(
          t("view.reportRow", {
            label,
            fetched: r.fetched,
            created: r.created,
            updated: r.updated,
            requests,
            skipped,
          }),
        );
      }
    }
    this.statusEl.setText(ok ? t("view.syncDone") : t("view.syncDoneWithErrors"));
    this.statusEl.toggleClass("is-error", !ok);
  }
}
