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
  getMonthlySummaryByMonth,
  getMonthlyCategoryTotals,
  getYearToDateSummary,
  getExpenseByFixedVariable,
  getLatestMonthlySummary,
  getMonthlySummaries,
  getAvailableMonths,
  // 内部関数（ユニットテスト用）
  buildIncludedTransactionCondition,
  buildOutsideTransferCondition,
  buildGroupTransactionCondition,
  buildRegularIncomeSum,
  buildExpenseSum,
  getDeduplicatedTransferIncome,
  getDeduplicatedTransferExpense,
} from "./summary";

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

const GROUP_NONE_ID = "0";

function createExternalAccount(name: string): number {
  const now = new Date().toISOString();
  const account = db
    .insert(schema.accounts)
    .values({
      mfId: `mf_external_${name}`,
      name,
      type: "bank",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  // External accounts belong ONLY to "グループ選択なし" (GROUP_NONE_ID = "0")
  // This makes them external entities for getExternalEntityAccountIds
  db.insert(schema.groups)
    .values({
      id: GROUP_NONE_ID,
      name: "グループ選択なし",
      isCurrent: false,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .run();

  db.insert(schema.groupAccounts)
    .values({
      groupId: GROUP_NONE_ID,
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
  subCategory?: string;
  transferTargetAccountId?: number;
  isExcludedFromCalculation?: boolean;
}) {
  const now = new Date().toISOString();
  db.insert(schema.transactions)
    .values({
      mfId: `tx_${Date.now()}_${Math.random()}`,
      date: data.date,
      accountId: data.accountId,
      category: data.category ?? null,
      subCategory: data.subCategory ?? null,
      description: "Test transaction",
      amount: data.amount,
      type: data.type,
      isTransfer: data.type === "transfer",
      isExcludedFromCalculation: data.isExcludedFromCalculation ?? data.type === "transfer",
      transferTargetAccountId: data.transferTargetAccountId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

function createSpendingTarget(
  categoryName: string,
  type: "fixed" | "variable",
  largeCategoryId: number,
) {
  const now = new Date().toISOString();
  db.insert(schema.spendingTargets)
    .values({
      groupId: TEST_GROUP_ID,
      categoryName,
      type,
      largeCategoryId,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

describe("getMonthlySummaryByMonth", () => {
  it("指定月の収支サマリーを返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 50000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-04-25",
      amount: 30000,
      type: "expense",
      category: "交通費",
    });

    const result = getMonthlySummaryByMonth("2025-04", undefined, db);

    expect(result).toBeDefined();
    expect(result!.month).toBe("2025-04");
    expect(result!.groupId).toBe(TEST_GROUP_ID);
    expect(result!.totalIncome).toBe(500000);
    expect(result!.totalExpense).toBe(80000);
    expect(result!.netIncome).toBe(420000);
  });

  it("データがない月はundefinedを返す", () => {
    const result = getMonthlySummaryByMonth("2099-01", undefined, db);
    expect(result).toBeUndefined();
  });

  it("グループがない場合はundefinedを返す", () => {
    resetTestDb(db);
    const result = getMonthlySummaryByMonth("2025-04", undefined, db);
    expect(result).toBeUndefined();
  });

  it("グループ内からグループ外への振替は収入としてカウントされる（共通グループなし）", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // Transfer from internal to external (counted as income when no common group)
    // グループ内(accountId)→グループ外(externalAccountId)への振替
    const now = new Date().toISOString();
    db.insert(schema.transactions)
      .values({
        mfId: `mf-transfer-${Date.now()}`,
        accountId: accountId,
        date: "2025-04-15",
        amount: 100000,
        type: "transfer",
        description: "Group to External",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: externalAccountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getMonthlySummaryByMonth("2025-04", undefined, db);

    expect(result).toBeDefined();
    expect(result!.totalIncome).toBe(100000);
    expect(result!.totalExpense).toBe(0);
  });

  it("収入と支出が混在する月の計算が正しい", () => {
    const accountId = createTestAccount("Bank A");

    createTransaction({
      accountId,
      date: "2025-04-10",
      amount: 300000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "expense",
      category: "家賃",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 50000,
      type: "income",
      category: "副業",
    });
    createTransaction({
      accountId,
      date: "2025-04-25",
      amount: 20000,
      type: "expense",
      category: "食費",
    });

    const result = getMonthlySummaryByMonth("2025-04", undefined, db);

    expect(result!.totalIncome).toBe(350000);
    expect(result!.totalExpense).toBe(120000);
    expect(result!.netIncome).toBe(230000);
  });
});

describe("getMonthlyCategoryTotals", () => {
  it("カテゴリ別の集計を返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 30000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 20000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-04-25",
      amount: 10000,
      type: "expense",
      category: "交通費",
    });

    const result = getMonthlyCategoryTotals("2025-04", undefined, db);

    expect(result).toHaveLength(2);
    const foodCategory = result.find((r) => r.category === "食費");
    expect(foodCategory).toBeDefined();
    expect(foodCategory!.totalAmount).toBe(50000);
    expect(foodCategory!.type).toBe("expense");

    const transportCategory = result.find((r) => r.category === "交通費");
    expect(transportCategory).toBeDefined();
    expect(transportCategory!.totalAmount).toBe(10000);
  });

  it("収入と支出を分けて集計する", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    const result = getMonthlyCategoryTotals("2025-04", undefined, db);

    const incomeCategory = result.find((r) => r.type === "income");
    expect(incomeCategory).toBeDefined();
    expect(incomeCategory!.category).toBe("給与");
    expect(incomeCategory!.totalAmount).toBe(500000);

    const expenseCategory = result.find((r) => r.type === "expense");
    expect(expenseCategory).toBeDefined();
    expect(expenseCategory!.category).toBe("食費");
    expect(expenseCategory!.totalAmount).toBe(30000);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getMonthlyCategoryTotals("2025-04", undefined, db);
    expect(result).toEqual([]);
  });

  it("グループ内からグループ外への振替は収入カテゴリに変換される（共通グループなし）", () => {
    // getMonthlySummaryByMonthと同様に、グループ内→グループ外への振替は収入としてカウント
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // グループ内→グループ外への振替（収入として扱われる）
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "transfer",
      transferTargetAccountId: externalAccountId,
    });

    const result = getMonthlyCategoryTotals("2025-04", undefined, db);

    const incomeCategory = result.find((r) => r.category === "収入");
    expect(incomeCategory).toBeDefined();
    expect(incomeCategory!.type).toBe("income");
    expect(incomeCategory!.totalAmount).toBe(100000);
  });

  it("重複振替は両方カウントされる（Money Forward本家と同じ挙動）", () => {
    // Money Forward本家のカテゴリ別表示では振替の重複が表示される
    // getMonthlySummaryByMonth（収支サマリー）は重複除去するが、
    // getMonthlyCategoryTotals（カテゴリ別）は重複を含めて表示する
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // 同じ日、同じ金額、同じアカウント間の振替が2件（重複）
    // グループ内→グループ外への振替（収入として扱われる）
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 50000,
      type: "transfer",
      transferTargetAccountId: externalAccountId,
    });
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 50000,
      type: "transfer",
      transferTargetAccountId: externalAccountId,
    });

    const result = getMonthlyCategoryTotals("2025-04", undefined, db);

    // カテゴリ別では重複が含まれる（100000 = 50000 × 2）
    const incomeCategory = result.find((r) => r.category === "収入");
    expect(incomeCategory).toBeDefined();
    expect(incomeCategory!.totalAmount).toBe(100000);
  });

  it("グループ外からグループ内への振替は支出カテゴリになる（共通グループなし）", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // グループ外（external）→グループ内（account）への振替
    const now = new Date().toISOString();
    db.insert(schema.transactions)
      .values({
        mfId: `mf-transfer-${Date.now()}`,
        accountId: externalAccountId,
        date: "2025-04-15",
        amount: 80000,
        type: "transfer",
        description: "External to Group",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: accountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getMonthlyCategoryTotals("2025-04", undefined, db);

    // グループ外→グループ内への振替は支出としてカウント
    const expenseCategory = result.find((r) => r.category === "支出");
    expect(expenseCategory).toBeDefined();
    expect(expenseCategory!.type).toBe("expense");
    expect(expenseCategory!.totalAmount).toBe(80000);
  });
});

