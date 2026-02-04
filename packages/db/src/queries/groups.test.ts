import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { schema } from "../index";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import { getCurrentGroup, getAllGroups } from "./groups";

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

describe("getCurrentGroup", () => {
  it("isCurrent=trueのグループを返す", () => {
    const now = new Date().toISOString();
    db.insert(schema.groups)
      .values({
        id: "group_001",
        name: "Current Group",
        isCurrent: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getCurrentGroup(db);

    expect(result?.id).toBe("group_001");
    expect(result?.name).toBe("Current Group");
  });

  it("該当がない場合はundefinedを返す", () => {
    expect(getCurrentGroup(db)).toBeUndefined();
  });
});

describe("getAllGroups", () => {
  it("isCurrent=trueを最初に、lastScrapedAt降順でソート", () => {
    const now = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    db.insert(schema.groups)
      .values([
        {
          id: "g1",
          name: "Group 1",
          isCurrent: false,
          lastScrapedAt: yesterday,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "g2",
          name: "Group 2",
          isCurrent: true,
          lastScrapedAt: yesterday,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "g3",
          name: "Group 3",
          isCurrent: false,
          lastScrapedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      ])
      .run();

    const result = getAllGroups(db);

    expect(result[0].id).toBe("g2"); // isCurrent=true が最初
    expect(result[1].id).toBe("g3"); // 次に lastScrapedAt が新しい順
    expect(result[2].id).toBe("g1");
  });
});
