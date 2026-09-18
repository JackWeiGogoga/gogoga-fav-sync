/**
 * 本地冒烟测试：不进 Obsidian，直接用 node fetch 跑通采集链路。
 *
 * 用法：BILI_COOKIE="SESSDATA=...; DedeUserID=..." pnpm smoke
 * 不带 cookie 时只跑离线部分（MD5 / WBI / 组织规则 / 笔记生成）。
 */
import { md5Hex } from "../src/core/md5";
import { getMixinKey, signParams } from "../src/sources/wbi";
import { fetchBilibili, listBilibiliFolders } from "../src/sources/bilibili";
import { targetsFor, tagsFor } from "../src/core/organizer";
import { buildNote, updateNote } from "../src/core/note-builder";
import { DEFAULT_SETTINGS } from "../src/settings";
import { cookieFromCrossDomainUrl, cookieFromSetCookie, generateQr, pollQr } from "../src/sources/bilibili-login";
import qrcode from "qrcode-generator";
import type { CollectItem, HttpClient, HttpResponse } from "../src/types";

const nodeHttp: HttpClient = {
  async get(url, init): Promise<HttpResponse> {
    const qs = init?.params ? `?${new URLSearchParams(init.params).toString()}` : "";
    const res = await fetch(url + qs, { headers: init?.headers ?? {} });
    const text = await res.text();
    const headers: Record<string, string | string[]> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const sc = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
    if (sc.length > 0) headers["set-cookie"] = sc;
    return {
      status: res.status,
      text,
      headers,
      json<T>(): T {
        return JSON.parse(text) as T;
      },
    };
  },
};

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!cond) failures += 1;
}

