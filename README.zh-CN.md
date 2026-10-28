# gogoga Fav Sync

[English](https://github.com/JackWeiGogoga/gogoga-fav-sync/blob/main/README.md) | **简体中文**

把 **B 站收藏夹**与 **X（Twitter）书签**同步成 Obsidian 笔记。

界面语言跟随 Obsidian 的语言设置，支持简体中文和英文。

## 为什么重写

替代 [omni-collector](https://github.com/simonemuller6127-png/omni-collector)。那个项目为了通吃五个平台，
用了「Obsidian 插件 + 独立 Node 引擎 + IPC + SQLite + Playwright」的重架构，代价是：

- 引擎要单独构建部署，BRAT 装完即坏
- 原生模块 `better-sqlite3` 绑死 Node 版本
- macOS 上 IPC 管道路径写成了 Windows 命名管道格式，请求全部失败
- 采集时**丢弃了收藏夹名**，音乐和相声混在一个目录里
- 桌面端专用，手机上不可用

本项目只做 B 站 + X。这两个平台都只需要「带 Cookie 的 HTTP + 请求签名」，
不需要浏览器（B 站是 WBI 签名，X 是内部 GraphQL），因此可以做成**单进程、零原生依赖**的普通插件。

## 设计要点

- **无 Node API**：WBI 需要的 MD5 用纯 JS 实现，全插件不碰 `node:*`，因此桌面端和移动端都能跑
- **扫码登录**：走 B 站官方 passport 二维码接口换取 Cookie，不用去浏览器导出；
  Cookie 过期重扫一次即可
- **HTTP 走 `requestUrl`**：Obsidian 自带、不受 CORS 限制、可自定义 Cookie 头
- **保留收藏夹归属**：一条内容属于多个收藏夹时合并为一条笔记，`folders` 记录全部来源
- **模板驱动的组织方式**：目录/文件名/标签都是 `{platform}/{folder}` 这类模板，在设置里改，不用改代码
- **机器区与用户区隔离**：笔记里 `<!-- fav-sync:start/end -->` 之间每次同步重写，
  标记之外的内容和你自加的 frontmatter 字段永不覆盖
- **换收藏夹会移动笔记**，而不是产生重复
- **风控友好**：请求间隔可调，命中 B 站 `-412/-352` 立即中止

## 目录结构

```
src/
  main.ts              插件入口：命令、定时、面板
  settings.ts          配置模型与默认值
  settings-tab.ts      设置界面
  types.ts             跨模块的统一类型
  core/
    md5.ts             纯 JS MD5（WBI 签名用）
    http.ts            requestUrl 适配成 HttpClient
    util.ts            文件名清洗、模板、时间、Cookie 解析
    organizer.ts       目录 / 文件名 / 标签的生成规则
    note-builder.ts    笔记生成与增量更新（含用户区保护）
    index-store.ts     id → 笔记路径索引，用于去重与增量
    sync.ts            采集 → 组织 → 写入的编排
  sources/
    wbi.ts             B 站 WBI 签名（算法参考 omni-collector, MIT）
    bilibili.ts        收藏夹 / 稍后再看采集
    bilibili-login.ts  扫码登录（generate / poll / 解析 Cookie）
    x.ts               书签采集（内部 GraphQL）
  ui/sidebar.ts        侧边栏面板
  ui/qr-login-modal.ts 扫码登录弹窗
scripts/smoke.ts       本地冒烟测试，可脱离 Obsidian 验证采集链路
```

## 开发

```bash
pnpm install
pnpm build          # 构建到 dist/main.js
pnpm smoke          # 离线校验（MD5/WBI/组织规则/笔记生成）
BILI_COOKIE="SESSDATA=...; DedeUserID=..." pnpm smoke   # 额外跑通真实采集
```

安装到 vault：把 `dist/main.js`、`manifest.json`、`styles.css` 放进
`<vault>/.obsidian/plugins/gogoga-fav-sync/`。

## 已知边界

- X 的 GraphQL `queryId` 会随改版失效，设置里可随时更新（错误提示会说明去哪儿找）
- 同步依赖 Obsidian 处于打开状态（定时器在插件进程里）
- 微信公众号不在此列：它需要走订阅号 / 企业微信的 webhook 路线

## 致谢

B 站 WBI 签名的混排表与算法参考 [omni-collector](https://github.com/simonemuller6127-png/omni-collector)（MIT）。

## 网络与隐私

- **B 站**：`api.bilibili.com`（收藏夹、稍后再看）、`passport.bilibili.com`（扫码登录换取 Cookie）。需要 B 站账号。
- **X**：`x.com` 的内部 GraphQL 接口读取书签，使用你在设置里填的 Cookie。需要 X 账号。
- Cookie 以明文保存在本插件的 `data.json` 里（会随 vault 一起同步），只发给对应平台；没有遥测，也不经过任何第三方服务。
- 使用平台的非公开接口，可能随平台改版失效，也可能不符合平台的服务条款，请自行评估。

## 更新日志

每个版本的变化见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)（[English](CHANGELOG.md)）。发版前先写好新版本的条目：Release 说明从这里取，没写时发布会失败。

## 许可

MIT，见 [LICENSE](https://github.com/JackWeiGogoga/gogoga-fav-sync/blob/main/LICENSE)。
