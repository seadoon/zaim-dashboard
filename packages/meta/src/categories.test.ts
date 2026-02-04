import { describe, test, expect } from "vitest";
import {
  INCOME_LARGE_CATEGORIES,
  EXPENSE_LARGE_CATEGORIES,
  ALL_LARGE_CATEGORIES,
  LARGE_CATEGORY_NAME_BY_ID,
  LARGE_CATEGORY_ID_BY_NAME,
} from "./categories";

describe("INCOME_LARGE_CATEGORIES", () => {
  test("2つの収入カテゴリが定義されている", () => {
    expect(INCOME_LARGE_CATEGORIES).toHaveLength(2);
  });

  test("未分類(id=0)と収入(id=1)が含まれる", () => {
    expect(INCOME_LARGE_CATEGORIES[0]).toEqual({ id: 0, name: "未分類" });
    expect(INCOME_LARGE_CATEGORIES[1]).toEqual({ id: 1, name: "収入" });
  });
});

describe("EXPENSE_LARGE_CATEGORIES", () => {
  test("17個の支出カテゴリが定義されている", () => {
    expect(EXPENSE_LARGE_CATEGORIES).toHaveLength(17);
  });

  test("ID が一意", () => {
    const ids = EXPENSE_LARGE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(17);
  });

  test("食費(id=11)が含まれる", () => {
    const food = EXPENSE_LARGE_CATEGORIES.find((c) => c.id === 11);
    expect(food).toEqual({ id: 11, name: "食費" });
  });
});

describe("ALL_LARGE_CATEGORIES", () => {
  test("収入+支出の合計19個", () => {
    expect(ALL_LARGE_CATEGORIES).toHaveLength(19);
  });

  test("全IDが一意", () => {
    const ids = ALL_LARGE_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(19);
  });
});

describe("LARGE_CATEGORY_NAME_BY_ID", () => {
  test("ID から名前を引ける", () => {
    expect(LARGE_CATEGORY_NAME_BY_ID[0]).toBe("未分類");
    expect(LARGE_CATEGORY_NAME_BY_ID[1]).toBe("収入");
    expect(LARGE_CATEGORY_NAME_BY_ID[11]).toBe("食費");
    expect(LARGE_CATEGORY_NAME_BY_ID[20]).toBe("交通費");
  });
});

describe("LARGE_CATEGORY_ID_BY_NAME", () => {
  test("名前から ID を引ける", () => {
    expect(LARGE_CATEGORY_ID_BY_NAME["未分類"]).toBe(0);
    expect(LARGE_CATEGORY_ID_BY_NAME["収入"]).toBe(1);
    expect(LARGE_CATEGORY_ID_BY_NAME["食費"]).toBe(11);
    expect(LARGE_CATEGORY_ID_BY_NAME["交通費"]).toBe(20);
  });
});
