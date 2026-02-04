import { eq } from "drizzle-orm";
import { describe, test, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from "vitest";
import type { Group } from "../types";
import * as schema from "../schema/schema";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import { upsertAccount } from "./accounts";
import {
  upsertGroup,
  updateGroupLastScrapedAt,
  getCurrentGroupId,
  linkAccountToGroup,
  clearGroupAccountLinks,
} from "./groups";

type Db = ReturnType<typeof createTestDb>;

let db: Db;

beforeAll(() => {
  db = createTestDb();
});

afterAll(() => {
  closeTestDb(db);
});

beforeEach(() => {
  resetTestDb(db);
});

describe("upsertGroup", () => {
  const group: Group = { id: "g1", name: "テストグループ", isCurrent: true };

  test("新規グループを作成できる", () => {
    upsertGroup(db, group);
    const result = db.select().from(schema.groups).all();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("テストグループ");
    expect(result[0].isCurrent).toBe(true);
  });

  test("既存グループを更新できる", () => {
    upsertGroup(db, group);
    upsertGroup(db, { ...group, name: "更新後" });
    const result = db.select().from(schema.groups).all();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("更新後");
  });

  test("新しいグループをupsertすると古いグループのisCurrentがfalseになる", () => {
    upsertGroup(db, group);
    upsertGroup(db, { id: "g2", name: "別のグループ", isCurrent: true });
    const g1 = db.select().from(schema.groups).where(eq(schema.groups.id, "g1")).get();
    expect(g1?.isCurrent).toBe(false);
  });

  test("isCurrent=falseのグループをupsertしても他のグループのisCurrentは変わらない", () => {
    upsertGroup(db, { id: "g1", name: "グループ1", isCurrent: true });
    upsertGroup(db, { id: "g2", name: "グループ2", isCurrent: false });

    const g1 = db.select().from(schema.groups).where(eq(schema.groups.id, "g1")).get();
    const g2 = db.select().from(schema.groups).where(eq(schema.groups.id, "g2")).get();

    expect(g1?.isCurrent).toBe(true);
    expect(g2?.isCurrent).toBe(false);
  });

  test("複数のisCurrent=falseグループをupsertしても最初のisCurrent=trueグループは維持される", () => {
    upsertGroup(db, { id: "g1", name: "デフォルト", isCurrent: true });
    upsertGroup(db, { id: "g2", name: "グループ2", isCurrent: false });
    upsertGroup(db, { id: "g3", name: "グループ3", isCurrent: false });
    upsertGroup(db, { id: "g4", name: "グループ4", isCurrent: false });

    const groups = db.select().from(schema.groups).all();
    const currentGroups = groups.filter((g) => g.isCurrent);

    expect(currentGroups).toHaveLength(1);
    expect(currentGroups[0].id).toBe("g1");
  });
});

describe("updateGroupLastScrapedAt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-29T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("lastScrapedAt を更新できる", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    const timestamp = "2025-04-29T14:00:00.000Z";

    updateGroupLastScrapedAt(db, "g1", timestamp);

    const result = db.select().from(schema.groups).where(eq(schema.groups.id, "g1")).get();
    expect(result?.lastScrapedAt).toBe(timestamp);
  });

  test("updatedAt も更新される", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    const before = db.select().from(schema.groups).where(eq(schema.groups.id, "g1")).get();

    // 時間を1秒進める
    vi.advanceTimersByTime(1000);

    updateGroupLastScrapedAt(db, "g1", "2025-04-29T14:00:00.000Z");

    const after = db.select().from(schema.groups).where(eq(schema.groups.id, "g1")).get();
    expect(after?.updatedAt).not.toBe(before?.updatedAt);
    expect(after?.updatedAt).toBe("2025-04-29T12:00:01.000Z");
  });
});

