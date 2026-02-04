import { eq } from "drizzle-orm";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { schema } from "../index";
import {
  createTestDb,
  resetTestDb,
  closeTestDb,
  TEST_GROUP_ID,
  createTestGroup,
} from "../test-helpers";
import {
  getLatestSnapshot,
  getHoldingsWithLatestValues,
  getHoldingsByAccountId,
  getHoldingsWithDailyChange,
  hasInvestmentHoldings,
  buildHoldingWhereCondition,
} from "./holding";

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
  createTestGroup(db);
});

function createTestAccount(name: string): number {
  const now = new Date().toISOString();
  const account = db
    .insert(schema.accounts)
    .values({
      mfId: `mf_${name}`,
      name,
      type: "bank",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  db.insert(schema.groupAccounts)
    .values({
      groupId: TEST_GROUP_ID,
      accountId: account.id,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return account.id;
}

function createSnapshot(): number {
  const now = new Date().toISOString();
  const snapshot = db
    .insert(schema.dailySnapshots)
    .values({
      groupId: TEST_GROUP_ID,
      date: "2025-04-15",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return snapshot.id;
}

function createAssetCategory(name: string): number {
  const now = new Date().toISOString();
  const category = db
    .insert(schema.assetCategories)
    .values({
      name,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return category.id;
}

function createHolding(data: {
  accountId: number;
  name: string;
  type?: "asset" | "liability";
  categoryId?: number | null;
  liabilityCategory?: string | null;
  code?: string | null;
}): number {
  const now = new Date().toISOString();
  const holding = db
    .insert(schema.holdings)
    .values({
      accountId: data.accountId,
      name: data.name,
      type: data.type ?? "asset",
      categoryId: data.categoryId ?? null,
      liabilityCategory: data.liabilityCategory ?? null,
      code: data.code ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return holding.id;
}

function createHoldingValue(data: {
  holdingId: number;
  snapshotId: number;
  amount?: number;
  quantity?: number | null;
  unitPrice?: number | null;
  avgCostPrice?: number | null;
  dailyChange?: number | null;
  unrealizedGain?: number | null;
  unrealizedGainPct?: number | null;
}) {
  const now = new Date().toISOString();
  db.insert(schema.holdingValues)
    .values({
      holdingId: data.holdingId,
      snapshotId: data.snapshotId,
      amount: data.amount ?? 100000,
      quantity: data.quantity ?? null,
      unitPrice: data.unitPrice ?? null,
      avgCostPrice: data.avgCostPrice ?? null,
      dailyChange: data.dailyChange ?? null,
      unrealizedGain: data.unrealizedGain ?? null,
      unrealizedGainPct: data.unrealizedGainPct ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

// ============================================================
// 内部関数のユニットテスト
// ============================================================

describe("buildHoldingWhereCondition", () => {
  it("snapshotIdのみで条件を構築する", () => {
    const condition = buildHoldingWhereCondition(1, []);
    expect(condition).toBeDefined();
  });

  it("accountIdsがある場合はinArray条件を追加する", () => {
    const condition = buildHoldingWhereCondition(1, [1, 2, 3]);
    expect(condition).toBeDefined();
  });

  it("追加条件がある場合はそれも含める", () => {
    const additionalCondition = eq(schema.holdingValues.amount, 100);
    const condition = buildHoldingWhereCondition(1, [], additionalCondition);
    expect(condition).toBeDefined();
  });

  it("accountIdsと追加条件の両方がある場合", () => {
    const additionalCondition = eq(schema.holdingValues.amount, 100);
    const condition = buildHoldingWhereCondition(1, [1, 2], additionalCondition);
    expect(condition).toBeDefined();
  });
});

// ============================================================
// 公開関数のテスト
// ============================================================

describe("getLatestSnapshot", () => {
  it("最新のスナップショットを返す", () => {
    createSnapshot();

    const result = getLatestSnapshot(db);

    expect(result).not.toBeNull();
    expect(result!.date).toBe("2025-04-15");
  });

  it("複数のスナップショットがある場合は最新を返す", () => {
    const now = new Date().toISOString();
    db.insert(schema.dailySnapshots)
      .values({
        groupId: TEST_GROUP_ID,
        date: "2025-04-14",
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.dailySnapshots)
      .values({
        groupId: TEST_GROUP_ID,
        date: "2025-04-15",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getLatestSnapshot(db);

    expect(result!.date).toBe("2025-04-15");
  });

  it("スナップショットがない場合はundefinedを返す", () => {
    const result = getLatestSnapshot(db);
    expect(result).toBeUndefined();
  });
});

describe("getHoldingsWithLatestValues", () => {
  it("最新スナップショットの保有資産を返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();
    const categoryId = createAssetCategory("株式(現物)");
    const holdingId = createHolding({
      accountId,
      name: "Stock A",
      categoryId,
    });
    createHoldingValue({
      holdingId,
      snapshotId,
      amount: 500000,
      dailyChange: 10000,
    });

    const result = getHoldingsWithLatestValues(undefined, db);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Stock A");
    expect(result[0].amount).toBe(500000);
    expect(result[0].categoryName).toBe("株式(現物)");
  });

  it("スナップショットがない場合は空配列を返す", () => {
    const result = getHoldingsWithLatestValues(undefined, db);
    expect(result).toEqual([]);
  });

  it("グループでフィルタリングされる", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();

    // グループ内のアカウント
    const holdingId1 = createHolding({ accountId, name: "Holding A" });
    createHoldingValue({ holdingId: holdingId1, snapshotId, amount: 100000 });

    // グループ外のアカウント
    const now = new Date().toISOString();
    const outsideAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "mf_outside",
        name: "Outside",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    const holdingId2 = createHolding({ accountId: outsideAccount.id, name: "Holding B" });
    createHoldingValue({ holdingId: holdingId2, snapshotId, amount: 200000 });

    const result = getHoldingsWithLatestValues(undefined, db);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Holding A");
  });
});

describe("getHoldingsByAccountId", () => {
  it("指定したアカウントの保有資産を返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();
    const holdingId = createHolding({ accountId, name: "Holding A" });
    createHoldingValue({ holdingId, snapshotId, amount: 100000 });

    const result = getHoldingsByAccountId(accountId, undefined, db);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Holding A");
  });

  it("グループ外のアカウントは空配列を返す", () => {
    const now = new Date().toISOString();
    createSnapshot();
    const outsideAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "mf_outside",
        name: "Outside",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const result = getHoldingsByAccountId(outsideAccount.id, undefined, db);

    expect(result).toEqual([]);
  });

  it("スナップショットがない場合は空配列を返す", () => {
    const accountId = createTestAccount("Bank A");
    const result = getHoldingsByAccountId(accountId, undefined, db);
    expect(result).toEqual([]);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getHoldingsByAccountId(1, undefined, db);
    expect(result).toEqual([]);
  });
});

describe("getHoldingsWithDailyChange", () => {
  it("日次変動がある保有資産を返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();

    const holdingId1 = createHolding({ accountId, name: "Stock A", code: "1234" });
    createHoldingValue({ holdingId: holdingId1, snapshotId, amount: 100000, dailyChange: 5000 });

    const holdingId2 = createHolding({ accountId, name: "Stock B", code: "5678" });
    createHoldingValue({ holdingId: holdingId2, snapshotId, amount: 200000, dailyChange: null });

    const result = getHoldingsWithDailyChange(undefined, db);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Stock A");
    expect(result[0].dailyChange).toBe(5000);
  });

  it("スナップショットがない場合は空配列を返す", () => {
    const result = getHoldingsWithDailyChange(undefined, db);
    expect(result).toEqual([]);
  });
});

describe("hasInvestmentHoldings", () => {
  it("投資銘柄がある場合はtrueを返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();
    const categoryId = createAssetCategory("株式(現物)");
    const holdingId = createHolding({ accountId, name: "Stock", categoryId });
    createHoldingValue({ holdingId, snapshotId });

    const result = hasInvestmentHoldings(undefined, db);

    expect(result).toBe(true);
  });

  it("投資信託がある場合もtrueを返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();
    const categoryId = createAssetCategory("投資信託");
    const holdingId = createHolding({ accountId, name: "Fund", categoryId });
    createHoldingValue({ holdingId, snapshotId });

    const result = hasInvestmentHoldings(undefined, db);

    expect(result).toBe(true);
  });

  it("投資銘柄がない場合はfalseを返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();
    const categoryId = createAssetCategory("預金");
    const holdingId = createHolding({ accountId, name: "Deposit", categoryId });
    createHoldingValue({ holdingId, snapshotId });

    const result = hasInvestmentHoldings(undefined, db);

    expect(result).toBe(false);
  });

  it("保有資産がない場合はfalseを返す", () => {
    createSnapshot();
    const result = hasInvestmentHoldings(undefined, db);
    expect(result).toBe(false);
  });

  it("スナップショットがない場合はfalseを返す", () => {
    const result = hasInvestmentHoldings(undefined, db);
    expect(result).toBe(false);
  });
});