describe("getYearToDateSummary", () => {
  it("年間の収支サマリーを返す", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-05-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 100000,
      type: "expense",
      category: "家賃",
    });
    createTransaction({
      accountId,
      date: "2025-05-20",
      amount: 100000,
      type: "expense",
      category: "家賃",
    });

    const result = getYearToDateSummary({ year: 2025 }, db);

    expect(result.year).toBe(2025);
    expect(result.totalIncome).toBe(1000000);
    expect(result.totalExpense).toBe(200000);
    expect(result.balance).toBe(800000);
    expect(result.monthCount).toBe(2);
  });

  it("データがない年は0を返す", () => {
    const result = getYearToDateSummary({ year: 2099 }, db);

    expect(result.year).toBe(2099);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.monthCount).toBe(0);
  });

  it("グループがない場合は0を返す", () => {
    resetTestDb(db);
    const result = getYearToDateSummary({ year: 2025 }, db);

    expect(result.totalIncome).toBe(0);
    expect(result.totalExpense).toBe(0);
    expect(result.balance).toBe(0);
    expect(result.monthCount).toBe(0);
  });

  it("yearを指定しない場合は現在年を使用する", () => {
    const accountId = createTestAccount("Bank A");
    const currentYear = new Date().getFullYear();
    createTransaction({
      accountId,
      date: `${currentYear}-01-15`,
      amount: 100000,
      type: "income",
      category: "給与",
    });

    const result = getYearToDateSummary(undefined, db);

    expect(result.year).toBe(currentYear);
    expect(result.totalIncome).toBe(100000);
  });

  it("異なる年のデータは含まれない", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2024-12-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 300000,
      type: "income",
      category: "給与",
    });

    const result = getYearToDateSummary({ year: 2025 }, db);

    expect(result.totalIncome).toBe(300000);
    expect(result.monthCount).toBe(1);
  });

  it("グループ内からグループ外への振替は収入に含まれる（重複除去あり）", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // 通常の収入
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });

    // グループ内→グループ外への振替（収入として扱われる）
    const now = new Date().toISOString();
    db.insert(schema.transactions)
      .values({
        mfId: `mf-transfer-income-${Date.now()}`,
        accountId: accountId,
        date: "2025-04-20",
        amount: 100000,
        type: "transfer",
        description: "Group to External",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: externalAccountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 同じ振替の重複レコード（重複除去される）
    db.insert(schema.transactions)
      .values({
        mfId: `mf-transfer-income-dup-${Date.now()}`,
        accountId: accountId,
        date: "2025-04-20",
        amount: 100000,
        type: "transfer",
        description: "Group to External (dup)",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: externalAccountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getYearToDateSummary({ year: 2025 }, db);

    // 通常収入500000 + 振替収入100000（重複除去済み）= 600000
    expect(result.totalIncome).toBe(600000);
  });
});

