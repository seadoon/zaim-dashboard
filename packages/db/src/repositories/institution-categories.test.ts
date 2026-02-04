import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import {
  getOrCreateInstitutionCategory,
  getAllInstitutionCategories,
} from "./institution-categories";

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

describe("getOrCreateInstitutionCategory", () => {
  test("新規カテゴリーを作成してIDを返す", () => {
    const id = getOrCreateInstitutionCategory(db, "銀行");
    expect(id).toBeGreaterThan(0);
  });

  test("既存カテゴリーのIDを返す", () => {
    const id1 = getOrCreateInstitutionCategory(db, "銀行");
    const id2 = getOrCreateInstitutionCategory(db, "銀行");
    expect(id1).toBe(id2);
  });

  test("異なるカテゴリーには異なるIDを返す", () => {
    const id1 = getOrCreateInstitutionCategory(db, "銀行");
    const id2 = getOrCreateInstitutionCategory(db, "証券");
    expect(id1).not.toBe(id2);
  });

  test("複数のカテゴリーを作成できる", () => {
    const categories = ["銀行", "証券", "カード", "電子マネー", "ポイント"];
    const ids = categories.map((cat) => getOrCreateInstitutionCategory(db, cat));

    // すべて異なるIDが返される
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(categories.length);
  });
});

describe("getAllInstitutionCategories", () => {
  test("すべてのカテゴリーを取得する", () => {
    // カテゴリーを作成
    getOrCreateInstitutionCategory(db, "銀行");
    getOrCreateInstitutionCategory(db, "証券");
    getOrCreateInstitutionCategory(db, "カード");

    const categories = getAllInstitutionCategories(db);

    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.name)).toEqual(
      expect.arrayContaining(["銀行", "証券", "カード"]),
    );
  });

  test("空のデータベースでは空の配列を返す", () => {
    const categories = getAllInstitutionCategories(db);
    expect(categories).toHaveLength(0);
  });

  test("取得したカテゴリーにはcreatedAtとupdatedAtが含まれる", () => {
    getOrCreateInstitutionCategory(db, "銀行");

    const categories = getAllInstitutionCategories(db);

    expect(categories).toHaveLength(1);
    expect(categories[0]).toHaveProperty("createdAt");
    expect(categories[0]).toHaveProperty("updatedAt");
    expect(categories[0].createdAt).toBeTruthy();
    expect(categories[0].updatedAt).toBeTruthy();
  });
});
