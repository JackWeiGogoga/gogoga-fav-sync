/** 通用小工具：文件名清洗、模板渲染、时间格式化、限速。 */

/** Windows/macOS 都不允许或会让 Obsidian 困扰的字符。 */
const ILLEGAL = /[\\/:*?"<>|#^[\]]/g;

/** 去掉 C0 控制字符与 DEL（U+0000–U+001F、U+007F）。按码点过滤，避免正则里直接写控制字符。 */
function stripControl(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code > 0x1f && code !== 0x7f) out += ch;
  }
  return out;
}

/**
 * 清洗成安全的文件/目录名：去非法字符、压缩空白、限长。
 * 保留中文与常见符号，尽量维持可读性。
 */
export function sanitizeName(input: string, maxLen = 80): string {
  const cleaned = stripControl(input || "")
    .replace(ILLEGAL, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .trim();
  const safe = cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() : cleaned;
  return safe || "untitled";
}

/** 拼接 vault 相对路径，忽略空段。 */
export function joinPath(...parts: Array<string | undefined>): string {
  return parts
    .filter((p): p is string => !!p && p.trim() !== "")
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter((p) => p !== "")
    .join("/");
}

/**
 * 渲染 `{token}` 模板。未知 token 原样保留，便于用户发现拼错。
 * 每段值都会被 sanitizeName 处理，模板里的 `/` 作为目录分隔保留。
 */
export function applyTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = vars[key];
    if (v === undefined) return whole;
    return sanitizeName(v);
  });
}

/** 秒 → mm:ss / h:mm:ss。 */
export function formatDuration(sec?: number): string | undefined {
  if (!sec || sec <= 0) return undefined;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** ISO 字符串 → YYYY-MM-DD（本地时区）。 */
export function toDateStr(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * ISO 字符串 → 本地时区的 `YYYY-MM-DDTHH:mm:ss`。
 * 用于 collected 字段：保留到秒才能在同一天内正确排序，
 * 且这种格式能被 Obsidian / Dataview / Notebook Navigator 直接当日期解析。
 */
export function toDateTimeStr(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

/** 秒级/毫秒级时间戳 → ISO。0 或空返回 undefined。 */
export function tsToIso(ts?: number): string | undefined {
  if (!ts || ts <= 0) return undefined;
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 解析 `k=v; k2=v2` 形式的 cookie 串。 */
export function parseCookie(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (raw || "").split(";")) {
    const idx = pair.indexOf("=");
    if (idx <= 0) continue;
    const k = pair.slice(0, idx).trim();
    if (k) out[k] = pair.slice(idx + 1).trim();
  }
  return out;
}

/**
 * 接受 Cookie-Editor 导出的 JSON 数组，或 `k=v; k2=v2` 头字符串，
 * 统一转成可直接放进 Cookie 请求头的字符串。
 */
export function normalizeCookieInput(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("[")) {
    try {
      const arr = JSON.parse(raw) as Array<{ name?: string; value?: string }>;
      return arr
        .filter((c) => c && c.name)
        .map((c) => `${c.name}=${c.value ?? ""}`)
        .join("; ");
    } catch {
      return raw;
    }
  }
  return raw;
}

/** 截断到指定长度，超出加省略号（用于从正文生成标题）。 */
export function truncate(text: string, maxLen: number): string {
  const oneLine = (text || "").replace(/\s+/g, " ").trim();
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine;
}

/** YAML 标量转义：统一用双引号包裹，规避冒号/引号/换行带来的解析问题。 */
export function yamlString(value: string): string {
  return `"${(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

/** YAML 字符串数组。 */
export function yamlList(values: string[]): string {
  return `[${values.map((v) => yamlString(v)).join(", ")}]`;
}