describe("getExpenseByFixedVariable", () => {
  it("固定費と変動費を分類して返す", () => {
    const accountId = createTestAccount("Bank A");
    createSpendingTarget("家賃", "fixed", 1);
    createSpendingTarget("水道光熱費", "fixed", 2);

    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "expense",
      category: "家賃",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 15000,
      type: "expense",
      category: "水道光熱費",
    });
    createTransaction({
      accountId,
      date: "2025-04-25",
      amount: 50000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-04-28",
      amount: 10000,
      type: "expense",
      category: "交通費",
    });

    const result = getExpenseByFixedVariable("2025-04", undefined, db);

    expect(result.fixed.total).toBe(115000);
    expect(result.fixed.categories).toHaveLength(2);
    expect(result.fixed.categories[0].category).toBe("家賃");
    expect(result.fixed.categories[0].amount).toBe(100000);

    expect(result.variable.total).toBe(60000);
    expect(result.variable.categories).toHaveLength(2);
    expect(result.variable.categories[0].category).toBe("食費");
    expect(result.variable.categories[0].amount).toBe(50000);
  });

  it("固定費の設定がない場合は全て変動費になる", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "expense",
      category: "家賃",
    });
    createTransaction({
      accountId,
      date: "2025-04-25",
      amount: 50000,
      type: "expense",
      category: "食費",
    });

    const result = getExpenseByFixedVariable("2025-04", undefined, db);

    expect(result.fixed.total).toBe(0);
    expect(result.fixed.categories).toHaveLength(0);
    expect(result.variable.total).toBe(150000);
    expect(result.variable.categories).toHaveLength(2);
  });

  it("グループがない場合は空の結果を返す", () => {
    resetTestDb(db);
    const result = getExpenseByFixedVariable("2025-04", undefined, db);

    expect(result.fixed.total).toBe(0);
    expect(result.fixed.categories).toHaveLength(0);
    expect(result.variable.total).toBe(0);
    expect(result.variable.categories).toHaveLength(0);
  });

  it("収入は分類に含まれない", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 500000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    const result = getExpenseByFixedVariable("2025-04", undefined, db);

    expect(result.fixed.total).toBe(0);
    expect(result.variable.total).toBe(30000);
  });

  it("カテゴリは金額順にソートされる", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 10000,
      type: "expense",
      category: "交通費",
    });
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 50000,
      type: "expense",
      category: "食費",
    });
    createTransaction({
      accountId,
      date: "2025-04-25",
      amount: 30000,
      type: "expense",
      category: "娯楽",
    });

    const result = getExpenseByFixedVariable("2025-04", undefined, db);

    expect(result.variable.categories[0].category).toBe("食費");
    expect(result.variable.categories[1].category).toBe("娯楽");
    expect(result.variable.categories[2].category).toBe("交通費");
  });

  it("グループ内からグループ外への振替は収入であり、支出の固定費/変動費には含まれない", () => {
    // グループ内→グループ外への振替は収入としてカウントされるため、
    // 支出の固定費/変動費分類には含まれない
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // 通常の支出
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    // グループ内からグループ外への振替（収入として扱われるため支出には含まれない）
    createTransaction({
      accountId,
      date: "2025-04-20",
      amount: 50000,
      type: "transfer",
      transferTargetAccountId: externalAccountId,
    });

    const result = getExpenseByFixedVariable("2025-04", undefined, db);

    // 食費30000のみ（振替は収入なので支出には含まれない）
    expect(result.variable.total).toBe(30000);

    // 「支出」カテゴリは存在しない（振替は収入扱い）
    const expenseCategory = result.variable.categories.find((c) => c.category === "支出");
    expect(expenseCategory).toBeUndefined();
  });
});