describe("getCurrentGroupId", () => {
  test("現在のグループIDを取得できる", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });

    const result = getCurrentGroupId(db);

    expect(result).toBe("g1");
  });

  test("現在のグループがない場合はnullを返す", () => {
    // グループを作成してからisCurrent=falseに更新
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    db.update(schema.groups).set({ isCurrent: false }).run();

    const result = getCurrentGroupId(db);

    expect(result).toBeNull();
  });

  test("グループが存在しない場合はnullを返す", () => {
    const result = getCurrentGroupId(db);

    expect(result).toBeNull();
  });

  test("複数のグループがある場合、isCurrentがtrueのグループIDを返す", () => {
    upsertGroup(db, { id: "g1", name: "グループ1", isCurrent: true });
    upsertGroup(db, { id: "g2", name: "グループ2", isCurrent: true });

    const result = getCurrentGroupId(db);

    expect(result).toBe("g2");
  });
});

// Helper to create test account
function createTestAccount(mfId: string, name: string): number {
  return upsertAccount(db, {
    mfId,
    name,
    type: "bank",
    status: "ok",
    lastUpdated: "2025-04-01",
    url: `/accounts/show/${mfId}`,
    totalAssets: 100000,
  });
}

describe("clearGroupAccountLinks", () => {
  test("指定グループのリンクをすべて削除できる", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    const account1 = createTestAccount("mf1", "銀行1");
    const account2 = createTestAccount("mf2", "銀行2");

    linkAccountToGroup(db, "g1", account1);
    linkAccountToGroup(db, "g1", account2);

    expect(db.select().from(schema.groupAccounts).all()).toHaveLength(2);

    clearGroupAccountLinks(db, "g1");

    expect(db.select().from(schema.groupAccounts).all()).toHaveLength(0);
  });

  test("他のグループのリンクには影響しない", () => {
    upsertGroup(db, { id: "g1", name: "グループ1", isCurrent: true });
    upsertGroup(db, { id: "g2", name: "グループ2", isCurrent: false });
    const account1 = createTestAccount("mf1", "銀行1");
    const account2 = createTestAccount("mf2", "銀行2");

    linkAccountToGroup(db, "g1", account1);
    linkAccountToGroup(db, "g2", account2);

    clearGroupAccountLinks(db, "g1");

    const remaining = db.select().from(schema.groupAccounts).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].groupId).toBe("g2");
  });

  test("存在しないグループIDでもエラーにならない", () => {
    expect(() => clearGroupAccountLinks(db, "nonexistent")).not.toThrow();
  });

  test("リンクがない状態でもエラーにならない", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    expect(() => clearGroupAccountLinks(db, "g1")).not.toThrow();
  });
});

describe("linkAccountToGroup", () => {
  test("アカウントをグループに紐付けできる", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    const accountId = createTestAccount("mf1", "テスト銀行");

    linkAccountToGroup(db, "g1", accountId);

    const result = db.select().from(schema.groupAccounts).all();
    expect(result).toHaveLength(1);
    expect(result[0].groupId).toBe("g1");
    expect(result[0].accountId).toBe(accountId);
  });

  test("同じアカウントを同じグループに複数回紐付けしても重複しない", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    const accountId = createTestAccount("mf1", "テスト銀行");

    linkAccountToGroup(db, "g1", accountId);
    linkAccountToGroup(db, "g1", accountId);
    linkAccountToGroup(db, "g1", accountId);

    const result = db.select().from(schema.groupAccounts).all();
    expect(result).toHaveLength(1);
  });

  test("同じアカウントを異なるグループに紐付けできる", () => {
    upsertGroup(db, { id: "g1", name: "グループ1", isCurrent: true });
    upsertGroup(db, { id: "g2", name: "グループ2", isCurrent: true });
    const accountId = createTestAccount("mf1", "共有銀行");

    linkAccountToGroup(db, "g1", accountId);
    linkAccountToGroup(db, "g2", accountId);

    const result = db.select().from(schema.groupAccounts).all();
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.groupId).sort()).toEqual(["g1", "g2"]);
  });

  test("異なるアカウントを同じグループに紐付けできる", () => {
    upsertGroup(db, { id: "g1", name: "テストグループ", isCurrent: true });
    const account1 = createTestAccount("mf1", "銀行1");
    const account2 = createTestAccount("mf2", "銀行2");

    linkAccountToGroup(db, "g1", account1);
    linkAccountToGroup(db, "g1", account2);

    const result = db.select().from(schema.groupAccounts).all();
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.accountId).sort((a, b) => a - b)).toEqual(
      [account1, account2].sort((a, b) => a - b),
    );
  });
});
