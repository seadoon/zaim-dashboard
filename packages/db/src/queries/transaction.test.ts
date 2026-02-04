import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { schema } from "../index";
import { createTestDb, resetTestDb, closeTestDb } from "../test-helpers";
import { getTransactions, getTransactionsByMonth, getTransactionsByAccountId } from "./transaction";

type Db = ReturnType<typeof createTestDb>;
let db: Db;

const TEST_GROUP_ID = "test_group_001";

beforeAll(() => {
  db = createTestDb();
});

afterAll(() => {
  closeTestDb(db);
});

beforeEach(() => {
  resetTestDb(db);
  // Setup test group
  const now = new Date().toISOString();
  db.insert(schema.groups)
    .values({
      id: TEST_GROUP_ID,
      name: "Test Group",
      isCurrent: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();
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

function createTransaction(data: {
  accountId: number;
  date: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category?: string;
  transferTargetAccountId?: number;
}) {
  const now = new Date().toISOString();
  db.insert(schema.transactions)
    .values({
      mfId: `tx_${Date.now()}_${Math.random()}`,
      date: data.date,
      accountId: data.accountId,
      category: data.category ?? null,
      subCategory: null,
      description: "Test transaction",
      amount: data.amount,
      type: data.type,
      isTransfer: data.type === "transfer",
      isExcludedFromCalculation: data.type === "transfer",
      transferTargetAccountId: data.transferTargetAccountId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

describe("getTransactions", () => {
  it("トランザクション一覧を返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 3000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-04-14",
      amount: 500000,
      type: "income",
      category: "給与",
    });

    const result = getTransactions(undefined, db);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe("2025-04-15");
    expect(result[1].date).toBe("2025-04-14");
  });

  it("limitを指定した場合は件数が制限される", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({ accountId, date: "2025-04-15", amount: 1000, type: "expense" });
    createTransaction({ accountId, date: "2025-04-14", amount: 2000, type: "expense" });

    const result = getTransactions({ limit: 1 }, db);

    expect(result).toHaveLength(1);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    expect(getTransactions(undefined, db)).toEqual([]);
  });
});

describe("getTransactionsByMonth", () => {
  it("指定月のトランザクションを返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 3000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-05-01",
      amount: 5000,
      type: "expense",
      category: "交通費",
    });

    const result = getTransactionsByMonth("2025-04", undefined, db);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2025-04-15");
  });

  it("該当月にデータがない場合は空配列を返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({ accountId, date: "2025-04-15", amount: 3000, type: "expense" });

    expect(getTransactionsByMonth("2099-01", undefined, db)).toEqual([]);
  });

  describe("振替トランザクションの収入変換", () => {
    it("グループ外アカウントからの振替は収入として扱われる", () => {
      const accountId = createTestAccount("Bank A");
      const now = new Date().toISOString();
      const externalAccount = db
        .insert(schema.accounts)
        .values({
          mfId: "external",
          name: "External Account",
          type: "bank",
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();

      createTransaction({
        accountId,
        date: "2025-04-15",
        amount: 100000,
        type: "transfer",
        transferTargetAccountId: externalAccount.id,
      });

      const result = getTransactionsByMonth("2025-04", undefined, db);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("income");
      expect(result[0].category).toBe("収入");
      expect(result[0].subCategory).toBe("振替入金");
    });

    it("グループ内アカウント間の振替はそのまま振替として返される", () => {
      const accountId1 = createTestAccount("Bank A");
      const accountId2 = createTestAccount("Bank B");

      createTransaction({
        accountId: accountId1,
        date: "2025-04-15",
        amount: 50000,
        type: "transfer",
        transferTargetAccountId: accountId2,
      });

      const result = getTransactionsByMonth("2025-04", undefined, db);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("transfer");
    });
  });
});

describe("getTransactionsByAccountId", () => {
  it("現在のグループに所属するアカウントのトランザクションを取得できる", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({ accountId, date: "2025-04-15", amount: 3000, type: "expense" });

    const result = getTransactionsByAccountId(accountId, undefined, db);

    expect(result).toHaveLength(1);
  });

  it("他のグループのアカウントは空配列を返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({ accountId, date: "2025-04-15", amount: 3000, type: "expense" });

    expect(getTransactionsByAccountId(9999, undefined, db)).toEqual([]);
  });
});
