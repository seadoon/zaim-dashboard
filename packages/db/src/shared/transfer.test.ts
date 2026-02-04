import { describe, it, expect } from "vitest";
import { transformTransferToIncome } from "./transfer";

describe("transformTransferToIncome", () => {
  const baseTransaction = {
    id: 1,
    date: "2025-04-15",
    amount: 100000,
    description: "振替",
    accountId: 1,
    accountName: "三井住友銀行",
  };

  it("グループ外からの振替は収入に変換される", () => {
    const transaction = {
      ...baseTransaction,
      type: "transfer",
      transferTargetAccountId: 99, // グループ外
      category: null,
      subCategory: null,
      isTransfer: true,
      isExcludedFromCalculation: true,
    };

    const result = transformTransferToIncome(transaction, [1, 2, 3]);

    expect(result.type).toBe("income");
    expect(result.category).toBe("収入");
    expect(result.subCategory).toBe("振替入金");
    expect(result.isTransfer).toBe(false);
    expect(result.isExcludedFromCalculation).toBe(false);
  });

  it("グループ内振替はそのまま返される", () => {
    const transaction = {
      ...baseTransaction,
      type: "transfer",
      transferTargetAccountId: 2, // グループ内
      category: null,
      subCategory: null,
      isTransfer: true,
      isExcludedFromCalculation: true,
    };

    const result = transformTransferToIncome(transaction, [1, 2, 3]);

    expect(result.type).toBe("transfer");
    expect(result.isTransfer).toBe(true);
  });

  it("transferTargetAccountIdがnullの場合はそのまま返される", () => {
    const transaction = {
      ...baseTransaction,
      type: "transfer",
      transferTargetAccountId: null,
      category: null,
      subCategory: null,
      isTransfer: true,
      isExcludedFromCalculation: true,
    };

    const result = transformTransferToIncome(transaction, [1, 2, 3]);

    expect(result.type).toBe("transfer");
  });

  it("通常の収入・支出は変更されない", () => {
    const income = {
      ...baseTransaction,
      type: "income",
      transferTargetAccountId: null,
      category: "給与",
      subCategory: null,
      isTransfer: false,
      isExcludedFromCalculation: false,
    };

    const expense = {
      ...baseTransaction,
      type: "expense",
      transferTargetAccountId: null,
      category: "食費",
      subCategory: null,
      isTransfer: false,
      isExcludedFromCalculation: false,
    };

    expect(transformTransferToIncome(income, [1])).toEqual(income);
    expect(transformTransferToIncome(expense, [1])).toEqual(expense);
  });
});
