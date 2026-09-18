import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type FavSyncPlugin from "../main";
import type { Platform, SyncProgress, SyncReport } from "../types";

export const VIEW_TYPE_FAV_SYNC = "fav-sync-view";

interface PlatformMeta {
  key: Platform;
  label: string;
  icon: string;
}

const PLATFORMS: PlatformMeta[] = [
  { key: "bilibili", label: "B 站", icon: "tv" },
  { key: "x", label: "X", icon: "message-circle" },
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
    return "Fav Sync";
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
    header.createEl("h3", { text: "收藏同步", cls: "fav-sync-title" });
    const settingsBtn = header.createEl("button", { cls: "fav-sync-icon-btn", attr: { "aria-label": "设置" } });
    setIcon(settingsBtn, "settings");
    settingsBtn.onclick = () => this.plugin.openSettings();

    // 主操作
    const syncAll = root.createEl("button", { text: "同步全部", cls: "fav-sync-primary" });
    syncAll.onclick = () => void this.runSync(null);

    // 状态区
    this.statusEl = root.createDiv({ cls: "fav-sync-status", text: "就绪" });
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
    const rebuild = footer.createEl("a", { text: "重建索引", cls: "fav-sync-link" });
    rebuild.onclick = async (e) => {
      e.preventDefault();
      if (this.busy) return;
      this.setBusy(true, "扫描笔记…");
      const n = await this.plugin.sync.rebuildIndex((p) => this.onProgress(p));
      this.setBusy(false, `索引已重建：${n} 条`);
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
      info.createDiv({ text: p.label, cls: "fav-sync-card-name" });
      const last = s.lastSyncAt[p.key];
      info.createDiv({
        text: enabled ? (last ? `上次 ${this.relTime(last)}` : "尚未同步") : "未启用",
        cls: "fav-sync-card-sub",
      });

      const btn = card.createEl("button", { text: "同步", cls: "fav-sync-card-btn" });
      btn.disabled = !enabled || this.busy;
      btn.onclick = () => void this.runSync(p.key);
    }
  }

  private relTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return "—";
    const min = Math.floor(diff / 60000);
    if (min < 1) return "刚刚";
    if (min < 60) return `${min} 分钟前`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h} 小时前`;
    return `${Math.floor(h / 24)} 天前`;
  }

  private setBusy(busy: boolean, status?: string): void {
    this.busy = busy;
    if (status) this.statusEl.setText(status);
    this.barWrapEl.toggle(busy);
    if (!busy) this.barEl.style.width = "0%";
    this.renderCards();
  }

  private onProgress(p: SyncProgress): void {
    this.statusEl.setText(p.message);
    if (p.total && p.total > 0 && p.current !== undefined) {
      this.barEl.style.width = `${Math.min(100, Math.round((p.current / p.total) * 100))}%`;
    }
    if (p.phase === "error") this.statusEl.addClass("is-error");
    else this.statusEl.removeClass("is-error");
  }

  /** platform 为 null 表示同步全部已启用平台。 */
  private async runSync(platform: Platform | null): Promise<void> {
    if (this.busy) return;
    this.setBusy(true, "开始同步…");
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
      this.statusEl.setText("没有启用的平台");
      return;
    }
    this.reportEl.createDiv({ text: "上次结果", cls: "fav-sync-report-title" });
    let ok = true;
    for (const r of reports) {
      const row = this.reportEl.createDiv({ cls: "fav-sync-report-row" });
      const label = r.platform === "bilibili" ? "B 站" : "X";
      if (r.errors.length > 0) {
        ok = false;
        row.addClass("is-error");
        row.setText(`${label}：${r.errors[0]}`);
      } else {
        const req = r.requests > 0 ? ` · ${r.requests} 次请求` : "";
        const skip = r.skippedGroups > 0 ? ` · 跳过 ${r.skippedGroups} 个收藏夹` : "";
        row.setText(`${label}：抓取 ${r.fetched} · 新增 ${r.created} · 更新 ${r.updated}${req}${skip}`);
      }
    }
    this.statusEl.setText(ok ? "同步完成" : "同步结束，有错误");
    this.statusEl.toggleClass("is-error", !ok);
  }
}
