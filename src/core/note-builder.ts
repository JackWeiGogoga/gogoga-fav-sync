/**
 * 笔记生成。
 *
 * 关键约定：笔记分「机器区」和「用户区」。
 * 机器区在 <!-- fav-sync:start --> / <!-- fav-sync:end --> 之间，每次同步重写；
 * 标记之外的一切（包括你自己写的笔记、自己加的 frontmatter 字段）永不覆盖。
 */
import type { CollectItem } from "../types";
import { formatDuration, toDateStr, toDateTimeStr, yamlList, yamlString } from "./util";

const START = "<!-- fav-sync:start -->";
const END = "<!-- fav-sync:end -->";

/** 由本插件维护的 frontmatter 字段，更新时会被重写；其余字段原样保留。 */
const MANAGED_KEYS = new Set([
  "source",
  "id",
  "title",
  "url",
  "author",
  "author_url",
  "cover",
  "folders",
  "tags",
  "duration",
  "published",
  "collected",
  "synced",
  "status",
]);

export interface BuildOptions {
  embedCover: boolean;
  /** 用 iframe 嵌入官方播放器（B 站视频 / X 推文），优先于封面图。 */
  embedPlayer: boolean;
  /** 用户手写区的标题，只在新建笔记时写入一次。 */
  userSectionHeading: string;
}

/**
 * 官方播放器 iframe。
 * B 站用 player.bilibili.com，可直接在阅读视图里播放；
 * 实体化 & 为 &amp; 以符合 HTML 规范（与 Obsidian Web Clipper 的写法保持一致）。
 */
function playerEmbed(item: CollectItem): string | null {
  if (item.platform === "bilibili") {
    return (
      `<iframe width="560" height="315" ` +
      `src="https://player.bilibili.com/player.html?bvid=${item.id}` +
      `&amp;page=1&amp;high_quality=1&amp;danmaku=0" ` +
      `title="Bilibili video player" frameborder="0" allowfullscreen=""></iframe>`
    );
  }
  if (item.platform === "x") {
    return (
      `<iframe width="550" height="600" ` +
      `src="https://platform.twitter.com/embed/Tweet.html?id=${item.id}" ` +
      `title="X post" frameborder="0" allowfullscreen=""></iframe>`
    );
  }
  return null;
}

function buildFrontmatter(
  item: CollectItem,
  tags: string[],
  preserved: string[],
): string {
  const lines: string[] = ["---"];
  lines.push(`source: ${item.platform}`);
  lines.push(`id: ${yamlString(item.id)}`);
  lines.push(`title: ${yamlString(item.title)}`);
  lines.push(`url: ${yamlString(item.url)}`);
  if (item.author) lines.push(`author: ${yamlString(item.author)}`);
  if (item.authorUrl) lines.push(`author_url: ${yamlString(item.authorUrl)}`);
  if (item.cover) lines.push(`cover: ${yamlString(item.cover)}`);
  if (item.folders.length > 0) lines.push(`folders: ${yamlList(item.folders)}`);
  if (tags.length > 0) lines.push(`tags: ${yamlList(tags)}`);
  const dur = formatDuration(item.durationSec);
  if (dur) lines.push(`duration: ${yamlString(dur)}`);
  if (item.publishedAt) lines.push(`published: ${toDateStr(item.publishedAt)}`);
  // 精确到秒：同一天收藏的多条也能正确排序
  if (item.collectedAt) lines.push(`collected: ${toDateTimeStr(item.collectedAt)}`);
  lines.push(`synced: ${toDateStr(new Date().toISOString())}`);
  lines.push(`status: ${item.status}`);
  lines.push(...preserved);
  lines.push("---");
  return lines.join("\n");
}

