/**
 * 界面文案的中英文字典。
 *
 * 只覆盖 UI：命令、面板、设置、提示、错误信息。
 * 写进笔记的内容（机器区标签、frontmatter、标签、目录/文件名）属于数据，不走这里，
 * 否则切换语言会让已有笔记的结构变化。
 *
 * en 是基准：zh 必须覆盖 en 的全部 key，缺一个就过不了类型检查。
 */

const en = {
  // 通用
  "platform.bilibili": "Bilibili",
  "platform.x": "X",
  "list.sep": ", ",

  // 命令 / ribbon
  "ribbon.open": "Open Fav Sync",
  "cmd.openSidebar": "Open sync panel",
  "cmd.syncAll": "Sync all platforms",
  "cmd.syncBilibili": "Sync Bilibili favorites",
  "cmd.syncX": "Sync X bookmarks",
  "cmd.syncAllFull": "Full sync (ignore incremental state and rescan everything)",
  "cmd.bilibiliQrLogin": "Log in to Bilibili with QR code",
  "cmd.rebuildIndex": "Rebuild sync index",

  // 同步提示
  "notice.indexRebuilt": "Index rebuilt: {n} entries",
  "notice.indexCleared": "Index cleared",
  "notice.syncInProgress": "A sync is already in progress",
  "notice.fullSyncing": "Running full sync…",
  "notice.syncing": "Syncing…",
  "notice.syncingProgress": "Syncing: {message}",
  "notice.noPlatforms": "No platforms are enabled",
  "notice.platformFailed": "{label} failed: {error}",
  "notice.platformDone": "{label}: {created} new / {updated} updated",
  "notice.syncFailed": "Sync failed: {error}",
  "notice.bilibiliLoginOk": "Logged in to Bilibili. Cookie filled in automatically",
  "notice.testBilibiliOk": "✅ Connected. {count} favorites folders:\n{folders}",
  "notice.testXOk": "✅ Connected. First page returned {n} bookmarks",
  "notice.testFailed": "❌ {error}",

  // 侧边栏
  "view.title": "Fav Sync",
  "view.settings": "Settings",
  "view.syncAll": "Sync all",
  "view.ready": "Ready",
  "view.rebuildIndex": "Rebuild index",
  "view.scanningNotes": "Scanning notes…",
  "view.lastSync": "Last synced {time}",
  "view.neverSynced": "Not synced yet",
  "view.disabled": "Disabled",
  "view.sync": "Sync",
  "view.justNow": "just now",
  "view.minutesAgo": "{n} min ago",
  "view.hoursAgo": "{n} h ago",
  "view.daysAgo": "{n} d ago",
  "view.startingSync": "Starting sync…",
  "view.lastResult": "Last result",
  "view.reportError": "{label}: {error}",
  "view.reportRow": "{label}: fetched {fetched} · new {created} · updated {updated}{requests}{skipped}",
  "view.reportRequests": " · {n} requests",
  "view.reportSkipped": " · {n} folders skipped",
  "view.syncDone": "Sync complete",
  "view.syncDoneWithErrors": "Sync finished with errors",

  // 扫码登录弹窗
  "qr.title": "Log in to Bilibili with QR code",
  "qr.hint": "Scan the QR code below with the Bilibili mobile app. Your login will be filled into settings automatically.",
  "qr.loading": "Getting QR code…",
  "qr.refresh": "Refresh QR code",
  "qr.scanPrompt": "Scan with the Bilibili app",
  "qr.scanned": "Scanned. Confirm the login on your phone",
  "qr.expiredOverlay": "Expired",
  "qr.expired": "QR code expired. Click the button below to refresh",
  "qr.saving": "Logged in. Saving…",

  // 设置：通用
  "settings.general": "General",
  "settings.rootFolder.name": "Root folder",
  "settings.rootFolder.desc": "All favorite notes are written under this folder",
  "settings.incremental.name": "Incremental sync",
  "settings.incremental.desc":
    "Only fetch items added since the last sync, which greatly reduces requests. " +
    "Turn off to rescan everything every time. You can also run the full sync command once from the command palette.",
  "settings.updateExisting.name": "Update existing notes",
  "settings.updateExisting.desc":
    "Refresh the plugin-managed part of notes when syncing again. Your own writing is always kept",
  "settings.embedPlayer.name": "Embed player",
  "settings.embedPlayer.desc":
    "Embed the official player in an iframe so videos play right in the note. When on, the static cover is not shown",
  "settings.embedCover.name": "Embed cover image",
  "settings.embedCover.desc": "Fallback when there is no player: show the cover in the note body",

  // 设置：B 站
  "settings.enabled": "Enabled",
  "settings.qrLogin.name": "QR code login",
  "settings.qrLogin.desc":
    "Scan with the Bilibili mobile app to get the Cookie automatically, no copying from the browser needed",
  "settings.qrLogin.button": "Log in with QR code",
  "settings.cookie.name": "Cookie",
  "settings.cookie.desc":
    "Usually you don't need to fill this in. Use QR code login above. " +
    "You can also paste the JSON exported by Cookie-Editor or a SESSDATA=xxx; string. Stored locally only.",
  "settings.cookie.placeholder": "[{\"name\":\"SESSDATA\",...}] or SESSDATA=...; DedeUserID=...",
  "settings.testConnection.name": "Test connection",
  "settings.testConnection.desc": "Check that the Cookie works and list your favorites folders",
  "settings.test": "Test",
  "settings.testing": "Testing…",
  "settings.watchLater.name": "Sync Watch Later",
  "settings.allowlist.name": "Only sync these folders",
  "settings.allowlist.desc": "Favorites folder names, comma-separated. Leave empty for all",
  "settings.allowlist.placeholder": "Music, Comedy",
  "settings.blocklist.name": "Exclude these folders",
  "settings.blocklist.desc": "Favorites folder names, comma-separated",
  "settings.requestDelay.name": "Request interval",
  "settings.requestDelay.desc":
    "In milliseconds. Going too fast can trigger Bilibili's rate limiting. 500 or more is recommended",
  "settings.maxPagesPerFolder.name": "Max pages per folder",
  "settings.perPage": "{n} items per page",

  // 设置：X
  "settings.xHeading": "X (Twitter)",
  "settings.authToken.desc": "A Cookie from x.com. Copy it from Developer Tools → Application → Cookies",
  "settings.ct0.desc": "Another Cookie from the same place. Also used as the CSRF token",
  "settings.queryId.desc":
    "Identifier of X's internal API. It may stop working after X changes its site. " +
    "If so, open x.com/i/bookmarks, find the Bookmarks request in the Network panel, and copy the part of the URL after /graphql/.",
  "settings.maxPages.name": "Max pages",

  // 设置：自动同步 / 维护
  "settings.autoSync": "Auto sync",
  "settings.autoSyncEnabled.name": "Sync on a schedule",
  "settings.autoSyncEnabled.desc": "Fetch automatically at an interval while Obsidian is open",
  "settings.interval.name": "Sync interval",
  "settings.interval.desc": "In minutes",
  "settings.maintenance": "Maintenance",
  "settings.rebuildIndex.name": "Rebuild index",
  "settings.rebuildIndex.desc":
    "Scan notes under the root folder to restore sync records. Current index: {n} entries",
  "settings.rebuildIndex.button": "Rebuild",
  "settings.clearIndex.name": "Clear index",
  "settings.clearIndex.desc":
    "After clearing, the next sync treats everything as new and writes it again (existing notes are updated, not duplicated)",
  "settings.clearIndex.button": "Clear",

  // 设置：组织模板
  "settings.dirTemplate.name": "{label} · Folder template",
  "settings.dirTemplate.desc":
    "Available variables: {platform} {folder} {author} {year} {month} {date} {published} {collected}",
  "settings.fileTemplate.name": "{label} · File name template",
  "settings.fileTemplate.desc":
    "{title} and {id} are also available. {date} = when you saved it, {published} = when the content was published",
  "settings.tagTemplates.name": "{label} · Tag templates",
  "settings.tagTemplates.desc":
    "Comma-separated, each renders to one tag. Example: favorites/{platform}, {platform}/{folder}",
  "settings.multiFolder.name": "{label} · Multiple folders",
  "settings.multiFolder.desc": "Where to put an item that is in several favorites folders",
  "settings.multiFolder.primary": "First folder only (recommended)",
  "settings.multiFolder.all": "One copy per folder",

  // 同步进度
  "progress.fetchFailed": "Fetching failed",
  "progress.done": "{created} new / {updated} updated / {skipped} skipped",
  "progress.writing": "Writing notes",
  "progress.scanning": "Scanning notes",
  "progress.folder": "Folder \"{name}\"",
  "progress.watchLater": "Watch Later",
  "progress.xPage": "Page {page}, {total} items so far",

  // 错误信息
  "error.noCookie": "Fill in the Cookie first",
  "error.noBilibiliCookie": "Bilibili Cookie is not set",
  "error.itemFailed": "{title}: {error}",
  "error.http.invalidJson": "Response is not valid JSON (HTTP {status}): {body}",
  "error.bili.htmlResponse":
    "{what}: Bilibili returned a web page instead of data, usually because requests were too frequent and triggered rate limiting. " +
    "Wait a few minutes before syncing again, and increase the request interval.",
  "error.bili.unparsable": "{what}: could not parse the response (HTTP {status})",
  "error.bili.loginCheck": "Login check",
  "error.bili.noWbiKey": "Could not get the WBI key. The API may have changed",
  "error.bili.notLoggedIn": "Cookie is not logged in or has expired. Import it again",
  "error.bili.folderList": "Fetching favorites folders",
  "error.bili.folderListFailed": "Failed to fetch favorites folders: {code} {message}",
  "error.bili.noDedeUserId": "The Cookie is missing DedeUserID. Make sure it was exported after logging in",
  "error.bili.riskControl":
    "Bilibili rate limiting triggered (code {code}). Try again later and increase the request interval",
  "error.login.htmlResponse":
    "{what}: Bilibili returned a web page instead of data, possibly due to rate limiting. Try again later",
  "error.login.generate": "Generating QR code",
  "error.login.generateFailed": "Failed to generate QR code: {code} {message}",
  "error.login.poll": "Checking scan status",
  "error.login.pollFailed": "Failed to check scan status: {code} {message}",
  "error.login.noSessdata":
    "Logged in but did not get SESSDATA: no usable Set-Cookie in the response headers (headers received: {headers}). " +
    "Paste the Cookie manually instead.",
  "error.login.none": "none",
  "error.x.noTokens": "Fill in auth_token and ct0 first",
  "error.x.queryIdExpired":
    "queryId has expired (404). Open x.com/i/bookmarks in your browser, find the Bookmarks request in the Network tab of Developer Tools, " +
    "and paste the part of the URL after /graphql/ into settings.",
  "error.x.unauthorized": "Login is invalid (HTTP {status}). Copy auth_token and ct0 again",
  "error.x.rateLimited": "X rate limit reached (429). Try again later",
  "error.x.http": "X API returned HTTP {status}",
  "error.x.api": "X API error: {message}",
  "error.x.unknown": "unknown error",
} as const;

