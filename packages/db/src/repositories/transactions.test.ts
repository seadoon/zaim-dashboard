import { describe, test, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { CashFlowItem } from "../types";
import * as schema from "../schema/schema";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import {
  saveTransaction,
  hasTransactionsForMonth,
  deleteTransactionsForMonth,
  saveTransactionsForMonth,
} from "./transactions";

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

describe("saveTransaction", () => {
  test("トランザクションを保存できる", () => {
    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    };
    saveTransaction(db, item);
    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(1000);
  });

  test("accountIdMapでaccount_idが設定される", () => {
    // まずアカウントを作成
    const accountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc1",
        name: "三井住友銀行 (テスト)",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    const accountIdMap = new Map<string, number>();
    accountIdMap.set("acc1", accountId);
    accountIdMap.set("三井住友銀行 (テスト)", accountId);

    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
      accountName: "三井住友銀行 (テスト)",
    };
    saveTransaction(db, item, accountIdMap);

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe(accountId);
  });

  test("accountIdMapで部分一致でaccount_idが設定される", () => {
    // まずアカウントを作成
    const accountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc1",
        name: "三井住友銀行 (テスト)",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    const accountIdMap = new Map<string, number>();
    accountIdMap.set("acc1", accountId);
    accountIdMap.set("三井住友銀行 (テスト)", accountId);

    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
      accountName: "三井住友銀行", // 部分一致
    };
    saveTransaction(db, item, accountIdMap);

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe(accountId);
  });

  test("振替トランザクションでtransferTargetAccountIdが設定される", () => {
    // 送金元アカウントを作成
    const sourceAccountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc1",
        name: "ゆうちょ銀行（貯蓄用）",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    // 送金先アカウントを作成
    const targetAccountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc2",
        name: "三井住友銀行 (テスト)",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    const accountIdMap = new Map<string, number>();
    accountIdMap.set("ゆうちょ銀行（貯蓄用）", sourceAccountId);
    accountIdMap.set("三井住友銀行 (テスト)", targetAccountId);

    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: null,
      subCategory: null,
      description: "振替",
      amount: 100000,
      type: "transfer",
      isTransfer: true,
      isExcludedFromCalculation: true,
      accountName: "三井住友銀行 (テスト)", // トランザクションの所有者
      transferTarget: "ゆうちょ銀行（貯蓄用）", // 振替相手先
    };
    saveTransaction(db, item, accountIdMap);

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe(targetAccountId);
    expect(result[0].transferTargetAccountId).toBe(sourceAccountId);
  });

  test("振替トランザクションでtransferTargetが部分一致でも解決される", () => {
    // 送金元アカウントを作成（フルネーム）
    const sourceAccountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc1",
        name: "ゆうちょ銀行（貯蓄用）",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    // 送金先アカウントを作成
    const targetAccountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc2",
        name: "三井住友銀行",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    const accountIdMap = new Map<string, number>();
    accountIdMap.set("ゆうちょ銀行（貯蓄用）", sourceAccountId);
    accountIdMap.set("三井住友銀行", targetAccountId);

    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: null,
      subCategory: null,
      description: "振替",
      amount: 100000,
      type: "transfer",
      isTransfer: true,
      isExcludedFromCalculation: true,
      accountName: "三井住友銀行",
      transferTarget: "ゆうちょ銀行", // 部分一致
    };
    saveTransaction(db, item, accountIdMap);

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].transferTargetAccountId).toBe(sourceAccountId);
  });

  test("振替トランザクションでtransferTargetがマッチしない場合はnull", () => {
    const accountId = db
      .insert(schema.accounts)
      .values({
        mfId: "acc1",
        name: "三井住友銀行",
        type: "自動連携",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning()
      .get().id;

    const accountIdMap = new Map<string, number>();
    accountIdMap.set("三井住友銀行", accountId);

    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: null,
      subCategory: null,
      description: "振替",
      amount: 100000,
      type: "transfer",
      isTransfer: true,
      isExcludedFromCalculation: true,
      accountName: "三井住友銀行",
      transferTarget: "存在しない銀行",
    };
    saveTransaction(db, item, accountIdMap);

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBe(accountId);
    expect(result[0].transferTargetAccountId).toBeNull();
  });

  test("accountIdMapがない場合はaccount_idがnull", () => {
    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
      accountName: "三井住友銀行",
    };
    saveTransaction(db, item);

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].accountId).toBeNull();
  });

  test("unknown mfId はスキップされる", () => {
    const item: CashFlowItem = {
      mfId: "unknown-1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    };
    saveTransaction(db, item);
    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(0);
  });

  test("同じ mfId で upsert される", () => {
    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    };
    saveTransaction(db, item);
    saveTransaction(db, { ...item, amount: 2000 });
    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(2000);
  });

  test("同じ mfId でカテゴリや詳細が変更されたら反映される", () => {
    const item: CashFlowItem = {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: "食料品",
      description: "スーパー",
      amount: 3000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    };
    saveTransaction(db, item);

    saveTransaction(db, {
      ...item,
      category: "日用品",
      subCategory: "ドラッグストア",
      description: "薬局",
      amount: 5000,
      type: "expense",
      isExcludedFromCalculation: true,
    });

    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("日用品");
    expect(result[0].subCategory).toBe("ドラッグストア");
    expect(result[0].description).toBe("薬局");
    expect(result[0].amount).toBe(5000);
    expect(result[0].isExcludedFromCalculation).toBe(true);
  });
});

