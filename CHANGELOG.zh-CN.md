# 更新日志

gogoga Fav Sync 每个版本的主要变化都记在这里。格式参照 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。English: [CHANGELOG.md](CHANGELOG.md).

## [0.2.0] - 2026-10-15

### 新增
- 界面支持英文和简体中文，跟随 Obsidian 的语言设置。
- 英文 README，另附简体中文版。

## [0.1.1] - 2026-10-14

### 改进
- 调整插件描述的措辞。

## [0.1.0] - 2026-10-14

首个公开版本。

### 新增
- 把 B 站收藏夹和 X（Twitter）书签同步成笔记，桌面端和移动端都能用。
- B 站扫码登录，不用手动导出 Cookie。
- 一条内容在多个收藏夹里时合并成一条笔记，记下全部来源；换收藏夹会移动笔记，不会重复。
- 目录、文件名、标签由模板决定，在设置里改。
- 每次同步只重写插件管理的区域，你自己写的内容和 frontmatter 字段不会被覆盖。
- 增量同步，请求间隔可调，遇到 B 站风控立即停止。

[0.2.0]: https://github.com/JackWeiGogoga/gogoga-fav-sync/compare/0.1.1...0.2.0
[0.1.1]: https://github.com/JackWeiGogoga/gogoga-fav-sync/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/JackWeiGogoga/gogoga-fav-sync/releases/tag/0.1.0