type Key = keyof typeof en;

const zh: Record<Key, string> = {
  "platform.bilibili": "B 站",
  "platform.x": "X",
  "list.sep": "、",

  "ribbon.open": "收藏同步",
  "cmd.openSidebar": "打开收藏同步面板",
  "cmd.syncAll": "同步全部平台",
  "cmd.syncBilibili": "同步 B 站收藏",
  "cmd.syncX": "同步 X 书签",
  "cmd.syncAllFull": "全量同步（忽略增量记录，重扫全部）",
  "cmd.bilibiliQrLogin": "B 站扫码登录",
  "cmd.rebuildIndex": "重建同步索引",

  "notice.indexRebuilt": "索引已重建：{n} 条",
  "notice.indexCleared": "索引已清空",
  "notice.syncInProgress": "同步正在进行中",
  "notice.fullSyncing": "全量同步中…",
  "notice.syncing": "同步中…",
  "notice.syncingProgress": "同步中：{message}",
  "notice.noPlatforms": "没有启用的平台",
  "notice.platformFailed": "{label} 失败：{error}",
  "notice.platformDone": "{label} 新增 {created} / 更新 {updated}",
  "notice.syncFailed": "同步失败：{error}",
  "notice.bilibiliLoginOk": "B 站登录成功，Cookie 已自动填入",
  "notice.testBilibiliOk": "✅ 连接正常，共 {count} 个收藏夹：\n{folders}",
  "notice.testXOk": "✅ 连接正常，首页取到 {n} 条书签",
  "notice.testFailed": "❌ {error}",

  "view.title": "收藏同步",
  "view.settings": "设置",
  "view.syncAll": "同步全部",
  "view.ready": "就绪",
  "view.rebuildIndex": "重建索引",
  "view.scanningNotes": "扫描笔记…",
  "view.lastSync": "上次 {time}",
  "view.neverSynced": "尚未同步",
  "view.disabled": "未启用",
  "view.sync": "同步",
  "view.justNow": "刚刚",
  "view.minutesAgo": "{n} 分钟前",
  "view.hoursAgo": "{n} 小时前",
  "view.daysAgo": "{n} 天前",
  "view.startingSync": "开始同步…",
  "view.lastResult": "上次结果",
  "view.reportError": "{label}：{error}",
  "view.reportRow": "{label}：抓取 {fetched} · 新增 {created} · 更新 {updated}{requests}{skipped}",
  "view.reportRequests": " · {n} 次请求",
  "view.reportSkipped": " · 跳过 {n} 个收藏夹",
  "view.syncDone": "同步完成",
  "view.syncDoneWithErrors": "同步结束，有错误",

  "qr.title": "扫码登录 B 站",
  "qr.hint": "用手机 B 站 App 扫描下方二维码，登录信息会自动填入设置。",
  "qr.loading": "正在获取二维码…",
  "qr.refresh": "刷新二维码",
  "qr.scanPrompt": "请用 B 站 App 扫码",
  "qr.scanned": "已扫描，请在手机上确认登录",
  "qr.expiredOverlay": "已失效",
  "qr.expired": "二维码已失效，点下方按钮刷新",
  "qr.saving": "登录成功，正在保存…",

  "settings.general": "通用",
  "settings.rootFolder.name": "根目录",
  "settings.rootFolder.desc": "所有收藏笔记写入这个目录下",
  "settings.incremental.name": "增量同步",
  "settings.incremental.desc":
    "只拉上次同步之后新增的内容，请求数大幅减少。" +
    "关闭则每次重扫全部；也可用命令面板的「全量同步」临时做一次彻底重扫。",
  "settings.updateExisting.name": "更新已有笔记",
  "settings.updateExisting.desc": "重新同步时刷新笔记的机器区；你手写的内容始终保留",
  "settings.embedPlayer.name": "嵌入播放器",
  "settings.embedPlayer.desc": "用 iframe 嵌入官方播放器，可在笔记里直接播放视频；开启时不再显示静态封面",
  "settings.embedCover.name": "嵌入封面图",
  "settings.embedCover.desc": "没有播放器时的兜底，在笔记正文里显示封面",

  "settings.enabled": "启用",
  "settings.qrLogin.name": "扫码登录",
  "settings.qrLogin.desc": "用手机 B 站 App 扫码，自动获取 Cookie，不用再去浏览器里复制粘贴",
  "settings.qrLogin.button": "扫码登录",
  "settings.cookie.name": "Cookie",
  "settings.cookie.desc":
    "一般不用手动填——用上面的扫码登录即可。也可粘贴 Cookie-Editor 导出的 JSON 或 SESSDATA=xxx; 字符串。只保存在本地。",
  "settings.cookie.placeholder": "[{\"name\":\"SESSDATA\",...}] 或 SESSDATA=...; DedeUserID=...",
  "settings.testConnection.name": "测试连接",
  "settings.testConnection.desc": "验证 Cookie 是否有效并列出收藏夹",
  "settings.test": "测试",
  "settings.testing": "测试中…",
  "settings.watchLater.name": "同步「稍后再看」",
  "settings.allowlist.name": "只同步这些收藏夹",
  "settings.allowlist.desc": "收藏夹名，逗号分隔；留空表示全部",
  "settings.allowlist.placeholder": "音乐, 相声",
  "settings.blocklist.name": "排除这些收藏夹",
  "settings.blocklist.desc": "收藏夹名，逗号分隔",
  "settings.requestDelay.name": "请求间隔",
  "settings.requestDelay.desc": "毫秒。太快容易触发 B 站风控，建议不低于 500",
  "settings.maxPagesPerFolder.name": "每个收藏夹最多翻页",
  "settings.perPage": "每页 {n} 条",

  "settings.xHeading": "X（Twitter）",
  "settings.authToken.desc": "x.com 的 Cookie，开发者工具 → Application → Cookies 里复制",
  "settings.ct0.desc": "同上，另一个 Cookie，同时用作 CSRF token",
  "settings.queryId.desc":
    "X 内部接口标识，改版后可能失效。届时打开 x.com/i/bookmarks，" +
    "Network 面板找到 Bookmarks 请求，复制 URL 里 /graphql/ 后面那段。",
  "settings.maxPages.name": "最多翻页",

  "settings.autoSync": "自动同步",
  "settings.autoSyncEnabled.name": "启用定时同步",
  "settings.autoSyncEnabled.desc": "Obsidian 打开期间按间隔自动拉取",
  "settings.interval.name": "同步间隔",
  "settings.interval.desc": "分钟",
  "settings.maintenance": "维护",
  "settings.rebuildIndex.name": "重建索引",
  "settings.rebuildIndex.desc": "扫描根目录下的笔记恢复同步记录。当前索引 {n} 条",
  "settings.rebuildIndex.button": "重建",
  "settings.clearIndex.name": "清空索引",
  "settings.clearIndex.desc": "清空后下次同步会把所有内容当作新条目重新写一遍（已存在的笔记会被更新而非重复创建）",
  "settings.clearIndex.button": "清空",

  "settings.dirTemplate.name": "{label} · 目录模板",
  "settings.dirTemplate.desc": "可用变量：{platform} {folder} {author} {year} {month} {date} {published} {collected}",
  "settings.fileTemplate.name": "{label} · 文件名模板",
  "settings.fileTemplate.desc": "另可用 {title} {id}。{date} = 收藏时间，{published} = 内容发布时间",
  "settings.tagTemplates.name": "{label} · 标签模板",
  "settings.tagTemplates.desc": "逗号分隔，每条渲染成一个标签。例：收藏/{platform}, {platform}/{folder}",
  "settings.multiFolder.name": "{label} · 多收藏夹处理",
  "settings.multiFolder.desc": "一条内容同时在多个收藏夹里时怎么放",
  "settings.multiFolder.primary": "只放第一个收藏夹（推荐）",
  "settings.multiFolder.all": "每个收藏夹各存一份",

  "progress.fetchFailed": "采集失败",
  "progress.done": "新增 {created} / 更新 {updated} / 跳过 {skipped}",
  "progress.writing": "写入笔记",
  "progress.scanning": "扫描笔记",
  "progress.folder": "收藏夹「{name}」",
  "progress.watchLater": "稍后再看",
  "progress.xPage": "第 {page} 页，累计 {total} 条",

  "error.noCookie": "请先填写 Cookie",
  "error.noBilibiliCookie": "尚未填写 B 站 Cookie",
  "error.itemFailed": "{title}：{error}",
  "error.http.invalidJson": "响应不是合法 JSON（HTTP {status}）：{body}",
  "error.bili.htmlResponse":
    "{what}：B 站返回了网页而非数据，通常是请求过于频繁触发了风控。" +
    "请等几分钟再同步，并把「请求间隔」调大一些。",
  "error.bili.unparsable": "{what}：响应无法解析（HTTP {status}）",
  "error.bili.loginCheck": "登录态校验",
  "error.bili.noWbiKey": "拿不到 WBI 密钥，接口可能已变更",
  "error.bili.notLoggedIn": "Cookie 未登录或已失效，请重新导入",
  "error.bili.folderList": "获取收藏夹列表",
  "error.bili.folderListFailed": "收藏夹列表获取失败：{code} {message}",
  "error.bili.noDedeUserId": "Cookie 里缺少 DedeUserID，请确认是登录后导出的",
  "error.bili.riskControl": "触发 B 站风控（code {code}），请稍后再试并调大请求间隔",
  "error.login.htmlResponse": "{what}：B 站返回了网页而非数据，可能触发了风控，请稍后再试",
  "error.login.generate": "生成二维码",
  "error.login.generateFailed": "生成二维码失败：{code} {message}",
  "error.login.poll": "查询扫码状态",
  "error.login.pollFailed": "查询扫码状态失败：{code} {message}",
  "error.login.noSessdata":
    "登录成功但没取到 SESSDATA：响应头里没有可用的 Set-Cookie（收到的头：{headers}）。" +
    "请改用手动粘贴 Cookie。",
  "error.login.none": "无",
  "error.x.noTokens": "请先填写 auth_token 与 ct0",
  "error.x.queryIdExpired":
    "queryId 已失效（404）。请在浏览器打开 x.com/i/bookmarks，" +
    "开发者工具 Network 里找到 Bookmarks 请求，把 URL 中 /graphql/ 后面那段填到设置里。",
  "error.x.unauthorized": "登录态无效（HTTP {status}），请重新复制 auth_token 与 ct0",
  "error.x.rateLimited": "触发 X 速率限制（429），请稍后再试",
  "error.x.http": "X 接口返回 HTTP {status}",
  "error.x.api": "X 接口报错：{message}",
  "error.x.unknown": "未知错误",
};

export type Locale = "en" | "zh";

const dictionaries: Record<Locale, Record<Key, string>> = { en, zh };

let current: Locale = "en";

/** 按 Obsidian 的界面语言切换：zh 开头（zh、zh-TW 等）用中文，其余一律英文。 */
export function setLocale(lang: string | null | undefined): void {
  current = (lang ?? "").toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function getLocale(): Locale {
  return current;
}

/**
 * 取文案并替换 `{name}` 占位符。
 * 没传对应变量的占位符原样保留——模板说明里的 {platform} 等变量名正是靠这一点显示出来。
 */
export function t(key: Key, vars?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = vars[name];
    return v === undefined ? whole : String(v);
  });
}

export type I18nKey = Key;
export { en, zh };