describe("getLatestMonthlySummary", () => {
  it("最新月のサマリーを返す", () => {
    const accountId = createTestAccount("Bank A");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    createTransaction({
      accountId,
      date: `${currentMonth}-15`,
      amount: 100000,
      type: "income",
      category: "給与",
    });

    const result = getLatestMonthlySummary(undefined, db);

    expect(result).toBeDefined();
    expect(result!.month).toBe(currentMonth);
    expect(result!.totalIncome).toBe(100000);
  });

  it("グループがない場合はundefinedを返す", () => {
    resetTestDb(db);
    const result = getLatestMonthlySummary(undefined, db);
    expect(result).toBeUndefined();
  });
});

describe("getMonthlySummaries", () => {
  it("全ての月のサマリーを返す", () => {
    const accountId = createTestAccount("Bank A");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    createTransaction({
      accountId,
      date: `${currentMonth}-15`,
      amount: 100000,
      type: "income",
      category: "給与",
    });

    const result = getMonthlySummaries(undefined, db);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].month).toBe(currentMonth);
  });

  it("limitを指定すると件数が制限される", () => {
    const accountId = createTestAccount("Bank A");
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "income",
    });
    createTransaction({
      accountId,
      date: "2025-12-15",
      amount: 100000,
      type: "income",
    });

    const result = getMonthlySummaries({ limit: 1 }, db);

    expect(result).toHaveLength(1);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getMonthlySummaries(undefined, db);
    expect(result).toEqual([]);
  });
});

