/**
 * サイドバーに並ぶページのパス（"" はダッシュボード）。
 * ページを追加するときは必ずここに足すこと。サイドバーの navItems もこの配列から
 * 組み立てるため、ここに無いページはリンクを張れない（型エラーになる）。
 */
export const NAV_PATHS = ["", "cf", "bs", "accounts", "insights", "simulator"] as const;

export type NavPath = (typeof NAV_PATHS)[number];

/**
 * グループIDと区別するための既知ページパス。
 * ここに載っていないパスは先頭セグメントがグループIDとみなされ、サイドバーの
 * 全リンクが /<そのパス>/... という壊れたURLになる。
 * （2026-06-14 の /insights 追加時にこの更新が漏れ、insightsページ上で全タブが
 *   404になっていた）
 */
const KNOWN_PATHS: readonly string[] = NAV_PATHS.filter((path) => path !== "");

export function extractPagePath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return "";

  if (KNOWN_PATHS.includes(segments[0])) {
    return segments.join("/");
  }

  return segments.slice(1).join("/");
}

export function extractGroupIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (!firstSegment) return null;
  if (KNOWN_PATHS.includes(firstSegment)) return null;

  return firstSegment;
}

export function buildGroupPath(groupId: string | null | undefined, path: string): string {
  if (groupId) {
    return path ? `/${groupId}/${path}` : `/${groupId}`;
  }
  return path ? `/${path}` : "/";
}

export function isNavItemActive(
  pathname: string,
  itemPath: string,
  groupId: string | null,
): boolean {
  const basePath = groupId ? `/${groupId}` : "";
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  if (itemPath === "") {
    return normalizedPathname === (basePath || "");
  }

  return pathname.startsWith(`${basePath}/${itemPath}`);
}
