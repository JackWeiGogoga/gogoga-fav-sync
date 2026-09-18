/** 用 esbuild 把 TS 冒烟测试打成临时 mjs 再执行（避免额外的 ts 运行时依赖）。 */
import esbuild from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const out = path.join(mkdtempSync(path.join(tmpdir(), "fav-sync-smoke-")), "smoke.mjs");

await esbuild.build({
  entryPoints: ["scripts/smoke.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  // obsidian 只在插件运行时存在，冒烟测试用不到；标记为外部避免解析失败
  external: ["obsidian"],
  outfile: out,
  logLevel: "warning",
});

execFileSync(process.execPath, [out], { stdio: "inherit", env: process.env });