describe("hasTransactionsForMonth / deleteTransactionsForMonth", () => {
  test("月にデータがなければ false", () => {
    expect(hasTransactionsForMonth(db, "2025-04")).toBe(false);
  });

  test("月にデータがあれば true", () => {
    saveTransaction(db, {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    });
    expect(hasTransactionsForMonth(db, "2025-04")).toBe(true);
  });

  test("月のデータを削除できる", () => {
    saveTransaction(db, {
      mfId: "tx1",
      date: "2025-04-15",
      category: "食費",
      subCategory: null,
      description: "テスト",
      amount: 1000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    });
    const count = deleteTransactionsForMonth(db, "2025-04");
    expect(count).toBe(1);
    expect(hasTransactionsForMonth(db, "2025-04")).toBe(false);
  });
});

describe("saveTransactionsForMonth", () => {
  const items: CashFlowItem[] = [
    {
      mfId: "tx1",
      date: "2025-04-10",
      category: "食費",
      subCategory: null,
      description: "スーパー",
      amount: 3000,
      type: "expense",
      isTransfer: false,
      isExcludedFromCalculation: false,
    },
    {
      mfId: "tx2",
      date: "2025-04-15",
      category: "給与",
      subCategory: null,
      description: "給料",
      amount: 300000,
      type: "income",
      isTransfer: false,
      isExcludedFromCalculation: false,
    },
  ];

  test("月のトランザクションを一括保存できる", () => {
    const savedCount = saveTransactionsForMonth(db, "2025-04", items);
    expect(savedCount).toBe(2);
  });

  test("既存データは削除して上書きされる", () => {
    saveTransactionsForMonth(db, "2025-04", items);

    // 異なるデータで上書き
    const newItems: CashFlowItem[] = [
      {
        mfId: "tx3",
        date: "2025-04-20",
        category: "交通費",
        subCategory: null,
        description: "電車代",
        amount: 500,
        type: "expense",
        isTransfer: false,
        isExcludedFromCalculation: false,
      },
    ];
    const savedCount = saveTransactionsForMonth(db, "2025-04", newItems);

    expect(savedCount).toBe(1);
    const result = db.select().from(schema.transactions).all();
    expect(result).toHaveLength(1);
    expect(result[0].mfId).toBe("tx3");
  });
});
