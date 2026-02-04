import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { schema } from "../index";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import { getDefaultGroupId, resolveGroupId, getAccountIdsForGroup } from "./group-filter";

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

describe("getDefaultGroupId", () => {
  it("isCurrent=trueのグループIDを返す", () => {
    const now = new Date().toISOString();
    db.insert(schema.groups)
      .values({
        id: "group_001",
        name: "Test Group",
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(getDefaultGroupId(db)).toBe("group_001");
  });

  it("グループがない場合はnullを返す", () => {
    expect(getDefaultGroupId(db)).toBeNull();
  });
});

describe("resolveGroupId", () => {
  it("groupIdが指定されていればそのまま返す", () => {
    expect(resolveGroupId(db, "explicit_group")).toBe("explicit_group");
  });

  it("groupIdが未指定の場合はデフォルトを返す", () => {
    const now = new Date().toISOString();
    db.insert(schema.groups)
      .values({
        id: "default_group",
        name: "Default",
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    expect(resolveGroupId(db)).toBe("default_group");
  });
});

describe("getAccountIdsForGroup", () => {
  it("グループに属するアカウントIDリストを返す", () => {
    const now = new Date().toISOString();
    db.insert(schema.groups)
      .values({
        id: "group_001",
        name: "Test",
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const acc1 = db
      .insert(schema.accounts)
      .values({
        mfId: "acc1",
        name: "Account 1",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const acc2 = db
      .insert(schema.accounts)
      .values({
        mfId: "acc2",
        name: "Account 2",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    db.insert(schema.groupAccounts)
      .values([
        { groupId: "group_001", accountId: acc1.id, createdAt: now, updatedAt: now },
        { groupId: "group_001", accountId: acc2.id, createdAt: now, updatedAt: now },
      ])
      .run();

    const result = getAccountIdsForGroup(db, "group_001");
    expect(result).toEqual([acc1.id, acc2.id]);
  });

  it("グループにアカウントがない場合は空配列を返す", () => {
    expect(getAccountIdsForGroup(db, "nonexistent")).toEqual([]);
  });
});
