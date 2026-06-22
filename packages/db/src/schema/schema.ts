import { relations } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

// ============================================================================
// Zaim 支払いデータ
// ============================================================================

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    zaimId: integer("zaim_id").notNull().unique(),
    date: text("date").notNull(),
    type: text("type").notNull(), // "payment" | "income" | "transfer"
    category: text("category"),
    genre: text("genre"),
    amount: integer("amount").notNull(),
    place: text("place"),
    name: text("name"),
    comment: text("comment"),
    fromAccount: text("from_account"),
    toAccount: text("to_account"),
    count: text("count").notNull().default("集計に含む"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("transactions_date_idx").on(table.date),
    index("transactions_type_idx").on(table.type),
    index("transactions_category_idx").on(table.category),
  ],
);

// ============================================================================
// Zaim 銀行残高履歴
// ============================================================================

export const zaimDailyBankTotals = sqliteTable(
  "zaim_daily_bank_totals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(),
    total: integer("total").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("zaim_daily_bank_totals_date_idx").on(table.date)],
);

// ============================================================================
// Robofolio 証券データ
// ============================================================================

// 証券会社マスタ（SBI証券, 楽天証券, etc.）
export const rfBrokers = sqliteTable("rf_brokers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// 銘柄マスタ（証券会社×銘柄）
export const rfHoldings = sqliteTable(
  "rf_holdings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    brokerId: integer("broker_id")
      .notNull()
      .references(() => rfBrokers.id, { onDelete: "cascade" }),
    code: text("code"), // 銘柄コード（投信はnullの場合あり）
    name: text("name").notNull(),
    assetType: text("asset_type").notNull(), // "株式" | "投資信託" | "ETF" | "REIT" | "その他"
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("rf_holdings_broker_id_idx").on(table.brokerId)],
);

// 日次スナップショット
export const rfSnapshots = sqliteTable("rf_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// 銘柄ごとの日次評価額
export const rfHoldingValues = sqliteTable(
  "rf_holding_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => rfSnapshots.id, { onDelete: "cascade" }),
    holdingId: integer("holding_id")
      .notNull()
      .references(() => rfHoldings.id, { onDelete: "cascade" }),
    quantity: real("quantity"),
    avgCostPrice: real("avg_cost_price"),
    unitPrice: real("unit_price"),
    amount: integer("amount").notNull(),
    unrealizedGain: integer("unrealized_gain"),
    unrealizedGainPct: real("unrealized_gain_pct"),
    dailyChange: integer("daily_change"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("rf_holding_values_snapshot_holding_idx").on(table.snapshotId, table.holdingId),
  ],
);

// 資産タイプ別日次履歴（ロボフォリオのポートフォリオチャートから取得した集計データ）
export const rfAssetHistory = sqliteTable(
  "rf_asset_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    assetType: text("asset_type").notNull(),
    amount: integer("amount").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("rf_asset_history_date_type_idx").on(table.date, table.assetType)],
);

// ============================================================================
// リレーション定義
// ============================================================================

export const rfBrokersRelations = relations(rfBrokers, ({ many }) => ({
  holdings: many(rfHoldings),
}));

export const rfHoldingsRelations = relations(rfHoldings, ({ one, many }) => ({
  broker: one(rfBrokers, {
    fields: [rfHoldings.brokerId],
    references: [rfBrokers.id],
  }),
  values: many(rfHoldingValues),
}));

export const rfSnapshotsRelations = relations(rfSnapshots, ({ many }) => ({
  holdingValues: many(rfHoldingValues),
}));

export const rfHoldingValuesRelations = relations(rfHoldingValues, ({ one }) => ({
  snapshot: one(rfSnapshots, {
    fields: [rfHoldingValues.snapshotId],
    references: [rfSnapshots.id],
  }),
  holding: one(rfHoldings, {
    fields: [rfHoldingValues.holdingId],
    references: [rfHoldings.id],
  }),
}));

// ============================================================================
// 日興証券 持株会
// ============================================================================

export const nikkoHoldings = sqliteTable("nikko_holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fetchedAt: text("fetched_at").notNull(),   // ISO8601 取得日時
  stockCode: text("stock_code").notNull(),   // 銘柄コード
  stockName: text("stock_name").notNull(),   // 銘柄名
  shares: real("shares").notNull(),          // 保有株数（小数あり）
  avgCostPrice: integer("avg_cost_price").notNull(), // 平均取得単価（円）
  totalContribution: integer("total_contribution").notNull(), // 拠出金累計（円）
  totalIncentive: integer("total_incentive").notNull(),       // 奨励金累計（円）
  currentPrice: real("current_price"),       // 現在株価（円、Yahoo Financeから取得）
  marketValue: integer("market_value"),      // 評価額（円 = shares × currentPrice）
});
