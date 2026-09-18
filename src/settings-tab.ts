import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type FavSyncPlugin from "./main";
import type { OrganizeSettings } from "./settings";

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
    new Setting(containerEl).setName("通用").setHeading();

    new Setting(containerEl)
      .setName("根目录")
      .setDesc("所有收藏笔记写入这个目录下")
      .addText((t) =>
        t
          .setPlaceholder("收藏")
          .setValue(s.rootFolder)
          .onChange(async (v) => {
            s.rootFolder = v.trim() || "收藏";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("增量同步")
      .setDesc(
        "只拉上次同步之后新增的内容，请求数大幅减少。" +
          "关闭则每次重扫全部；也可用命令面板的「全量同步」临时做一次彻底重扫。",
      )
      .addToggle((t) =>
        t.setValue(s.incrementalSync).onChange(async (v) => {
          s.incrementalSync = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("更新已有笔记")
      .setDesc("重新同步时刷新笔记的机器区；你手写的内容始终保留")
      .addToggle((t) =>
        t.setValue(s.updateExisting).onChange(async (v) => {
          s.updateExisting = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("嵌入播放器")
      .setDesc("用 iframe 嵌入官方播放器，可在笔记里直接播放视频；开启时不再显示静态封面")
      .addToggle((t) =>
        t.setValue(s.embedPlayer).onChange(async (v) => {
          s.embedPlayer = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("嵌入封面图")
      .setDesc("没有播放器时的兜底，在笔记正文里显示封面")
      .addToggle((t) =>
        t.setValue(s.embedCover).onChange(async (v) => {
          s.embedCover = v;
          await this.plugin.saveSettings();
        }),
      );

    // ---------- B 站 ----------
    new Setting(containerEl).setName("B 站").setHeading();

    new Setting(containerEl).setName("启用").addToggle((t) =>
      t.setValue(s.bilibili.enabled).onChange(async (v) => {
        s.bilibili.enabled = v;
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName("扫码登录")
      .setDesc("用手机 B 站 App 扫码，自动获取 Cookie，不用再去浏览器里复制粘贴")
      .addButton((b) =>
        b
          .setButtonText("扫码登录")
          .setCta()
          .onClick(() => {
            // 登录成功后重绘设置页，让 Cookie 字段显示新值
            this.plugin.openBilibiliQrLogin(() => this.display());
          }),
      );

    new Setting(containerEl)
      .setName("Cookie")
      .setDesc("一般不用手动填——用上面的扫码登录即可。也可粘贴 Cookie-Editor 导出的 JSON 或 SESSDATA=xxx; 字符串。只保存在本地。")
      .addTextArea((t) => {
        t.setPlaceholder("[{\"name\":\"SESSDATA\",...}] 或 SESSDATA=...; DedeUserID=...")
          .setValue(s.bilibili.cookie)
          .onChange(async (v) => {
            s.bilibili.cookie = v.trim();
            await this.plugin.saveSettings();
          });
        t.inputEl.rows = 3;
        t.inputEl.addClass("fav-sync-textarea");
      });

    new Setting(containerEl)
      .setName("测试连接")
      .setDesc("验证 Cookie 是否有效并列出收藏夹")
      .addButton((b) =>
        b.setButtonText("测试").onClick(async () => {
          b.setDisabled(true).setButtonText("测试中…");
          try {
            const folders = await this.plugin.testBilibili();
            new Notice(`✅ 连接正常，共 ${folders.length} 个收藏夹：\n${folders.join("、")}`, 8000);
          } catch (err) {
            new Notice(`❌ ${err instanceof Error ? err.message : String(err)}`, 8000);
          } finally {
            b.setDisabled(false).setButtonText("测试");
          }
        }),
      );

    new Setting(containerEl)
      .setName("同步「稍后再看」")
      .addToggle((t) =>
        t.setValue(s.bilibili.includeWatchLater).onChange(async (v) => {
          s.bilibili.includeWatchLater = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("只同步这些收藏夹")
      .setDesc("收藏夹名，逗号分隔；留空表示全部")
      .addText((t) =>
        t
          .setPlaceholder("音乐, 相声")
          .setValue(s.bilibili.folderAllowlist.join(", "))
          .onChange(async (v) => {
            s.bilibili.folderAllowlist = toList(v);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("排除这些收藏夹")
      .setDesc("收藏夹名，逗号分隔")
      .addText((t) =>
        t
          .setPlaceholder("默认收藏夹")
          .setValue(s.bilibili.folderBlocklist.join(", "))
          .onChange(async (v) => {
            s.bilibili.folderBlocklist = toList(v);
            await this.plugin.saveSettings();
          }),
      );

    this.addOrganizeSettings(containerEl, s.bilibili, "B 站");

    new Setting(containerEl)
      .setName("请求间隔")
      .setDesc("毫秒。太快容易触发 B 站风控，建议不低于 500")
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
      .setName("每个收藏夹最多翻页")
      .setDesc(`每页 ${s.bilibili.pageSize} 条`)
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
    new Setting(containerEl).setName("X（Twitter）").setHeading();

    new Setting(containerEl).setName("启用").addToggle((t) =>
      t.setValue(s.x.enabled).onChange(async (v) => {
        s.x.enabled = v;
        await this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName("auth_token")
      .setDesc("x.com 的 Cookie，开发者工具 → Application → Cookies 里复制")
      .addText((t) => {
        t.setValue(s.x.authToken).onChange(async (v) => {
          s.x.authToken = v.trim();
          await this.plugin.saveSettings();
        });
        t.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("ct0")
      .setDesc("同上，另一个 Cookie，同时用作 CSRF token")
      .addText((t) => {
        t.setValue(s.x.csrfToken).onChange(async (v) => {
          s.x.csrfToken = v.trim();
          await this.plugin.saveSettings();
        });
        t.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("queryId")
      .setDesc(
        "X 内部接口标识，改版后可能失效。届时打开 x.com/i/bookmarks，" +
          "Network 面板找到 Bookmarks 请求，复制 URL 里 /graphql/ 后面那段。",
      )
      .addText((t) =>
        t.setValue(s.x.queryId).onChange(async (v) => {
          s.x.queryId = v.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("测试连接")
      .addButton((b) =>
        b.setButtonText("测试").onClick(async () => {
          b.setDisabled(true).setButtonText("测试中…");
          try {
            const n = await this.plugin.testX();
            new Notice(`✅ 连接正常，首页取到 ${n} 条书签`, 6000);
          } catch (err) {
            new Notice(`❌ ${err instanceof Error ? err.message : String(err)}`, 10000);
          } finally {
            b.setDisabled(false).setButtonText("测试");
          }
        }),
      );

    this.addOrganizeSettings(containerEl, s.x, "X");

    new Setting(containerEl)
      .setName("最多翻页")
      .setDesc(`每页 ${s.x.pageSize} 条`)
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
    new Setting(containerEl).setName("自动同步").setHeading();

    new Setting(containerEl)
      .setName("启用定时同步")
      .setDesc("Obsidian 打开期间按间隔自动拉取")
      .addToggle((t) =>
        t.setValue(s.autoSyncEnabled).onChange(async (v) => {
          s.autoSyncEnabled = v;
          await this.plugin.saveSettings();
          this.plugin.rescheduleAutoSync();
        }),
      );

    new Setting(containerEl)
      .setName("同步间隔")
      .setDesc("分钟")
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
    new Setting(containerEl).setName("维护").setHeading();

    new Setting(containerEl)
      .setName("重建索引")
      .setDesc(`扫描根目录下的笔记恢复同步记录。当前索引 ${this.plugin.index.size} 条`)
      .addButton((b) =>
        b.setButtonText("重建").onClick(async () => {
          b.setDisabled(true);
          const n = await this.plugin.sync.rebuildIndex();
          new Notice(`索引已重建：${n} 条`);
          b.setDisabled(false);
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("清空索引")
      .setDesc("清空后下次同步会把所有内容当作新条目重新写一遍（已存在的笔记会被更新而非重复创建）")
      .addButton((b) =>
        b
          .setButtonText("清空")
          .setWarning()
          .onClick(async () => {
            this.plugin.index.clear();
            await this.plugin.index.save();
            new Notice("索引已清空");
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
      .setName(`${label} · 目录模板`)
      .setDesc("可用变量：{platform} {folder} {author} {year} {month} {date} {published} {collected}")
      .addText((t) =>
        t
          .setPlaceholder("{platform}/{folder}")
          .setValue(org.dirTemplate)
          .onChange(async (v) => {
            org.dirTemplate = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(`${label} · 文件名模板`)
      .setDesc("另可用 {title} {id}。{date} = 收藏时间，{published} = 内容发布时间")
      .addText((t) =>
        t
          .setPlaceholder("{title}")
          .setValue(org.fileTemplate)
          .onChange(async (v) => {
            org.fileTemplate = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(`${label} · 标签模板`)
      .setDesc("逗号分隔，每条渲染成一个标签。例：收藏/{platform}, {platform}/{folder}")
      .addText((t) =>
        t
          .setValue(org.tagTemplates.join(", "))
          .onChange(async (v) => {
            org.tagTemplates = toList(v);
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName(`${label} · 多收藏夹处理`)
      .setDesc("一条内容同时在多个收藏夹里时怎么放")
      .addDropdown((d) =>
        d
          .addOption("primary", "只放第一个收藏夹（推荐）")
          .addOption("all", "每个收藏夹各存一份")
          .setValue(org.multiFolderMode)
          .onChange(async (v) => {
            org.multiFolderMode = v as OrganizeSettings["multiFolderMode"];
            await this.plugin.saveSettings();
          }),
      );
  }
}
