import { describe, expect, it } from "vitest";
import {
  consolidateCategories,
  extractRanking,
  groupAndSum,
  mapToSortedArray,
} from "./aggregation";

describe("consolidateCategories", () => {
  it("returns all items when under limit", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 80 },
      { name: "C", value: 60 },
    ];
    const result = consolidateCategories(data, 6);
    expect(result).toEqual(data);
  });

  it("consolidates items over limit into その他", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 80 },
      { name: "C", value: 60 },
      { name: "D", value: 40 },
      { name: "E", value: 20 },
      { name: "F", value: 10 },
      { name: "G", value: 5 },
    ];
    const result = consolidateCategories(data, 6);

    expect(result).toHaveLength(6);
    expect(result.slice(0, 5).map((r) => r.name)).toEqual(["A", "B", "C", "D", "E"]);
    expect(result[5]).toEqual({ name: "その他", value: 15 }); // F(10) + G(5)
  });

  it("handles existing その他 category", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 80 },
      { name: "C", value: 60 },
      { name: "D", value: 40 },
      { name: "E", value: 20 },
      { name: "F", value: 10 },
      { name: "その他", value: 50 },
    ];
    const result = consolidateCategories(data, 6);

    expect(result).toHaveLength(6);
    // その他 should be combined: F(10) + existing その他(50) = 60
    expect(result[5]).toEqual({ name: "その他", value: 60 });
  });

  it("preserves existing その他 when under limit", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 80 },
      { name: "その他", value: 50 },
    ];
    const result = consolidateCategories(data, 6);

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ name: "その他", value: 50 });
  });

  it("handles empty array", () => {
    expect(consolidateCategories([])).toEqual([]);
  });

  it("respects custom maxItems", () => {
    const data = [
      { name: "A", value: 100 },
      { name: "B", value: 80 },
      { name: "C", value: 60 },
      { name: "D", value: 40 },
    ];
    const result = consolidateCategories(data, 3);

    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ name: "その他", value: 100 }); // C(60) + D(40)
  });
});

describe("extractRanking", () => {
  const items = [
    { name: "A", dailyChange: 1000 },
    { name: "B", dailyChange: 500 },
    { name: "C", dailyChange: 200 },
    { name: "D", dailyChange: -100 },
    { name: "E", dailyChange: -300 },
    { name: "F", dailyChange: -500 },
    { name: "G", dailyChange: 0 },
  ];

  it("extracts top gainers", () => {
    const { topGainers } = extractRanking(items, 3);
    expect(topGainers).toHaveLength(3);
    expect(topGainers.map((g) => g.name)).toEqual(["A", "B", "C"]);
  });

  it("extracts top losers in order of biggest loss", () => {
    const { topLosers } = extractRanking(items, 3);
    expect(topLosers).toHaveLength(3);
    // Should be ordered by biggest loss first
    expect(topLosers.map((l) => l.name)).toEqual(["F", "E", "D"]);
  });

  it("calculates total change", () => {
    const { totalChange } = extractRanking(items);
    expect(totalChange).toBe(1000 + 500 + 200 - 100 - 300 - 500 + 0);
  });

  it("excludes zero-change items from gainers and losers", () => {
    const { topGainers, topLosers } = extractRanking(items);
    expect(topGainers.every((g) => g.dailyChange > 0)).toBe(true);
    expect(topLosers.every((l) => l.dailyChange < 0)).toBe(true);
  });

  it("handles all gainers", () => {
    const allGainers = [
      { name: "A", dailyChange: 100 },
      { name: "B", dailyChange: 50 },
    ];
    const { topGainers, topLosers } = extractRanking(allGainers, 5);
    expect(topGainers).toHaveLength(2);
    expect(topLosers).toHaveLength(0);
  });

  it("handles all losers", () => {
    const allLosers = [
      { name: "A", dailyChange: -100 },
      { name: "B", dailyChange: -50 },
    ];
    const { topGainers, topLosers } = extractRanking(allLosers, 5);
    expect(topGainers).toHaveLength(0);
    expect(topLosers).toHaveLength(2);
  });

  it("handles empty array", () => {
    const { topGainers, topLosers, totalChange } = extractRanking([]);
    expect(topGainers).toHaveLength(0);
    expect(topLosers).toHaveLength(0);
    expect(totalChange).toBe(0);
  });
});

describe("groupAndSum", () => {
  it("groups and sums values by key", () => {
    const items = [
      { category: "食費", amount: 1000 },
      { category: "交通費", amount: 500 },
      { category: "食費", amount: 2000 },
      { category: "交通費", amount: 300 },
    ];

    const result = groupAndSum(
      items,
      (item) => item.category,
      (item) => item.amount,
    );

    expect(result.get("食費")).toBe(3000);
    expect(result.get("交通費")).toBe(800);
  });

  it("handles empty array", () => {
    const result = groupAndSum(
      [],
      () => "key",
      () => 0,
    );
    expect(result.size).toBe(0);
  });
});

describe("mapToSortedArray", () => {
  it("converts map to sorted array descending", () => {
    const map = new Map([
      ["A", 100],
      ["B", 300],
      ["C", 200],
    ]);

    const result = mapToSortedArray(map, "desc");
    expect(result).toEqual([
      { name: "B", value: 300 },
      { name: "C", value: 200 },
      { name: "A", value: 100 },
    ]);
  });

  it("converts map to sorted array ascending", () => {
    const map = new Map([
      ["A", 100],
      ["B", 300],
      ["C", 200],
    ]);

    const result = mapToSortedArray(map, "asc");
    expect(result).toEqual([
      { name: "A", value: 100 },
      { name: "C", value: 200 },
      { name: "B", value: 300 },
    ]);
  });

  it("defaults to descending", () => {
    const map = new Map([
      ["A", 100],
      ["B", 200],
    ]);

    const result = mapToSortedArray(map);
    expect(result[0].name).toBe("B");
  });
});
