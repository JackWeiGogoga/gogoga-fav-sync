# Changelog

All notable changes to gogoga Fav Sync are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/). 中文版见 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md).

## [0.2.0] - 2026-10-15

### Added
- English and Simplified Chinese interface, following Obsidian's language.
- English README with a Simplified Chinese translation.

## [0.1.1] - 2026-10-14

### Changed
- Reworded the plugin description.

## [0.1.0] - 2026-10-14

First public release.

### Added
- Syncs Bilibili favorites and X (Twitter) bookmarks into notes, on desktop and mobile.
- Bilibili QR code login, no manual cookie export.
- An item in several folders becomes one note that lists all of them; moving it to another folder moves the note instead of duplicating it.
- Folders, file names and tags come from templates you can change in settings.
- Each sync rewrites only the plugin's own section; your text and frontmatter fields are never overwritten.
- Incremental sync with an adjustable request interval; it stops at once when Bilibili rate-limits.

[0.2.0]: https://github.com/JackWeiGogoga/gogoga-fav-sync/compare/0.1.1...0.2.0
[0.1.1]: https://github.com/JackWeiGogoga/gogoga-fav-sync/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/JackWeiGogoga/gogoga-fav-sync/releases/tag/0.1.0