describe("getAvailableMonths", () => {
  it("利用可能な月のリストを返す", () => {
    const accountId = createTestAccount("Bank A");
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    createTransaction({
      accountId,
      date: `${currentMonth}-15`,
      amount: 100000,
      type: "income",
    });

    const result = getAvailableMonths(undefined, db);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].month).toBe(currentMonth);
  });

  it("グループがない場合は空配列を返す", () => {
    resetTestDb(db);
    const result = getAvailableMonths(undefined, db);
    expect(result).toEqual([]);
  });
});

// ============================================================
// 内部関数のユニットテスト
// ============================================================

describe("getDeduplicatedTransferIncome", () => {
  // ヘルパー関数: グループ内→グループ外への振替を作成（収入としてカウントされる）
  function createTransferToExternal(
    groupAccountId: number,
    externalAccountId: number,
    date: string,
    amount: number,
  ) {
    const now = new Date().toISOString();
    db.insert(schema.transactions)
      .values({
        mfId: `mf-transfer-${Date.now()}-${Math.random()}`,
        accountId: groupAccountId,
        date,
        amount,
        type: "transfer",
        description: "Group to External",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: externalAccountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  it("グループ内→グループ外への振替収入を月別に集計する", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // グループ内→グループ外への振替
    createTransferToExternal(accountId, externalAccountId, "2025-04-15", 100000);
    createTransferToExternal(accountId, externalAccountId, "2025-04-20", 50000);

    const result = getDeduplicatedTransferIncome(db, [accountId]);

    expect(result.get("2025-04")).toBe(150000);
  });

  it("同一日・同一金額・同一account・同一targetの振替は1件のみカウント", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // 全く同じ条件の振替を2回登録（重複）
    const now = new Date().toISOString();
    db.insert(schema.transactions)
      .values({
        mfId: "mf-transfer-dup-1",
        accountId: accountId,
        date: "2025-04-15",
        amount: 100000,
        type: "transfer",
        description: "Group to External",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: externalAccountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.transactions)
      .values({
        mfId: "mf-transfer-dup-2",
        accountId: accountId,
        date: "2025-04-15",
        amount: 100000,
        type: "transfer",
        description: "Group to External (dup)",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: externalAccountId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getDeduplicatedTransferIncome(db, [accountId]);

    // 重複除外されて1件分のみ
    expect(result.get("2025-04")).toBe(100000);
  });

  it("日付が異なれば別々にカウント", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    createTransferToExternal(accountId, externalAccountId, "2025-04-15", 100000);
    createTransferToExternal(accountId, externalAccountId, "2025-04-16", 100000);

    const result = getDeduplicatedTransferIncome(db, [accountId]);

    expect(result.get("2025-04")).toBe(200000);
  });

  it("金額が異なれば別々にカウント", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    createTransferToExternal(accountId, externalAccountId, "2025-04-15", 100000);
    createTransferToExternal(accountId, externalAccountId, "2025-04-15", 50000);

    const result = getDeduplicatedTransferIncome(db, [accountId]);

    expect(result.get("2025-04")).toBe(150000);
  });

  it("dateConditionで期間を絞り込める", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    createTransferToExternal(accountId, externalAccountId, "2025-04-15", 100000);
    createTransferToExternal(accountId, externalAccountId, "2025-05-15", 200000);

    const result = getDeduplicatedTransferIncome(db, [accountId], "2025-04");

    expect(result.get("2025-04")).toBe(100000);
    expect(result.has("2025-05")).toBe(false);
  });

  it("共通グループに属するアカウントへの振替は収入としてカウントされない", () => {
    // Money Forwardの動作: 共通グループがある場合は内部振替として収支に含めない
    const now = new Date().toISOString();
    const accountId = createTestAccount("Bank A");

    // accountIdと同じグループに属するアカウント（共通グループがある）
    const commonGroupAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "mf_common_group",
        name: "Common Group Account",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    // TEST_GROUP_IDに登録（accountIdと同じグループ）
    db.insert(schema.groupAccounts)
      .values({
        groupId: TEST_GROUP_ID,
        accountId: commonGroupAccount.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // グループ内→共通グループアカウントへの振替（共通グループあり）
    db.insert(schema.transactions)
      .values({
        mfId: "mf-transfer-common",
        accountId: accountId,
        date: "2025-04-15",
        amount: 100000,
        type: "transfer",
        description: "Group to Common Group",
        isTransfer: true,
        isExcludedFromCalculation: true,
        transferTargetAccountId: commonGroupAccount.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const result = getDeduplicatedTransferIncome(db, [accountId]);

    // 共通グループがある場合は収入としてカウントされない
    expect(result.size).toBe(0);
  });

  it("振替がない場合は空のMapを返す", () => {
    const accountId = createTestAccount("Bank A");

    const result = getDeduplicatedTransferIncome(db, [accountId]);

    expect(result.size).toBe(0);
  });
});

describe("buildIncludedTransactionCondition", () => {
  it("収入・支出を含み、グループ外への振替を含める条件を構築する", () => {
    const accountId = createTestAccount("Bank A");
    const externalAccountId = createExternalAccount("External");

    // 収入（含まれるべき）
    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "income",
      category: "給与",
    });

    // 支出（含まれるべき）
    createTransaction({
      accountId,
      date: "2025-04-16",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    // グループ外への振替（含まれるべき）
    createTransaction({
      accountId,
      date: "2025-04-17",
      amount: 50000,
      type: "transfer",
      transferTargetAccountId: externalAccountId,
    });

    const condition = buildIncludedTransactionCondition([accountId]);
    const results = db.select().from(schema.transactions).where(condition).all();

    expect(results).toHaveLength(3);
  });

  it("計算除外フラグが立っている非振替トランザクションは除外される", () => {
    const accountId = createTestAccount("Bank A");

    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "income",
      category: "給与",
      isExcludedFromCalculation: true,
    });

    const condition = buildIncludedTransactionCondition([accountId]);
    const results = db.select().from(schema.transactions).where(condition).all();

    expect(results).toHaveLength(0);
  });
});

describe("buildOutsideTransferCondition", () => {
  it("グループ外からグループ内への振替を検出する", () => {
    const now = new Date().toISOString();
    const groupAccountId = createTestAccount("Group Bank");

    // グループ外アカウント
    const outsideAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "mf_outside",
        name: "Outside Account",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    const outsideGroupId = "outside_group";
    db.insert(schema.groups)
      .values({
        id: outsideGroupId,
        name: "Outside Group",
        isCurrent: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.groupAccounts)
      .values({
        groupId: outsideGroupId,
        accountId: outsideAccount.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // グループ外からグループ内への振替
    db.insert(schema.transactions)
      .values({
        mfId: `tx_${Date.now()}`,
        date: "2025-04-15",
        accountId: outsideAccount.id,
        transferTargetAccountId: groupAccountId,
        amount: 50000,
        type: "transfer",
        description: "Outside to group transfer",
        isTransfer: true,
        isExcludedFromCalculation: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const condition = buildOutsideTransferCondition([groupAccountId]);
    const results = db.select().from(schema.transactions).where(condition).all();

    expect(results).toHaveLength(1);
    expect(results[0].amount).toBe(50000);
  });
});

describe("buildGroupTransactionCondition", () => {
  it("グループ内の通常トランザクション＋グループ外からの振替を含める", () => {
    const now = new Date().toISOString();
    const groupAccountId = createTestAccount("Group Bank");

    // 通常の収入
    createTransaction({
      accountId: groupAccountId,
      date: "2025-04-15",
      amount: 100000,
      type: "income",
      category: "給与",
    });

    // グループ外アカウント
    const outsideAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "mf_outside2",
        name: "Outside Account",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    const outsideGroupId = "outside_group2";
    db.insert(schema.groups)
      .values({
        id: outsideGroupId,
        name: "Outside Group",
        isCurrent: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.groupAccounts)
      .values({
        groupId: outsideGroupId,
        accountId: outsideAccount.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // グループ外からグループ内への振替
    db.insert(schema.transactions)
      .values({
        mfId: `tx_outside_${Date.now()}`,
        date: "2025-04-16",
        accountId: outsideAccount.id,
        transferTargetAccountId: groupAccountId,
        amount: 50000,
        type: "transfer",
        description: "Outside to group",
        isTransfer: true,
        isExcludedFromCalculation: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const condition = buildGroupTransactionCondition([groupAccountId]);
    const results = db.select().from(schema.transactions).where(condition).all();

    expect(results).toHaveLength(2);
  });
});

describe("buildRegularIncomeSum", () => {
  it("収入のみを合計する", () => {
    const accountId = createTestAccount("Bank A");

    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "income",
      category: "給与",
    });
    createTransaction({
      accountId,
      date: "2025-04-16",
      amount: 50000,
      type: "income",
      category: "副業",
    });
    createTransaction({
      accountId,
      date: "2025-04-17",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    const incomeSum = buildRegularIncomeSum();
    const result = db.select({ total: incomeSum }).from(schema.transactions).get();

    expect(result?.total).toBe(150000);
  });

  it("収入がない場合は0を返す", () => {
    const accountId = createTestAccount("Bank A");

    createTransaction({
      accountId,
      date: "2025-04-17",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    const incomeSum = buildRegularIncomeSum();
    const result = db.select({ total: incomeSum }).from(schema.transactions).get();

    expect(result?.total).toBe(0);
  });
});

describe("buildExpenseSum", () => {
  it("通常の支出のみを合計する（振替は含めない）", () => {
    const now = new Date().toISOString();
    const groupAccountId = createTestAccount("Group Bank");

    // グループ外アカウント（別グループ所属）
    const outsideAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "mf_outside3",
        name: "Outside Account",
        type: "bank",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    const outsideGroupId = "outside_group3";
    db.insert(schema.groups)
      .values({
        id: outsideGroupId,
        name: "Outside Group",
        isCurrent: false,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    db.insert(schema.groupAccounts)
      .values({
        groupId: outsideGroupId,
        accountId: outsideAccount.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // 通常の支出
    createTransaction({
      accountId: groupAccountId,
      date: "2025-04-15",
      amount: 30000,
      type: "expense",
      category: "食費",
    });

    // グループ内からグループ外への振替（振替は支出に含まれない）
    createTransaction({
      accountId: groupAccountId,
      date: "2025-04-16",
      amount: 20000,
      type: "transfer",
      transferTargetAccountId: outsideAccount.id,
    });

    // 収入（支出には含まれない）
    createTransaction({
      accountId: groupAccountId,
      date: "2025-04-17",
      amount: 100000,
      type: "income",
      category: "給与",
    });

    const expenseSum = buildExpenseSum([groupAccountId]);
    const result = db.select({ total: expenseSum }).from(schema.transactions).get();

    // 通常支出30000のみ（振替は含まない）
    expect(result?.total).toBe(30000);
  });

  it("支出がない場合は0を返す", () => {
    const accountId = createTestAccount("Bank A");

    createTransaction({
      accountId,
      date: "2025-04-15",
      amount: 100000,
      type: "income",
      category: "給与",
    });

    const expenseSum = buildExpenseSum([accountId]);
    const result = db.select({ total: expenseSum }).from(schema.transactions).get();

    expect(result?.total).toBe(0);
  });
});

describe("getDeduplicatedTransferExpense", () => {
  it("振替先に対応する通常トランザクションがない場合は支出としてカウント", () => {
    const groupAccountId = createTestAccount("Group Bank");
    const externalAccountId = createExternalAccount("External Bank");

    // グループ外→グループ内への振替（通常TXなし）
    createTransaction({
      accountId: externalAccountId,
      date: "2025-04-15",
      amount: 5000,
      type: "transfer",
      transferTargetAccountId: groupAccountId,
    });

    const result = getDeduplicatedTransferExpense(db, [groupAccountId], "2025-04");

    expect(result.get("2025-04")).toBe(5000);
  });

  it("振替先に対応する通常トランザクションがある場合は除外する（重複回避）", () => {
    const groupAccountId = createTestAccount("Group Bank");
    const externalAccountId = createExternalAccount("External Bank");

    // グループ外→グループ内への振替
    createTransaction({
      accountId: externalAccountId,
      date: "2025-04-15",
      amount: 10000,
      type: "transfer",
      transferTargetAccountId: groupAccountId,
    });

    // 振替先アカウントで同一日・同一金額の通常トランザクション（既にカウント済み）
    createTransaction({
      accountId: groupAccountId,
      date: "2025-04-15",
      amount: 10000,
      type: "expense",
      category: "総合振込",
    });

    const result = getDeduplicatedTransferExpense(db, [groupAccountId], "2025-04");

    // 通常TXでカウント済みなので振替は除外される
    expect(result.get("2025-04")).toBeUndefined();
  });

  it("重複する振替は1件のみカウント", () => {
    const groupAccountId = createTestAccount("Group Bank");
    const externalAccountId = createExternalAccount("External Bank");

    // 同じ振替が2件記録されている
    createTransaction({
      accountId: externalAccountId,
      date: "2025-04-15",
      amount: 5000,
      type: "transfer",
      transferTargetAccountId: groupAccountId,
    });

    createTransaction({
      accountId: externalAccountId,
      date: "2025-04-15",
      amount: 5000,
      type: "transfer",
      transferTargetAccountId: groupAccountId,
    });

    const result = getDeduplicatedTransferExpense(db, [groupAccountId], "2025-04");

    // 重複除外で1件のみ
    expect(result.get("2025-04")).toBe(5000);
  });

  it("複数月の振替を正しく集計する", () => {
    const groupAccountId = createTestAccount("Group Bank");
    const externalAccountId = createExternalAccount("External Bank");

    // 1月の振替
    createTransaction({
      accountId: externalAccountId,
      date: "2025-04-15",
      amount: 5000,
      type: "transfer",
      transferTargetAccountId: groupAccountId,
    });

    // 2月の振替
    createTransaction({
      accountId: externalAccountId,
      date: "2025-05-15",
      amount: 8000,
      type: "transfer",
      transferTargetAccountId: groupAccountId,
    });

    const result = getDeduplicatedTransferExpense(db, [groupAccountId]);

    expect(result.get("2025-04")).toBe(5000);
    expect(result.get("2025-05")).toBe(8000);
  });

  it("グループ内→グループ外への振替は含まれない", () => {
    const groupAccountId = createTestAccount("Group Bank");
    const externalAccountId = createExternalAccount("External Bank");

    // グループ内→グループ外への振替（これは収入扱い）
    createTransaction({
      accountId: groupAccountId,
      date: "2025-04-15",
      amount: 5000,
      type: "transfer",
      transferTargetAccountId: externalAccountId,
    });

    const result = getDeduplicatedTransferExpense(db, [groupAccountId], "2025-04");

    // グループ外→グループ内の振替ではないのでカウントされない
    expect(result.get("2025-04")).toBeUndefined();
  });
});
