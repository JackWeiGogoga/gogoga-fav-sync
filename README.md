# gogoga Fav Sync

**English** | [简体中文](https://github.com/JackWeiGogoga/gogoga-fav-sync/blob/main/README.zh-CN.md)

Sync your **Bilibili favorites** and **X (Twitter) bookmarks** into Obsidian notes.

The interface follows Obsidian's language setting: it is in English, or in Simplified Chinese when Obsidian is set to Chinese.

## Why a rewrite

This plugin replaces [omni-collector](https://github.com/simonemuller6127-png/omni-collector). To cover five platforms, that project uses a heavy architecture of an Obsidian plugin, a standalone Node engine, IPC, SQLite, and Playwright. The costs:

- The engine has to be built and deployed separately, so it breaks right after installing through BRAT.
- The native module `better-sqlite3` is tied to a specific Node version.
- On macOS, the IPC pipe path uses the Windows named-pipe format, so every request fails.
- It **drops the favorites folder name** when collecting, so music and comedy end up mixed in one folder.
- It is desktop-only and doesn't work on mobile.

This project only covers Bilibili and X. Both platforms only need HTTP with cookies plus request signing, and no browser (Bilibili uses WBI signing, X uses its internal GraphQL API). That makes it possible to build a regular plugin with **a single process and no native dependencies**.

## Design highlights

- **No Node APIs**: The MD5 needed for WBI is implemented in plain JavaScript, and the plugin never touches `node:*`, so it runs on both desktop and mobile.
- **QR code login**: Cookies are obtained through Bilibili's official passport QR code API, so you don't need to export them from a browser. When the cookie expires, scan again.
- **HTTP through `requestUrl`**: Built into Obsidian, not subject to CORS, and supports a custom Cookie header.
- **Keeps favorites folder membership**: When an item belongs to several favorites folders, it becomes a single note, and `folders` records every source.
- **Template-driven organization**: Folders, file names, and tags are templates such as `{platform}/{folder}`. Change them in settings, not in code.
- **Separate plugin and user areas**: The content between `<!-- fav-sync:start/end -->` in a note is rewritten on every sync. Content outside the markers and frontmatter fields you add yourself are never overwritten.
- **Moving an item to another favorites folder moves the note** instead of creating a duplicate.
- **Rate-limit friendly**: The request interval is adjustable, and syncing stops immediately when Bilibili returns `-412/-352`.

## Project structure

```
src/
  main.ts              plugin entry: commands, timers, panel
  settings.ts          settings model and defaults
  settings-tab.ts      settings UI
  types.ts             shared types
  core/
    md5.ts             pure-JS MD5 (for WBI signing)
    http.ts            requestUrl wrapped as an HttpClient
    util.ts            file-name sanitizing, templates, time, cookie parsing
    organizer.ts       rules for folders / file names / tags
    note-builder.ts    note generation and incremental updates (protects your own edits)
    index-store.ts     id → note path index for dedup and incremental sync
    sync.ts            orchestrates fetch → organize → write
  sources/
    wbi.ts             Bilibili WBI signing (algorithm adapted from omni-collector, MIT)
    bilibili.ts        favorites / Watch Later fetching
    bilibili-login.ts  QR-code login (generate / poll / parse cookies)
    x.ts               bookmark fetching (internal GraphQL)
  ui/sidebar.ts        sidebar panel
  ui/qr-login-modal.ts QR-code login modal
scripts/smoke.ts       local smoke test that exercises fetching outside Obsidian
```

## Development

```bash
pnpm install
pnpm build          # outputs dist/main.js
pnpm smoke          # offline checks (MD5/WBI/organizing rules/note generation)
BILI_COOKIE="SESSDATA=...; DedeUserID=..." pnpm smoke   # also runs a real fetch
```

To install into a vault, copy `dist/main.js`, `manifest.json`, and `styles.css` into
`<vault>/.obsidian/plugins/gogoga-fav-sync/`.

## Known limitations

- X's GraphQL `queryId` stops working when X changes its site. You can update it in settings at any time, and the error message tells you where to find it.
- Syncing requires Obsidian to be open, because the timer runs inside the plugin.
- WeChat Official Accounts are out of scope: they would need the subscription account or WeCom webhook approach.

## Acknowledgments

The mixing table and algorithm for Bilibili WBI signing are based on [omni-collector](https://github.com/simonemuller6127-png/omni-collector) (MIT).

## Network and privacy

- **Bilibili**: `api.bilibili.com` (favorites, Watch Later) and `passport.bilibili.com` (QR code login to obtain cookies). Requires a Bilibili account.
- **X**: Reads bookmarks through the internal GraphQL API on `x.com`, using the cookie you enter in settings. Requires an X account.
- Cookies are stored in plain text in this plugin's `data.json` (which syncs along with your vault) and are only sent to the matching platform. There is no telemetry, and no third-party service is involved.
- The plugin uses non-public platform APIs. They may stop working when the platforms change, and using them may not comply with the platforms' terms of service. Evaluate this for yourself.

## License

MIT. See [LICENSE](https://github.com/JackWeiGogoga/gogoga-fav-sync/blob/main/LICENSE).
