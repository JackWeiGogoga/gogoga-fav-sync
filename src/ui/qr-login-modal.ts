import { App, Modal, Notice } from "obsidian";
import qrcode from "qrcode-generator";
import { obsidianHttp } from "../core/http";
import { generateQr, pollQr, type QrSession } from "../sources/bilibili-login";
import { t } from "../i18n";

const POLL_INTERVAL_MS = 2000;
const QR_SIZE = 220;

/** 把二维码画到 canvas 上。背景固定为白色，深色主题下也能被扫出来。 */
function drawQr(canvas: HTMLCanvasElement, text: string, size = QR_SIZE): void {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const margin = 4;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000000";

  const cell = size / (count + margin * 2);
  for (let r = 0; r < count; r += 1) {
    for (let c = 0; c < count; c += 1) {
      if (!qr.isDark(r, c)) continue;
      // 多画半像素避免模块之间出现缝隙
      ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell + 0.5, cell + 0.5);
    }
  }
}

export class BilibiliQrLoginModal extends Modal {
  private timer: number | null = null;
  private session: QrSession | null = null;
  private canvas!: HTMLCanvasElement;
  private statusEl!: HTMLElement;
  private overlayEl!: HTMLElement;
  private closed = false;

  constructor(
    app: App,
    private readonly onSuccess: (cookie: string) => Promise<void>,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("fav-sync-qr-modal");

    contentEl.createEl("h3", { text: t("qr.title"), cls: "fav-sync-qr-title" });
    contentEl.createEl("p", {
      text: t("qr.hint"),
      cls: "fav-sync-qr-hint",
    });

    const box = contentEl.createDiv({ cls: "fav-sync-qr-box" });
    this.canvas = box.createEl("canvas", { cls: "fav-sync-qr-canvas" });
    this.overlayEl = box.createDiv({ cls: "fav-sync-qr-overlay" });
    this.overlayEl.hide();

    this.statusEl = contentEl.createDiv({ cls: "fav-sync-qr-status", text: t("qr.loading") });

    const refresh = contentEl.createEl("button", { text: t("qr.refresh"), cls: "fav-sync-qr-refresh" });
    refresh.onclick = () => void this.start();

    void this.start();
  }

  onClose(): void {
    this.closed = true;
    this.stopPolling();
    this.contentEl.empty();
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private setStatus(text: string, kind: "normal" | "ok" | "error" = "normal"): void {
    this.statusEl.setText(text);
    this.statusEl.toggleClass("is-ok", kind === "ok");
    this.statusEl.toggleClass("is-error", kind === "error");
  }

  private showOverlay(text: string): void {
    this.overlayEl.setText(text);
    this.overlayEl.show();
  }

  /** 申请新二维码并开始轮询。 */
  private async start(): Promise<void> {
    this.stopPolling();
    this.overlayEl.hide();
    this.setStatus(t("qr.loading"));
    try {
      this.session = await generateQr(obsidianHttp);
      if (this.closed) return;
      drawQr(this.canvas, this.session.url);
      this.setStatus(t("qr.scanPrompt"));
      this.timer = window.setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    } catch (err) {
      this.setStatus(err instanceof Error ? err.message : String(err), "error");
    }
  }

  private async tick(): Promise<void> {
    if (!this.session || this.closed) return;
    try {
      const status = await pollQr(obsidianHttp, this.session.key);
      if (this.closed) return;
      switch (status.state) {
        case "pending":
          this.setStatus(t("qr.scanPrompt"));
          break;
        case "scanned":
          this.setStatus(t("qr.scanned"));
          break;
        case "expired":
          this.stopPolling();
          this.showOverlay(t("qr.expiredOverlay"));
          this.setStatus(t("qr.expired"), "error");
          break;
        case "ok": {
          this.stopPolling();
          this.setStatus(t("qr.saving"), "ok");
          await this.onSuccess(status.cookie);
          new Notice(t("notice.bilibiliLoginOk"));
          this.close();
          break;
        }
      }
    } catch (err) {
      this.stopPolling();
      this.setStatus(err instanceof Error ? err.message : String(err), "error");
    }
  }
}
