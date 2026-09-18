/**
 * B 站 WBI 请求签名。
 *
 * 混排表与签名算法为社区公开逆向结果，实现参考 omni-collector（MIT）
 * https://github.com/simonemuller6127-png/omni-collector
 * 这里改为使用纯 JS MD5，去掉 node:crypto 依赖。
 */
import { md5Hex } from "../core/md5";

/** B 站 wbi 签名混排表。 */
const MIXIN_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

/** 由 nav 接口下发的 img_key / sub_key 推导出 mixin key。 */
export function getMixinKey(imgKey: string, subKey: string): string {
  const raw = imgKey + subKey;
  return MIXIN_TAB.map((i) => raw[i] ?? "").join("").slice(0, 32);
}

/** 给查询参数追加 wts + w_rid 签名。 */
export function signParams(
  params: Record<string, string>,
  mixinKey: string,
): Record<string, string> {
  const withWts: Record<string, string> = {
    ...params,
    wts: String(Math.floor(Date.now() / 1000)),
  };
  const query = Object.keys(withWts)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(withWts[k] ?? "")}`)
    .join("&");
  return { ...withWts, w_rid: md5Hex(query + mixinKey) };
}

/** 从 nav 返回的图片 URL 中截出 key（去掉路径与扩展名）。 */
export function keyFromUrl(url: string | undefined): string {
  return url?.split("/").pop()?.split(".")[0] ?? "";
}