async function main(): Promise<void> {
  console.log("--- 离线校验 ---");

  // MD5 标准测试向量：错一位，WBI 签名就全废
  check("md5('')", md5Hex("") === "d41d8cd98f00b204e9800998ecf8427e");
  check("md5('abc')", md5Hex("abc") === "900150983cd24fb0d6963f7d28e17f72");
  check(
    "md5('The quick brown fox jumps over the lazy dog')",
    md5Hex("The quick brown fox jumps over the lazy dog") === "9e107d9d372bb6826bd81d3542a419d6",
  );
  check("md5(中文)", md5Hex("你好") === "7eca689f0d3389d9dea66ae112e5cfd7");

  // WBI：固定输入应产出确定签名
  // 社区公开的标准测试向量，答案固定；对上即说明 MD5 与混排表都正确
  const mixin = getMixinKey("7cd084941338484aae1ad9425b84077c", "4932caff0ff746eab6f01bf08b70ac45");
  check("getMixinKey 匹配已知测试向量", mixin === "ea1db124af3c7062474693fa704f4ff8", mixin);
  const signed = signParams({ foo: "114", bar: "514" }, mixin);
  check("signParams 产出 w_rid", typeof signed.w_rid === "string" && signed.w_rid.length === 32);
  check("signParams 产出 wts", !!signed.wts);

  // 组织规则：收藏夹要真的进目录和标签
  const sample: CollectItem = {
    platform: "bilibili",
    id: "BV1xx411c7mD",
    title: "测试视频：带 / 非法字符 * 的标题",
    url: "https://www.bilibili.com/video/BV1xx411c7mD",
    author: "某 UP 主",
    folders: ["音乐", "相声"],
    tags: [],
    publishedAt: "2025-01-02T03:04:05.000Z",
    collectedAt: "2025-06-07T08:09:10.000Z",
    status: "active",
    media: [],
  };
  const org = DEFAULT_SETTINGS.bilibili;
  const targets = targetsFor(sample, org, "favorites");
  check("primary 模式只产出 1 个目标", targets.length === 1);
  check("目录含收藏夹名", targets[0]?.dir === "favorites/bilibili/音乐", targets[0]?.dir);
  check("文件名清洗掉非法字符", !/[/*]/.test(targets[0]?.fileName ?? ""), targets[0]?.fileName);

  const allTargets = targetsFor(sample, { ...org, multiFolderMode: "all" }, "favorites");
  check("all 模式按收藏夹各出一份", allTargets.length === 2, allTargets.map((t) => t.dir).join(" | "));

  const tags = tagsFor(sample, org, "音乐");
  check("标签含收藏夹层级", tags.includes("bilibili/音乐"), tags.join(", "));

  // 笔记生成 + 用户区保护
  const opts = { embedCover: true, embedPlayer: true, userSectionHeading: "我的笔记" };
  const note = buildNote(sample, tags, opts);
  check("frontmatter 含 folders", note.includes("folders: "));
  check("正文含收藏夹信息", note.includes("收藏夹：音乐、相声"));
  check(
    "collected 精确到秒（可同日排序）",
    /collected: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(note),
    note.split("\n").find((l) => l.startsWith("collected:")),
  );
  check("嵌入 B 站 iframe 播放器", note.includes("player.bilibili.com/player.html?bvid=BV1xx411c7mD"));
  check("播放器优先，不再放静态封面", !note.includes("![封面]"));
  const noPlayer = buildNote(sample, tags, { ...opts, embedPlayer: false });
  check("关闭播放器时回退到封面逻辑", !noPlayer.includes("<iframe"));

  const edited = note.replace("## 我的笔记\n", "## 我的笔记\n这是我手写的内容，不能被覆盖。\n");
  const updated = updateNote(edited, { ...sample, title: "改了标题" }, tags, opts);
  check("更新后保留用户手写内容", updated.includes("这是我手写的内容，不能被覆盖。"));
  check("更新后机器区已刷新", updated.includes("改了标题"));

  const withCustomFm = note.replace("source: bilibili", "source: bilibili\nmy_rating: 5");
  const updated2 = updateNote(withCustomFm, sample, tags, opts);
  check("更新后保留用户自加的 frontmatter 字段", updated2.includes("my_rating: 5"));

  // 扫码登录：Cookie 解析绝不能做 URL 解码，SESSDATA 真身就含 %2C / %2A
  const fakeCross =
    "https://passport.biligame.com/x/passport-login/web/crossDomain?" +
    "DedeUserID=100000000&DedeUserID__ckMd5=0000000000000000&Expires=1800000000&" +
    "SESSDATA=fake0001%2C1800000000%2C00000%2A81SYNTHETIC&bili_jct=0123456789abcdef0123456789abcdef&gourl=https%3A%2F%2Fwww.bilibili.com";
  const parsedCookie = cookieFromCrossDomainUrl(fakeCross);
  check("扫码登录能取出 SESSDATA", parsedCookie.includes("SESSDATA="));
  check(
    "SESSDATA 保留百分号编码（不被解码）",
    parsedCookie.includes("fake0001%2C1800000000%2C00000%2A81SYNTHETIC"),
    parsedCookie.split("; ").find((x) => x.startsWith("SESSDATA")),
  );
  check("取到 bili_jct 与 DedeUserID",
    parsedCookie.includes("bili_jct=0123456789abcdef0123456789abcdef") &&
      parsedCookie.includes("DedeUserID=100000000"));
  check("不混入无关参数 gourl", !parsedCookie.includes("gourl"));

  // 当前 B 站把 Cookie 放在 Set-Cookie 响应头里（data.url 已不再携带）
  const scArray = [
    "SESSDATA=fake0002%2C1800000000%2C00000%2A81SYNTHETIC; Path=/; Domain=bilibili.com; Expires=Wed, 17 Sep 2026 03:32:53 GMT; HttpOnly; Secure; SameSite=None",
    "bili_jct=0123456789abcdef0123456789abcdef; Path=/; Domain=bilibili.com; Expires=Wed, 17 Sep 2026 03:32:53 GMT",
    "DedeUserID=100000000; Path=/; Domain=bilibili.com",
    "DedeUserID__ckMd5=0000000000000000; Path=/; Domain=bilibili.com",
    "sid=test0000; Path=/; Domain=bilibili.com",
  ];
  const fromArray = cookieFromSetCookie({ "set-cookie": scArray });
  check("Set-Cookie 数组形态能取出全部 5 个", fromArray.split("; ").length === 5, fromArray.replace(/=[^;]*/g, "=…"));
  check("SESSDATA 值正确且保留编码", fromArray.includes("SESSDATA=fake0002%2C1800000000%2C00000%2A81SYNTHETIC"));
  check(
    "DedeUserID 不会误匹配到 DedeUserID__ckMd5",
    fromArray.includes("DedeUserID=100000000") && fromArray.includes("DedeUserID__ckMd5=0000000000000000"),
  );
  // 有些实现把多条 Set-Cookie 用逗号拼成一个字符串，而 Expires 里本身就有逗号
  const fromJoined = cookieFromSetCookie({ "Set-Cookie": scArray.join(", ") });
  check("逗号拼接形态同样能正确解析", fromJoined === fromArray, fromJoined === fromArray ? "" : fromJoined);
  check("没有 Set-Cookie 时返回空串", cookieFromSetCookie({ "content-type": "application/json" }) === "");

  // 二维码编码：确保登录链接能被正常编码成矩阵
  const qr = qrcode(0, "M");
  qr.addData("https://account.bilibili.com/h5/account-h5/auth/scan-web?navhide=1&callback=close&qrcode_key=" + "a".repeat(32));
  qr.make();
  check("二维码可编码登录链接", qr.getModuleCount() >= 21, `${qr.getModuleCount()}x${qr.getModuleCount()} 模块`);

  // 扫码登录接口连通性：无需登录态，只发 2 个轻量请求
  try {
    const sess = await generateQr(nodeHttp);
    check("生成二维码接口可用", !!sess.key && sess.url.startsWith("http"), `key ${sess.key.length} 位`);
    const st = await pollQr(nodeHttp, sess.key);
    check("轮询返回「未扫码」状态", st.state === "pending", st.state);
  } catch (e) {
    check("扫码登录接口连通", false, e instanceof Error ? e.message : String(e));
  }

  // ---- 需要 cookie 的在线部分 ----
  const cookie = process.env.BILI_COOKIE ?? "";
  if (!cookie) {
    console.log("\n（未提供 BILI_COOKIE，跳过在线测试）");
  } else {
    console.log("\n--- 在线校验（B 站）---");
    const folders = await listBilibiliFolders(nodeHttp, cookie);
    check("列出收藏夹", folders.length > 0, folders.join("、"));

    const res = await fetchBilibili(
      nodeHttp,
      { ...DEFAULT_SETTINGS.bilibili, maxPagesPerFolder: 1, requestDelayMs: 600 },
      cookie,
      (p) => process.stdout.write(`\r  ${p.message}${" ".repeat(20)}`),
    );
    console.log("");
    check("抓到条目", res.items.length > 0, `${res.items.length} 条`);
    const withFolder = res.items.filter((i) => i.folders.length > 0);
    check(
      "条目带收藏夹归属（核心修复点）",
      withFolder.length === res.items.length,
      `${withFolder.length}/${res.items.length}`,
    );
    const multi = res.items.filter((i) => i.folders.length > 1);
    console.log(`  跨多个收藏夹的条目：${multi.length} 条`);
    const sampleItem = res.items[0];
    if (sampleItem) {
      const t = targetsFor(sampleItem, DEFAULT_SETTINGS.bilibili, "favorites");
      console.log(`  示例落点：${t[0]?.path}`);
      console.log(`  示例标签：${tagsFor(sampleItem, DEFAULT_SETTINGS.bilibili, sampleItem.folders[0]).join(", ")}`);
    }
    // 增量验证：用第一次的水位再跑一次，请求数应显著下降且不再有新增
    console.log("\n--- 增量校验 ---");
    const full = await fetchBilibili(
      nodeHttp,
      { ...DEFAULT_SETTINGS.bilibili, maxPagesPerFolder: 20, requestDelayMs: 350 },
      cookie,
      undefined,
      { incremental: false, watermarks: {} },
    );
    console.log(`  全量：${full.items.length} 条 / ${full.requests} 次请求`);
    const inc = await fetchBilibili(
      nodeHttp,
      { ...DEFAULT_SETTINGS.bilibili, maxPagesPerFolder: 20, requestDelayMs: 350 },
      cookie,
      undefined,
      { incremental: true, watermarks: full.watermarks },
    );
    console.log(`  增量：${inc.items.length} 条 / ${inc.requests} 次请求`);
    check("增量请求数明显少于全量", inc.requests < full.requests,
      `${inc.requests} < ${full.requests}（省 ${Math.round((1 - inc.requests / full.requests) * 100)}%）`);
    check("水位已记录", Object.keys(full.watermarks).length > 0,
      `${Object.keys(full.watermarks).length} 个收藏夹`);
    console.log(`  整夹跳过：全量 ${full.skippedFolders} / 增量 ${inc.skippedFolders}`);

    // 第三次：用增量自己产出的水位再跑，模拟“什么都没新增”的定时同步
    const idle = await fetchBilibili(
      nodeHttp,
      { ...DEFAULT_SETTINGS.bilibili, maxPagesPerFolder: 20, requestDelayMs: 350 },
      cookie,
      undefined,
      { incremental: true, watermarks: inc.watermarks },
    );
    console.log(`  空跑：${idle.items.length} 条 / ${idle.requests} 次请求 / 跳过 ${idle.skippedFolders} 个收藏夹`);
    check("无变化时请求数降到个位数", idle.requests <= 5, `${idle.requests} 次`);
    check("无变化时几乎全部收藏夹被跳过", idle.skippedFolders >= 28, `跳过 ${idle.skippedFolders}/31`);

    const folderDist = new Map<string, number>();
    for (const it of res.items) {
      for (const f of it.folders) folderDist.set(f, (folderDist.get(f) ?? 0) + 1);
    }
    console.log(`  收藏夹分布：${[...folderDist.entries()].map(([k, v]) => `${k}(${v})`).join(" ")}`);
  }

  console.log(`\n${failures === 0 ? "全部通过 ✅" : `${failures} 项失败 ❌`}`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