function buildMachineBody(item: CollectItem, opts: BuildOptions): string {
  const out: string[] = [];
  out.push(`# ${item.title}`);
  out.push("");

  if (item.status === "invalid") {
    out.push("> [!warning] 该内容在平台上已失效（被删除、私密或下架）");
    out.push("");
  }

  // 播放器优先：能直接播放时就不再放静态封面
  const embed = opts.embedPlayer ? playerEmbed(item) : null;
  if (embed) {
    out.push(embed);
    out.push("");
  } else if (opts.embedCover && item.cover) {
    out.push(`![封面](${item.cover})`);
    out.push("");
  }

  // 元信息用 callout，紧凑且在阅读视图里好看
  const meta: string[] = [];
  if (item.author) {
    meta.push(item.authorUrl ? `- 作者：[${item.author}](${item.authorUrl})` : `- 作者：${item.author}`);
  }
  if (item.folders.length > 0) meta.push(`- 收藏夹：${item.folders.join("、")}`);
  const dur = formatDuration(item.durationSec);
  if (dur) meta.push(`- 时长：${dur}`);
  if (item.publishedAt) meta.push(`- 发布：${toDateStr(item.publishedAt)}`);
  if (item.collectedAt) meta.push(`- 收藏：${toDateStr(item.collectedAt)}`);
  meta.push(`- 原链接：${item.url}`);
  if (meta.length > 0) {
    out.push("> [!info] 信息");
    out.push(...meta.map((m) => `> ${m}`));
    out.push("");
  }

  if (item.description) {
    out.push(item.platform === "x" ? "## 正文" : "## 简介");
    out.push("");
    out.push(item.description);
    out.push("");
  }

  const quotedText = item.extra?.quoted_text;
  if (typeof quotedText === "string" && quotedText) {
    const who = typeof item.extra?.quoted_author === "string" ? item.extra.quoted_author : "";
    out.push(`## 引用${who ? ` ${who}` : ""}`);
    out.push("");
    out.push(quotedText.split("\n").map((l) => `> ${l}`).join("\n"));
    out.push("");
  }

  const images = item.media.filter((m) => m.type === "image");
  const videos = item.media.filter((m) => m.type !== "image");
  if (images.length > 0 || videos.length > 0) {
    out.push("## 媒体");
    out.push("");
    for (const img of images) out.push(`![](${img.url})`);
    for (const v of videos) out.push(`- ${v.type === "gif" ? "GIF" : "视频"}：${v.url}`);
    out.push("");
  }

  return out.join("\n").trimEnd();
}

/** 新建笔记的完整内容。 */
export function buildNote(item: CollectItem, tags: string[], opts: BuildOptions): string {
  return [
    buildFrontmatter(item, tags, []),
    "",
    START,
    buildMachineBody(item, opts),
    END,
    "",
    `## ${opts.userSectionHeading}`,
    "",
    "",
  ].join("\n");
}

/** 拆出已有笔记的 frontmatter 原始行与正文。 */
function splitExisting(content: string): { fmLines: string[]; body: string } {
  if (!content.startsWith("---\n")) return { fmLines: [], body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { fmLines: [], body: content };
  const fmBlock = content.slice(4, end);
  const rest = content.slice(end + 4).replace(/^\n/, "");
  return { fmLines: fmBlock.split("\n"), body: rest };
}

/** 找出用户自己加的 frontmatter 字段（不在管理列表里的顶层键）。 */
function preservedFrontmatter(fmLines: string[]): string[] {
  const out: string[] = [];
  let keeping = false;
  for (const line of fmLines) {
    const m = /^([A-Za-z0-9_-]+):/.exec(line);
    if (m) {
      keeping = !MANAGED_KEYS.has(m[1] ?? "");
      if (keeping) out.push(line);
      continue;
    }
    // 续行（数组/多行值）跟随上一个键的去留
    if (keeping && /^\s+/.test(line)) out.push(line);
  }
  return out;
}

/**
 * 更新已有笔记：重写 frontmatter 的管理字段与机器区，
 * 保留用户新增的 frontmatter 字段和标记外的全部内容。
 * 若笔记没有标记（用户删了或手工建的），只更新 frontmatter，正文完全不动。
 */
export function updateNote(
  existing: string,
  item: CollectItem,
  tags: string[],
  opts: BuildOptions,
): string {
  const { fmLines, body } = splitExisting(existing);
  const frontmatter = buildFrontmatter(item, tags, preservedFrontmatter(fmLines));

  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    return `${frontmatter}\n${body.startsWith("\n") ? body.slice(1) : body}`;
  }

  const before = body.slice(0, start);
  const after = body.slice(end + END.length);
  const machine = `${START}\n${buildMachineBody(item, opts)}\n${END}`;
  return `${frontmatter}\n${before}${machine}${after}`;
}

/** 判断内容是否由本插件生成（用于重建索引时识别）。 */
export function isManagedNote(content: string): boolean {
  return content.includes(START) || /^---\n[\s\S]*?\nsource:\s*(bilibili|x)\b/m.test(content);
}
