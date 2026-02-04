import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import { upsertGroup } from "./groups";
import { createSnapshot } from "./snapshots";

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

describe("createSnapshot", () => {
  test("スナップショットを作成して ID を返す", () => {
    upsertGroup(db, { id: "g1", name: "test", isCurrent: true });
    const id = createSnapshot(db, "g1", "2025-04-26");
    expect(id).toBeGreaterThan(0);
  });

  test("同じ日に複数スナップショットを作成できる", () => {
    upsertGroup(db, { id: "g1", name: "test", isCurrent: true });
    const id1 = createSnapshot(db, "g1", "2025-04-26");
    const id2 = createSnapshot(db, "g1", "2025-04-26");
    expect(id1).not.toBe(id2);
  });
});
