import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type FavSyncPlugin from "./main";
import type { OrganizeSettings } from "./settings";
import { t } from "./i18n";

/**
 * 根目录留空时的回退值。它会成为真实的文件夹名，属于数据，不随界面语言变化；
 * 占位符也显示它，让用户知道留空会落到哪里。
 */
const ROOT_FOLDER_FALLBACK = "收藏";

/** 排除列表的占位示例：B 站自带的默认收藏夹就叫这个名字，与界面语言无关。 */
const BLOCKLIST_EXAMPLE = "默认收藏夹";

/** 逗号/换行分隔的输入 → 字符串数组。 */
function toList(raw: string): string[] {
  return raw
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export class FavSyncSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: FavSyncPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;

    // ---------- 通用 ----------
    new Setting(containerEl).setName(t("settings.general")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.rootFolder.name"))
      .setDesc(t("settings.rootFolder.desc"))
      .addText((c) =>
        c
          .setPlaceholder(ROOT_FOLDER_FALLBACK)
          .setValue(s.rootFolder)
          .onChange(async (v) => {
            s.rootFolder = v.trim() || ROOT_FOLDER_FALLBACK;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.incremental.name"))
      .setDesc(t("settings.incremental.desc"))
      .addToggle((c) =>
        c.setValue(s.incrementalSync).onChange(async (v) => {
          s.incrementalSync = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.updateExisting.name"))
      .setDesc(t("settings.updateExisting.desc"))
      .addToggle((c) =>
        c.setValue(s.updateExisting).onChange(async (v) => {
          s.updateExisting = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.embedPlayer.name"))
      .setDesc(t("settings.embedPlayer.desc"))
      .addToggle((c) =>
        c.setValue(s.embedPlayer).onChange(async (v) => {
          s.embedPlayer = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.embedCover.name"))
      .setDesc(t("settings.embedCover.desc"))
      .addToggle((c) =>
        c.setValue(s.embedCover).onChange(async (v) => {
          s.embedCover = v;
          await this.plugin.saveSettings();
        }),
      );

    // ---------- B 站 ----------
    new Setting(containerEl).setName(t("platform.bilibili")).setHeading();

    new Setting(containerEl).setName(t("settings.enabled")).addToggle((c) =>
      c.setValue(s.bilibili.enabled).onChange(async (v) => {
        s.bilibili.enabled = v;
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName(t("settings.qrLogin.name"))
      .setDesc(t("settings.qrLogin.desc"))
      .addButton((b) =>
        b
          .setButtonText(t("settings.qrLogin.button"))
          .setCta()
          .onClick(() => {
            // 登录成功后重绘设置页，让 Cookie 字段显示新值
            this.plugin.openBilibiliQrLogin(() => this.display());
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.cookie.name"))
      .setDesc(t("settings.cookie.desc"))
      .addTextArea((c) => {
        c.setPlaceholder(t("settings.cookie.placeholder"))
          .setValue(s.bilibili.cookie)
          .onChange(async (v) => {
            s.bilibili.cookie = v.trim();
            await this.plugin.saveSettings();
          });
        c.inputEl.rows = 3;
        c.inputEl.addClass("fav-sync-textarea");
      });

    new Setting(containerEl)
      .setName(t("settings.testConnection.name"))
      .setDesc(t("settings.testConnection.desc"))
      .addButton((b) =>
        b.setButtonText(t("settings.test")).onClick(async () => {
          b.setDisabled(true).setButtonText(t("settings.testing"));
          try {
            const folders = await this.plugin.testBilibili();
            new Notice(
              t("notice.testBilibiliOk", { count: folders.length, folders: folders.join(t("list.sep")) }),
              8000,
            );
          } catch (err) {
            new Notice(t("notice.testFailed", { error: err instanceof Error ? err.message : String(err) }), 8000);
          } finally {
            b.setDisabled(false).setButtonText(t("settings.test"));
          }
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.watchLater.name"))
      .addToggle((c) =>
        c.setValue(s.bilibili.includeWatchLater).onChange(async (v) => {
          s.bilibili.includeWatchLater = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.allowlist.name"))
      .setDesc(t("settings.allowlist.desc"))
      .addText((c) =>
        c
          .setPlaceholder(t("settings.allowlist.placeholder"))
          .setValue(s.bilibili.folderAllowlist.join(", "))
          .onChange(async (v) => {
            s.bilibili.folderAllowlist = toList(v);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.blocklist.name"))
      .setDesc(t("settings.blocklist.desc"))
      .addText((c) =>
        c
          .setPlaceholder(BLOCKLIST_EXAMPLE)
          .setValue(s.bilibili.folderBlocklist.join(", "))
          .onChange(async (v) => {
            s.bilibili.folderBlocklist = toList(v);
            await this.plugin.saveSettings();
          }),
      );

    this.addOrganizeSettings(containerEl, s.bilibili, t("platform.bilibili"));

    new Setting(containerEl)
      .setName(t("settings.requestDelay.name"))
      .setDesc(t("settings.requestDelay.desc"))
      .addSlider((sl) =>
        sl
          .setLimits(300, 3000, 100)
          .setValue(s.bilibili.requestDelayMs)
          .setDynamicTooltip()
          .onChange(async (v) => {
            s.bilibili.requestDelayMs = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.maxPagesPerFolder.name"))
      .setDesc(t("settings.perPage", { n: s.bilibili.pageSize }))
      .addSlider((sl) =>
        sl
          .setLimits(1, 100, 1)
          .setValue(s.bilibili.maxPagesPerFolder)
          .setDynamicTooltip()
          .onChange(async (v) => {
            s.bilibili.maxPagesPerFolder = v;
            await this.plugin.saveSettings();
          }),
      );

    // ---------- X ----------
    new Setting(containerEl).setName(t("settings.xHeading")).setHeading();

    new Setting(containerEl).setName(t("settings.enabled")).addToggle((c) =>
      c.setValue(s.x.enabled).onChange(async (v) => {
        s.x.enabled = v;
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName("auth_token")
      .setDesc(t("settings.authToken.desc"))
      .addText((c) => {
        c.setValue(s.x.authToken).onChange(async (v) => {
          s.x.authToken = v.trim();
          await this.plugin.saveSettings();
        });
        c.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("ct0")
      .setDesc(t("settings.ct0.desc"))
      .addText((c) => {
        c.setValue(s.x.csrfToken).onChange(async (v) => {
          s.x.csrfToken = v.trim();
          await this.plugin.saveSettings();
        });
        c.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("queryId")
      .setDesc(t("settings.queryId.desc"))
      .addText((c) =>
        c.setValue(s.x.queryId).onChange(async (v) => {
          s.x.queryId = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.testConnection.name"))
      .addButton((b) =>
        b.setButtonText(t("settings.test")).onClick(async () => {
          b.setDisabled(true).setButtonText(t("settings.testing"));
          try {
            const n = await this.plugin.testX();
            new Notice(t("notice.testXOk", { n }), 6000);
          } catch (err) {
            new Notice(t("notice.testFailed", { error: err instanceof Error ? err.message : String(err) }), 10000);
          } finally {
            b.setDisabled(false).setButtonText(t("settings.test"));
          }
        }),
      );

    this.addOrganizeSettings(containerEl, s.x, t("platform.x"));

    new Setting(containerEl)
      .setName(t("settings.maxPages.name"))
      .setDesc(t("settings.perPage", { n: s.x.pageSize }))
      .addSlider((sl) =>
        sl
          .setLimits(1, 50, 1)
          .setValue(s.x.maxPages)
          .setDynamicTooltip()
          .onChange(async (v) => {
            s.x.maxPages = v;
            await this.plugin.saveSettings();
          }),
      );

    // ---------- 自动同步 ----------
    new Setting(containerEl).setName(t("settings.autoSync")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.autoSyncEnabled.name"))
      .setDesc(t("settings.autoSyncEnabled.desc"))
      .addToggle((c) =>
        c.setValue(s.autoSyncEnabled).onChange(async (v) => {
          s.autoSyncEnabled = v;
          await this.plugin.saveSettings();
          this.plugin.rescheduleAutoSync();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.interval.name"))
      .setDesc(t("settings.interval.desc"))
      .addSlider((sl) =>
        sl
          .setLimits(30, 720, 30)
          .setValue(s.autoSyncIntervalMinutes)
          .setDynamicTooltip()
          .onChange(async (v) => {
            s.autoSyncIntervalMinutes = v;
            await this.plugin.saveSettings();
            this.plugin.rescheduleAutoSync();
          }),
      );

    // ---------- 维护 ----------
    new Setting(containerEl).setName(t("settings.maintenance")).setHeading();

    new Setting(containerEl)
      .setName(t("settings.rebuildIndex.name"))
      .setDesc(t("settings.rebuildIndex.desc", { n: this.plugin.index.size }))
      .addButton((b) =>
        b.setButtonText(t("settings.rebuildIndex.button")).onClick(async () => {
          b.setDisabled(true);
          const n = await this.plugin.sync.rebuildIndex();
          new Notice(t("notice.indexRebuilt", { n }));
          b.setDisabled(false);
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName(t("settings.clearIndex.name"))
      .setDesc(t("settings.clearIndex.desc"))
      .addButton((b) =>
        b
          .setButtonText(t("settings.clearIndex.button"))
          .setWarning()
          .onClick(async () => {
            this.plugin.index.clear();
            await this.plugin.index.save();
            new Notice(t("notice.indexCleared"));
            this.display();
          }),
      );
  }

  /** 目录/文件名/标签这组模板设置，两个平台共用。 */
  private addOrganizeSettings(
    containerEl: HTMLElement,
    org: OrganizeSettings,
    label: string,
  ): void {
    new Setting(containerEl)
      .setName(t("settings.dirTemplate.name", { label }))
      .setDesc(t("settings.dirTemplate.desc"))
      .addText((c) =>
        c
          .setPlaceholder("{platform}/{folder}")
          .setValue(org.dirTemplate)
          .onChange(async (v) => {
            org.dirTemplate = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.fileTemplate.name", { label }))
      .setDesc(t("settings.fileTemplate.desc"))
      .addText((c) =>
        c
          .setPlaceholder("{title}")
          .setValue(org.fileTemplate)
          .onChange(async (v) => {
            org.fileTemplate = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.tagTemplates.name", { label }))
      .setDesc(t("settings.tagTemplates.desc"))
      .addText((c) =>
        c
          .setValue(org.tagTemplates.join(", "))
          .onChange(async (v) => {
            org.tagTemplates = toList(v);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(t("settings.multiFolder.name", { label }))
      .setDesc(t("settings.multiFolder.desc"))
      .addDropdown((d) =>
        d
          .addOption("primary", t("settings.multiFolder.primary"))
          .addOption("all", t("settings.multiFolder.all"))
          .setValue(org.multiFolderMode)
          .onChange(async (v) => {
            org.multiFolderMode = v as OrganizeSettings["multiFolderMode"];
            await this.plugin.saveSettings();
          }),
      );
  }
}
