const ASSET_CATEGORY_VAR_MAP: Record<string, string> = {
  "預金・現金・暗号資産": "--color-asset-deposit",
  "株式(現物)": "--color-asset-stock",
  投資信託: "--color-asset-fund",
  保険: "--color-asset-insurance",
  年金: "--color-asset-pension",
  "ポイント・マイル": "--color-asset-point",
};

export function getAssetCategoryColor(name: string): string {
  const cssVar = ASSET_CATEGORY_VAR_MAP[name];
  if (cssVar) return `var(${cssVar})`;
  return getCategoryColor(name);
}

// Zaim カテゴリカラーマップ
const CATEGORY_COLOR_MAP: Record<string, string> = {
  食費: "--color-cat-food",
  日用品: "--color-cat-daily",
  交通費: "--color-cat-transport",
  "娯楽・趣味": "--color-cat-entertainment",
  "衣服・美容": "--color-cat-clothing",
  "水道・光熱費": "--color-cat-utility",
  通信費: "--color-cat-communication",
  "医療・健康": "--color-cat-health",
  住宅: "--color-cat-housing",
  給与: "--color-cat-income",
  副収入: "--color-cat-income",
  交際費: "--color-cat-social",
  "税・社会保障": "--color-cat-tax",
  その他: "--color-cat-other",
  未分類: "--color-cat-uncategorized",
};

export function getCategoryColor(category: string): string {
  const cssVar = CATEGORY_COLOR_MAP[category];
  if (!cssVar) return "var(--color-cat-other)";
  return `var(${cssVar})`;
}

export function getChartColorArray(count: number): string[] {
  const vars = [
    "--color-chart-1",
    "--color-chart-2",
    "--color-chart-3",
    "--color-chart-4",
    "--color-chart-5",
  ];
  return Array.from({ length: count }, (_, i) => `var(${vars[i % vars.length]})`);
}

export const semanticColors = {
  income: "var(--color-income)",
  expense: "var(--color-expense)",
  balancePositive: "var(--color-balance-positive)",
  balanceNegative: "var(--color-balance-negative)",
  transfer: "var(--color-transfer)",
  totalAssets: "var(--color-total-assets)",
  liability: "var(--color-liability)",
  netAssets: "var(--color-net-assets)",
} as const;
