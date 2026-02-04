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
  parseDateString,
  toDateString,
  calculateTargetDate,
  getAssetBreakdownByCategory,
  getLiabilityBreakdownByCategory,
  getAssetHistory,
  getAssetHistoryWithCategories,
  getLatestTotalAssets,
  getDailyAssetChange,
  getCategoryChangesForPeriod,
  aggregateLiabilitiesByCategory,
  calculateCategoryChanges,
} from "./asset";

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

function createAssetHistory(data: { date: string; totalAssets: number }): number {
  const now = new Date().toISOString();
  const history = db
    .insert(schema.assetHistory)
    .values({
      groupId: TEST_GROUP_ID,
      date: data.date,
      totalAssets: data.totalAssets,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return history.id;
}

function createAssetHistoryCategory(data: {
  assetHistoryId: number;
  categoryName: string;
  amount: number;
}) {
  const now = new Date().toISOString();
  db.insert(schema.assetHistoryCategories)
    .values({
      assetHistoryId: data.assetHistoryId,
      categoryName: data.categoryName,
      amount: data.amount,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

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

function createHolding(data: {
  accountId: number;
  name: string;
  type?: "asset" | "liability";
  liabilityCategory?: string | null;
}): number {
  const now = new Date().toISOString();
  const holding = db
    .insert(schema.holdings)
    .values({
      accountId: data.accountId,
      name: data.name,
      type: data.type ?? "asset",
      liabilityCategory: data.liabilityCategory ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return holding.id;
}

function createHoldingValue(data: { holdingId: number; snapshotId: number; amount: number }) {
  const now = new Date().toISOString();
  db.insert(schema.holdingValues)
    .values({
      holdingId: data.holdingId,
      snapshotId: data.snapshotId,
      amount: data.amount,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

// ============================================================
// 内部関数のユニットテスト
// ============================================================

describe("parseDateString", () => {
  it("日付文字列をパースする", () => {
    const result = parseDateString("2025-04-15");
    expect(result).toEqual({ year: 2025, month: 4, day: 15 });
  });

  it("月と日が2桁の場合", () => {
    const result = parseDateString("2025-12-31");
    expect(result).toEqual({ year: 2025, month: 12, day: 31 });
  });
});

describe("toDateString", () => {
  it("日付文字列を生成する", () => {
    const result = toDateString(2025, 4, 15);
    expect(result).toBe("2025-04-15");
  });

  it("月と日を0埋めする", () => {
    const result = toDateString(2025, 4, 5);
    expect(result).toBe("2025-04-05");
  });
});

describe("calculateTargetDate", () => {
  it("daily: 1日前の日付を返す", () => {
    const result = calculateTargetDate("2025-04-15", "daily");
    expect(result).toBe("2025-04-14");
  });

  it("weekly: 8日前の日付を返す", () => {
    const result = calculateTargetDate("2025-04-15", "weekly");
    expect(result).toBe("2025-04-07");
  });

  it("monthly: 前月末日を返す", () => {
    const result = calculateTargetDate("2025-04-15", "monthly");
    expect(result).toBe("2025-03-31");
  });

  it("monthly: 2月の場合は1月末日を返す", () => {
    const result = calculateTargetDate("2025-05-15", "monthly");
    expect(result).toBe("2025-04-30");
  });
});

describe("aggregateLiabilitiesByCategory", () => {
  it("負債をカテゴリ別に集計する", () => {
    const holdings = [
      { type: "liability", liabilityCategory: "住宅ローン", amount: 20000000 },
      { type: "liability", liabilityCategory: "住宅ローン", amount: 5000000 },
      { type: "liability", liabilityCategory: "カードローン", amount: 500000 },
    ];

    const result = aggregateLiabilitiesByCategory(holdings);

    expect(result).toEqual([
      { category: "住宅ローン", amount: 25000000 },
      { category: "カードローン", amount: 500000 },
    ]);
  });

  it("liabilityCategoryがnullの場合はその他にまとめる", () => {
    const holdings = [{ type: "liability", liabilityCategory: null, amount: 100000 }];

    const result = aggregateLiabilitiesByCategory(holdings);

    expect(result).toEqual([{ category: "その他", amount: 100000 }]);
  });

  it("資産は除外される", () => {
    const holdings = [
      { type: "asset", liabilityCategory: null, amount: 1000000 },
      { type: "liability", liabilityCategory: "ローン", amount: 500000 },
    ];

    const result = aggregateLiabilitiesByCategory(holdings);

    expect(result).toEqual([{ category: "ローン", amount: 500000 }]);
  });

  it("amountがnullの場合はスキップ", () => {
    const holdings = [{ type: "liability", liabilityCategory: "ローン", amount: null }];

    const result = aggregateLiabilitiesByCategory(holdings);

    expect(result).toEqual([]);
  });
});

describe("calculateCategoryChanges", () => {
  it("カテゴリ変動を計算する", () => {
    const latestCategories = [
      { categoryName: "預金", amount: 150000 },
      { categoryName: "株式", amount: 100000 },
    ];
    const previousCategories = [
      { categoryName: "預金", amount: 130000 },
      { categoryName: "株式", amount: 70000 },
    ];

    const result = calculateCategoryChanges(latestCategories, previousCategories);

    expect(result).toContainEqual({
      name: "預金",
      current: 150000,
      previous: 130000,
      change: 20000,
    });
    expect(result).toContainEqual({
      name: "株式",
      current: 100000,
      previous: 70000,
      change: 30000,
    });
  });

  it("新しいカテゴリが追加された場合はpreviousを0として計算", () => {
    const latestCategories = [{ categoryName: "新カテゴリ", amount: 100000 }];
    const previousCategories: Array<{ categoryName: string; amount: number }> = [];

    const result = calculateCategoryChanges(latestCategories, previousCategories);

    expect(result).toContainEqual({
      name: "新カテゴリ",
      current: 100000,
      previous: 0,
      change: 100000,
    });
  });

  it("消えたカテゴリはcurrentを0として計算", () => {
    const latestCategories: Array<{ categoryName: string; amount: number }> = [];
    const previousCategories = [{ categoryName: "旧カテゴリ", amount: 100000 }];

    const result = calculateCategoryChanges(latestCategories, previousCategories);

    expect(result).toContainEqual({
      name: "旧カテゴリ",
      current: 0,
      previous: 100000,
      change: -100000,
    });
  });
});

// ============================================================
// 公開関数のテスト
// ============================================================

describe("getAssetBreakdownByCategory", () => {
  it("カテゴリ別資産を金額降順で返す", () => {
    const historyId = createAssetHistory({ date: "2025-04-15", totalAssets: 1700000 });
    createAssetHistoryCategory({ assetHistoryId: historyId, categoryName: "預金", amount: 500000 });
    createAssetHistoryCategory({
      assetHistoryId: historyId,
      categoryName: "株式",
      amount: 1000000,
    });
    createAssetHistoryCategory({ assetHistoryId: historyId, categoryName: "債券", amount: 200000 });

    const result = getAssetBreakdownByCategory(undefined, db);

    expect(result).toEqual([
      { category: "株式", amount: 1000000 },
      { category: "預金", amount: 500000 },
      { category: "債券", amount: 200000 },
    ]);
  });

  it("金額が0以下のカテゴリを除外する", () => {
    const historyId = createAssetHistory({ date: "2025-04-15", totalAssets: 500000 });
    createAssetHistoryCategory({ assetHistoryId: historyId, categoryName: "預金", amount: 500000 });
    createAssetHistoryCategory({
      assetHistoryId: historyId,
      categoryName: "空カテゴリ",
      amount: 0,
    });

    const result = getAssetBreakdownByCategory(undefined, db);

    expect(result).toEqual([{ category: "預金", amount: 500000 }]);
  });

  it("履歴がない場合は空配列を返す", () => {
    const result = getAssetBreakdownByCategory(undefined, db);
    expect(result).toEqual([]);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getAssetBreakdownByCategory(undefined, db);
    expect(result).toEqual([]);
  });
});

describe("getLiabilityBreakdownByCategory", () => {
  it("負債をカテゴリ別に集計して降順で返す", () => {
    const accountId = createTestAccount("Bank A");
    const snapshotId = createSnapshot();

    const holdingId1 = createHolding({
      accountId,
      name: "Loan A",
      type: "liability",
      liabilityCategory: "住宅ローン",
    });
    createHoldingValue({ holdingId: holdingId1, snapshotId, amount: 20000000 });

    const holdingId2 = createHolding({
      accountId,
      name: "Loan B",
      type: "liability",
      liabilityCategory: "住宅ローン",
    });
    createHoldingValue({ holdingId: holdingId2, snapshotId, amount: 5000000 });

    const holdingId3 = createHolding({
      accountId,
      name: "Card",
      type: "liability",
      liabilityCategory: "カードローン",
    });
    createHoldingValue({ holdingId: holdingId3, snapshotId, amount: 500000 });

    const result = getLiabilityBreakdownByCategory(undefined, db);

    expect(result).toEqual([
      { category: "住宅ローン", amount: 25000000 },
      { category: "カードローン", amount: 500000 },
    ]);
  });

  it("負債がない場合は空配列を返す", () => {
    createSnapshot();
    const result = getLiabilityBreakdownByCategory(undefined, db);
    expect(result).toEqual([]);
  });
});

describe("getAssetHistory", () => {
  it("資産履歴を日付降順で返す", () => {
    createAssetHistory({ date: "2025-04-14", totalAssets: 100000 });
    createAssetHistory({ date: "2025-04-15", totalAssets: 200000 });

    const result = getAssetHistory(undefined, db);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2025-04-15");
    expect(result[1].date).toBe("2025-04-14");
  });

  it("limitを指定した場合は件数が制限される", () => {
    createAssetHistory({ date: "2025-04-14", totalAssets: 100000 });
    createAssetHistory({ date: "2025-04-15", totalAssets: 200000 });

    const result = getAssetHistory({ limit: 1 }, db);

    expect(result).toHaveLength(1);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getAssetHistory(undefined, db);
    expect(result).toEqual([]);
  });
});

describe("getAssetHistoryWithCategories", () => {
  it("履歴にカテゴリ情報を付与して返す", () => {
    const historyId1 = createAssetHistory({ date: "2025-04-15", totalAssets: 200000 });
    createAssetHistoryCategory({
      assetHistoryId: historyId1,
      categoryName: "預金",
      amount: 150000,
    });
    createAssetHistoryCategory({
      assetHistoryId: historyId1,
      categoryName: "株式",
      amount: 50000,
    });

    const historyId2 = createAssetHistory({ date: "2025-04-14", totalAssets: 100000 });
    createAssetHistoryCategory({
      assetHistoryId: historyId2,
      categoryName: "預金",
      amount: 100000,
    });

    const result = getAssetHistoryWithCategories(undefined, db);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      date: "2025-04-15",
      totalAssets: 200000,
      categories: { 預金: 150000, 株式: 50000 },
    });
    expect(result[1]).toEqual({
      date: "2025-04-14",
      totalAssets: 100000,
      categories: { 預金: 100000 },
    });
  });

  it("履歴が空の場合は空配列を返す", () => {
    const result = getAssetHistoryWithCategories(undefined, db);
    expect(result).toEqual([]);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getAssetHistoryWithCategories(undefined, db);
    expect(result).toEqual([]);
  });
});

describe("getLatestTotalAssets", () => {
  it("最新の総資産を返す", () => {
    createAssetHistory({ date: "2025-04-14", totalAssets: 100000 });
    createAssetHistory({ date: "2025-04-15", totalAssets: 200000 });

    const result = getLatestTotalAssets(undefined, db);

    expect(result).toBe(200000);
  });

  it("データがない場合はnullを返す", () => {
    const result = getLatestTotalAssets(undefined, db);
    expect(result).toBeNull();
  });

  it("グループがない場合はnullを返す", () => {
    resetTestDb(db);
    const result = getLatestTotalAssets(undefined, db);
    expect(result).toBeNull();
  });
});

describe("getDailyAssetChange", () => {
  it("前日比の変動を返す", () => {
    createAssetHistory({ date: "2025-04-14", totalAssets: 1000000 });
    createAssetHistory({ date: "2025-04-15", totalAssets: 1200000 });

    const result = getDailyAssetChange(undefined, db);

    expect(result).toEqual({
      today: 1200000,
      yesterday: 1000000,
      change: 200000,
    });
  });

  it("データが2件未満の場合はnullを返す", () => {
    createAssetHistory({ date: "2025-04-15", totalAssets: 100000 });

    const result = getDailyAssetChange(undefined, db);

    expect(result).toBeNull();
  });

  it("資産減少の場合は負の変動を返す", () => {
    createAssetHistory({ date: "2025-04-14", totalAssets: 1000000 });
    createAssetHistory({ date: "2025-04-15", totalAssets: 900000 });

    const result = getDailyAssetChange(undefined, db);

    expect(result).toEqual({
      today: 900000,
      yesterday: 1000000,
      change: -100000,
    });
  });

  it("グループがない場合はnullを返す", () => {
    resetTestDb(db);
    const result = getDailyAssetChange(undefined, db);
    expect(result).toBeNull();
  });
});

describe("getCategoryChangesForPeriod", () => {
  it("カテゴリ別の変動を計算して返す", () => {
    const historyId1 = createAssetHistory({ date: "2025-04-15", totalAssets: 250000 });
    createAssetHistoryCategory({
      assetHistoryId: historyId1,
      categoryName: "預金",
      amount: 150000,
    });
    createAssetHistoryCategory({
      assetHistoryId: historyId1,
      categoryName: "株式",
      amount: 100000,
    });

    const historyId2 = createAssetHistory({ date: "2025-04-14", totalAssets: 200000 });
    createAssetHistoryCategory({
      assetHistoryId: historyId2,
      categoryName: "預金",
      amount: 130000,
    });
    createAssetHistoryCategory({
      assetHistoryId: historyId2,
      categoryName: "株式",
      amount: 70000,
    });

    const result = getCategoryChangesForPeriod("daily", undefined, db);

    expect(result).not.toBeNull();
    expect(result!.total).toEqual({
      current: 250000,
      previous: 200000,
      change: 50000,
    });
    expect(result!.categories).toContainEqual({
      name: "預金",
      current: 150000,
      previous: 130000,
      change: 20000,
    });
  });

  it("最新データがない場合はnullを返す", () => {
    const result = getCategoryChangesForPeriod("daily", undefined, db);
    expect(result).toBeNull();
  });

  it("前期間データがない場合はnullを返す", () => {
    createAssetHistory({ date: "2025-04-15", totalAssets: 200000 });

    const result = getCategoryChangesForPeriod("daily", undefined, db);

    expect(result).toBeNull();
  });

  it("最新と前期間が同じ日付の場合はnullを返す", () => {
    createAssetHistory({ date: "2025-04-15", totalAssets: 200000 });

    // 同じ日付しかないので比較対象がない
    const result = getCategoryChangesForPeriod("daily", undefined, db);

    expect(result).toBeNull();
  });

  it("グループがない場合はnullを返す", () => {
    resetTestDb(db);
    const result = getCategoryChangesForPeriod("daily", undefined, db);
    expect(result).toBeNull();
  });
});
