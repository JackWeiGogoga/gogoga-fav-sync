/**
 * 决定一条收藏落到哪个目录、叫什么文件名、带哪些标签。
 * 全部由模板驱动，用户可在设置里改，不用改代码。
 */
import type { CollectItem } from "../types";
import type { OrganizeSettings } from "../settings";
import { applyTemplate, joinPath, sanitizeName, toDateStr } from "./util";

export interface NoteTarget {
  /** vault 相对目录。 */
  dir: string;
  /** 文件名（含 .md）。 */
  fileName: string;
  /** 完整 vault 相对路径。 */
  path: string;
  /** 该笔记所归属的收藏夹（multiFolderMode=all 时逐个生成）。 */
  folder?: string;
}

/** 模板可用的变量。 */
function templateVars(item: CollectItem, folder?: string): Record<string, string | undefined> {
  const dateSrc = item.collectedAt ?? item.publishedAt;
  const date = toDateStr(dateSrc);
  return {
    platform: item.platform,
    folder: folder ?? "",
    author: item.author ?? "未知作者",
    title: item.title,
    id: item.id,
    date,
    // 显式区分两种日期：X 的 collected 是合成的「首次见到」，
    // 文件名用 published 才有信息量
    published: toDateStr(item.publishedAt),
    collected: toDateStr(item.collectedAt),
    year: date.slice(0, 4),
    month: date.slice(5, 7),
  };
}

/**
 * 渲染目录模板。空的 {folder} 会让路径出现空段，joinPath 会自动吃掉，
 * 因此「无收藏夹」的内容会自然落在上一级目录。
 */
function renderDir(template: string, vars: Record<string, string | undefined>): string {
  const parts = template
    .split("/")
    .map((seg) => applyTemplate(seg, vars).trim())
    .filter((seg) => seg !== "");
  return parts.join("/");
}

/** 计算一条收藏要写入的所有目标（通常一个；multiFolderMode=all 时可能多个）。 */
export function targetsFor(
  item: CollectItem,
  org: OrganizeSettings,
  rootFolder: string,
): NoteTarget[] {
  const folders = item.folders.length > 0 ? item.folders : [undefined];
  const chosen = org.multiFolderMode === "all" ? folders : [folders[0]];

  return chosen.map((folder) => {
    const vars = templateVars(item, folder);
    const dir = joinPath(rootFolder, renderDir(org.dirTemplate, vars));
    const base = applyTemplate(org.fileTemplate, vars).trim() || item.id;
    const fileName = `${sanitizeName(base)}.md`;
    return { dir, fileName, path: joinPath(dir, fileName), folder };
  });
}

/** 标签里不能有空格，统一转连字符；保留 `/` 以支持层级标签。 */
function sanitizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}/_-]/gu, "")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/** 按模板渲染标签列表，并合并平台自带话题标签。 */
export function tagsFor(
  item: CollectItem,
  org: OrganizeSettings,
  folder?: string,
): string[] {
  const vars = templateVars(item, folder);
  const out: string[] = [];

  for (const tpl of org.tagTemplates) {
    // 模板含 {folder} 但这条没有收藏夹时跳过，避免产出半截标签
    if (tpl.includes("{folder}") && !vars.folder) continue;
    const rendered = sanitizeTag(applyTemplate(tpl, vars));
    if (rendered) out.push(rendered);
  }
  for (const t of item.tags) {
    const clean = sanitizeTag(t);
    if (clean) out.push(clean);
  }
  return [...new Set(out)];
}
