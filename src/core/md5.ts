/**
 * 纯 JS MD5（无 node:crypto 依赖）。
 *
 * B 站 WBI 签名需要 MD5。刻意不用 node 的 createHash，
 * 这样整个插件不含任何 Node API，桌面端和移动端都能运行。
 * 实现取自经典的公有领域 JS MD5 算法。
 */

function safeAdd(x: number, y: number): number {
  const lsw = (x & 0xffff) + (y & 0xffff);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xffff);
}

function rotateLeft(num: number, cnt: number): number {
  return (num << cnt) | (num >>> (32 - cnt));
}

function cmn(q: number, a: number, b: number, x: number, s: number, t: number): number {
  return safeAdd(rotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
}

function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & c) | (~b & d), a, b, x, s, t);
}

function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn((b & d) | (c & ~d), a, b, x, s, t);
}

function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(b ^ c ^ d, a, b, x, s, t);
}

function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number): number {
  return cmn(c ^ (b | ~d), a, b, x, s, t);
}

function binlMD5(x: number[], len: number): number[] {
  /* eslint-disable no-param-reassign */
  x[len >> 5] |= 0x80 << len % 32;
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const olda = a;
    const oldb = b;
    const oldc = c;
    const oldd = d;

    a = ff(a, b, c, d, x[i] ?? 0, 7, -680876936);
    d = ff(d, a, b, c, x[i + 1] ?? 0, 12, -389564586);
    c = ff(c, d, a, b, x[i + 2] ?? 0, 17, 606105819);
    b = ff(b, c, d, a, x[i + 3] ?? 0, 22, -1044525330);
    a = ff(a, b, c, d, x[i + 4] ?? 0, 7, -176418897);
    d = ff(d, a, b, c, x[i + 5] ?? 0, 12, 1200080426);
    c = ff(c, d, a, b, x[i + 6] ?? 0, 17, -1473231341);
    b = ff(b, c, d, a, x[i + 7] ?? 0, 22, -45705983);
    a = ff(a, b, c, d, x[i + 8] ?? 0, 7, 1770035416);
    d = ff(d, a, b, c, x[i + 9] ?? 0, 12, -1958414417);
    c = ff(c, d, a, b, x[i + 10] ?? 0, 17, -42063);
    b = ff(b, c, d, a, x[i + 11] ?? 0, 22, -1990404162);
    a = ff(a, b, c, d, x[i + 12] ?? 0, 7, 1804603682);
    d = ff(d, a, b, c, x[i + 13] ?? 0, 12, -40341101);
    c = ff(c, d, a, b, x[i + 14] ?? 0, 17, -1502002290);
    b = ff(b, c, d, a, x[i + 15] ?? 0, 22, 1236535329);

    a = gg(a, b, c, d, x[i + 1] ?? 0, 5, -165796510);
    d = gg(d, a, b, c, x[i + 6] ?? 0, 9, -1069501632);
    c = gg(c, d, a, b, x[i + 11] ?? 0, 14, 643717713);
    b = gg(b, c, d, a, x[i] ?? 0, 20, -373897302);
    a = gg(a, b, c, d, x[i + 5] ?? 0, 5, -701558691);
    d = gg(d, a, b, c, x[i + 10] ?? 0, 9, 38016083);
    c = gg(c, d, a, b, x[i + 15] ?? 0, 14, -660478335);
    b = gg(b, c, d, a, x[i + 4] ?? 0, 20, -405537848);
    a = gg(a, b, c, d, x[i + 9] ?? 0, 5, 568446438);
    d = gg(d, a, b, c, x[i + 14] ?? 0, 9, -1019803690);
    c = gg(c, d, a, b, x[i + 3] ?? 0, 14, -187363961);
    b = gg(b, c, d, a, x[i + 8] ?? 0, 20, 1163531501);
    a = gg(a, b, c, d, x[i + 13] ?? 0, 5, -1444681467);
    d = gg(d, a, b, c, x[i + 2] ?? 0, 9, -51403784);
    c = gg(c, d, a, b, x[i + 7] ?? 0, 14, 1735328473);
    b = gg(b, c, d, a, x[i + 12] ?? 0, 20, -1926607734);

    a = hh(a, b, c, d, x[i + 5] ?? 0, 4, -378558);
    d = hh(d, a, b, c, x[i + 8] ?? 0, 11, -2022574463);
    c = hh(c, d, a, b, x[i + 11] ?? 0, 16, 1839030562);
    b = hh(b, c, d, a, x[i + 14] ?? 0, 23, -35309556);
    a = hh(a, b, c, d, x[i + 1] ?? 0, 4, -1530992060);
    d = hh(d, a, b, c, x[i + 4] ?? 0, 11, 1272893353);
    c = hh(c, d, a, b, x[i + 7] ?? 0, 16, -155497632);
    b = hh(b, c, d, a, x[i + 10] ?? 0, 23, -1094730640);
    a = hh(a, b, c, d, x[i + 13] ?? 0, 4, 681279174);
    d = hh(d, a, b, c, x[i] ?? 0, 11, -358537222);
    c = hh(c, d, a, b, x[i + 3] ?? 0, 16, -722521979);
    b = hh(b, c, d, a, x[i + 6] ?? 0, 23, 76029189);
    a = hh(a, b, c, d, x[i + 9] ?? 0, 4, -640364487);
    d = hh(d, a, b, c, x[i + 12] ?? 0, 11, -421815835);
    c = hh(c, d, a, b, x[i + 15] ?? 0, 16, 530742520);
    b = hh(b, c, d, a, x[i + 2] ?? 0, 23, -995338651);

    a = ii(a, b, c, d, x[i] ?? 0, 6, -198630844);
    d = ii(d, a, b, c, x[i + 7] ?? 0, 10, 1126891415);
    c = ii(c, d, a, b, x[i + 14] ?? 0, 15, -1416354905);
    b = ii(b, c, d, a, x[i + 5] ?? 0, 21, -57434055);
    a = ii(a, b, c, d, x[i + 12] ?? 0, 6, 1700485571);
    d = ii(d, a, b, c, x[i + 3] ?? 0, 10, -1894986606);
    c = ii(c, d, a, b, x[i + 10] ?? 0, 15, -1051523);
    b = ii(b, c, d, a, x[i + 1] ?? 0, 21, -2054922799);
    a = ii(a, b, c, d, x[i + 8] ?? 0, 6, 1873313359);
    d = ii(d, a, b, c, x[i + 15] ?? 0, 10, -30611744);
    c = ii(c, d, a, b, x[i + 6] ?? 0, 15, -1560198380);
    b = ii(b, c, d, a, x[i + 13] ?? 0, 21, 1309151649);
    a = ii(a, b, c, d, x[i + 4] ?? 0, 6, -145523070);
    d = ii(d, a, b, c, x[i + 11] ?? 0, 10, -1120210379);
    c = ii(c, d, a, b, x[i + 2] ?? 0, 15, 718787259);
    b = ii(b, c, d, a, x[i + 9] ?? 0, 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }
  return [a, b, c, d];
}

/** UTF-8 字节数组 → 32 位小端字数组。 */
function bytesToWords(bytes: Uint8Array): number[] {
  const out: number[] = new Array<number>(((bytes.length + 3) >> 2)).fill(0);
  for (let i = 0; i < bytes.length; i += 1) {
    out[i >> 2] = (out[i >> 2] ?? 0) | ((bytes[i] ?? 0) << (i % 4 << 3));
  }
  return out;
}

function wordsToHex(words: number[]): string {
  const hexTab = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < words.length * 4; i += 1) {
    const byte = ((words[i >> 2] ?? 0) >>> (i % 4 << 3)) & 0xff;
    out += (hexTab[(byte >>> 4) & 0x0f] ?? "") + (hexTab[byte & 0x0f] ?? "");
  }
  return out;
}

/** 计算字符串的 MD5（十六进制小写）。 */
export function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return wordsToHex(binlMD5(bytesToWords(bytes), bytes.length * 8));
}
