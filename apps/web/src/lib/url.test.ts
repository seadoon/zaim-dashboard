import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractGroupIdFromPath,
  extractPagePath,
  buildGroupPath,
  isNavItemActive,
  NAV_PATHS,
} from "./url";

describe("NAV_PATHS", () => {
  // 2026-06-14 に /insights を追加した際 NAV_PATHS への追加が漏れ、insightsページ上で
  // 全タブのリンクが /insights/<path> に壊れて404になっていた（2026-08-11に発覚）。
  // NAV_PATHS 自身を走査すると登録漏れを検出できないため、実際のルート定義と突き合わせる。
  it("app配下の全ページがNAV_PATHSに登録されている", () => {
    const appDir = join(import.meta.dirname, "../app");
    const routeDirs = readdirSync(appDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !name.startsWith("[") && !name.startsWith("_"))
      .filter((name) => existsSync(join(appDir, name, "page.tsx")));

    expect(routeDirs.length).toBeGreaterThan(0);
    for (const dir of routeDirs) {
      expect(NAV_PATHS).toContain(dir);
    }
  });

  it("各ページからサイドバーのリンクが自分自身を接頭辞にしない", () => {
    for (const current of NAV_PATHS) {
      const groupId = extractGroupIdFromPath(`/${current}/`);
      for (const target of NAV_PATHS) {
        expect(buildGroupPath(groupId, target)).toBe(target ? `/${target}` : "/");
      }
    }
  });
});

describe("extractGroupIdFromPath", () => {
  it("returns null for root path", () => {
    expect(extractGroupIdFromPath("/")).toBe(null);
  });

  it("returns null for known paths without groupId", () => {
    expect(extractGroupIdFromPath("/cf")).toBe(null);
    expect(extractGroupIdFromPath("/bs")).toBe(null);
    expect(extractGroupIdFromPath("/accounts")).toBe(null);
  });

  it("returns null for known paths with trailing slash", () => {
    expect(extractGroupIdFromPath("/cf/")).toBe(null);
    expect(extractGroupIdFromPath("/cf/2024-01")).toBe(null);
  });

  it("returns groupId for group root path", () => {
    expect(extractGroupIdFromPath("/abc123")).toBe("abc123");
    expect(extractGroupIdFromPath("/abc123/")).toBe("abc123");
  });

  it("returns groupId for group sub-paths", () => {
    expect(extractGroupIdFromPath("/abc123/cf")).toBe("abc123");
    expect(extractGroupIdFromPath("/abc123/bs")).toBe("abc123");
    expect(extractGroupIdFromPath("/abc123/accounts")).toBe("abc123");
    expect(extractGroupIdFromPath("/abc123/cf/2024-01")).toBe("abc123");
    expect(extractGroupIdFromPath("/abc123/accounts/xyz")).toBe("abc123");
  });

  it("handles complex groupIds", () => {
    expect(extractGroupIdFromPath("/XyZ123AbC-test1234567")).toBe("XyZ123AbC-test1234567");
    expect(extractGroupIdFromPath("/XyZ123AbC-test1234567/cf")).toBe("XyZ123AbC-test1234567");
  });
});

describe("extractPagePath", () => {
  it("returns empty string for root path", () => {
    expect(extractPagePath("/")).toBe("");
  });

  it("returns page path for known paths without groupId", () => {
    expect(extractPagePath("/cf")).toBe("cf");
    expect(extractPagePath("/bs")).toBe("bs");
    expect(extractPagePath("/accounts")).toBe("accounts");
  });

  it("returns empty string for group root path", () => {
    expect(extractPagePath("/abc123")).toBe("");
    expect(extractPagePath("/abc123/")).toBe("");
  });

  it("returns page path for group sub-paths", () => {
    expect(extractPagePath("/abc123/cf")).toBe("cf");
    expect(extractPagePath("/abc123/bs")).toBe("bs");
    expect(extractPagePath("/abc123/accounts")).toBe("accounts");
  });

  it("handles nested paths", () => {
    expect(extractPagePath("/cf/2024-01")).toBe("cf/2024-01");
    expect(extractPagePath("/abc123/cf/2024-01")).toBe("cf/2024-01");
    expect(extractPagePath("/abc123/accounts/xyz")).toBe("accounts/xyz");
  });

  it("handles complex groupIds", () => {
    expect(extractPagePath("/XyZ123AbC-test1234567")).toBe("");
    expect(extractPagePath("/XyZ123AbC-test1234567/cf")).toBe("cf");
    expect(extractPagePath("/XyZ123AbC-test1234567/bs")).toBe("bs");
  });
});

describe("buildGroupPath", () => {
  it("builds path without groupId", () => {
    expect(buildGroupPath(null, "cf")).toBe("/cf");
    expect(buildGroupPath(undefined, "cf")).toBe("/cf");
    expect(buildGroupPath(null, "")).toBe("/");
  });

  it("builds path with groupId", () => {
    expect(buildGroupPath("abc123", "cf")).toBe("/abc123/cf");
    expect(buildGroupPath("abc123", "bs")).toBe("/abc123/bs");
    expect(buildGroupPath("abc123", "")).toBe("/abc123");
  });

  it("handles complex groupIds", () => {
    expect(buildGroupPath("XyZ123AbC-test1234567", "cf")).toBe("/XyZ123AbC-test1234567/cf");
  });
});

describe("isNavItemActive", () => {
  describe("without groupId", () => {
    it("matches dashboard at root", () => {
      expect(isNavItemActive("/", "", null)).toBe(true);
      expect(isNavItemActive("/cf", "", null)).toBe(false);
    });

    it("matches cf pages", () => {
      expect(isNavItemActive("/cf", "cf", null)).toBe(true);
      expect(isNavItemActive("/cf/", "cf", null)).toBe(true);
      expect(isNavItemActive("/cf/2024-01", "cf", null)).toBe(true);
      expect(isNavItemActive("/", "cf", null)).toBe(false);
    });

    it("matches bs pages", () => {
      expect(isNavItemActive("/bs", "bs", null)).toBe(true);
      expect(isNavItemActive("/cf", "bs", null)).toBe(false);
    });

    it("matches accounts pages", () => {
      expect(isNavItemActive("/accounts", "accounts", null)).toBe(true);
      expect(isNavItemActive("/accounts/xyz", "accounts", null)).toBe(true);
    });
  });

  describe("with groupId", () => {
    const groupId = "abc123";

    it("matches dashboard at group root", () => {
      expect(isNavItemActive("/abc123", "", groupId)).toBe(true);
      expect(isNavItemActive("/abc123/", "", groupId)).toBe(true);
      expect(isNavItemActive("/abc123/cf", "", groupId)).toBe(false);
    });

    it("matches cf pages", () => {
      expect(isNavItemActive("/abc123/cf", "cf", groupId)).toBe(true);
      expect(isNavItemActive("/abc123/cf/", "cf", groupId)).toBe(true);
      expect(isNavItemActive("/abc123/cf/2024-01", "cf", groupId)).toBe(true);
      expect(isNavItemActive("/abc123", "cf", groupId)).toBe(false);
    });

    it("matches bs pages", () => {
      expect(isNavItemActive("/abc123/bs", "bs", groupId)).toBe(true);
      expect(isNavItemActive("/abc123/cf", "bs", groupId)).toBe(false);
    });

    it("matches accounts pages", () => {
      expect(isNavItemActive("/abc123/accounts", "accounts", groupId)).toBe(true);
      expect(isNavItemActive("/abc123/accounts/xyz", "accounts", groupId)).toBe(true);
    });
  });
});
