import { relations } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";

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
// MoneyForward マスタ系
// ============================================================================

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isCurrent: integer("is_current", { mode: "boolean" }).default(false),
  lastScrapedAt: text("last_scraped_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const institutionCategories = sqliteTable("institution_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  displayOrder: integer("display_order"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mfId: text("mf_id").notNull().unique(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    institution: text("institution"),
    categoryId: integer("category_id").references(() => institutionCategories.id, {
      onDelete: "set null",
    }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("accounts_category_id_idx").on(table.categoryId)],
);

export const groupAccounts = sqliteTable(
  "group_accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("group_accounts_group_account_idx").on(table.groupId, table.accountId),
    index("group_accounts_group_id_idx").on(table.groupId),
    index("group_accounts_account_id_idx").on(table.accountId),
  ],
);

export const assetCategories = sqliteTable("asset_categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ============================================================================
// MoneyForward ステータス系
// ============================================================================

export const accountStatuses = sqliteTable("account_statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: integer("account_id")
    .notNull()
    .unique()
    .references(() => accounts.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  lastUpdated: text("last_updated"),
  totalAssets: integer("total_assets").default(0),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ============================================================================
// MoneyForward 銘柄・資産マスタ
// ============================================================================

export const holdings = sqliteTable(
  "holdings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mfId: text("mf_id").unique(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => assetCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    code: text("code"),
    type: text("type").notNull(), // "asset" | "liability"
    liabilityCategory: text("liability_category"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("holdings_account_id_idx").on(table.accountId)],
);

// ============================================================================
// MoneyForward スナップショット系
// ============================================================================

export const dailySnapshots = sqliteTable(
  "daily_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    refreshCompleted: integer("refresh_completed", { mode: "boolean" }).default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("daily_snapshots_date_idx").on(table.date)],
);

export const holdingValues = sqliteTable(
  "holding_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    holdingId: integer("holding_id")
      .notNull()
      .references(() => holdings.id, { onDelete: "cascade" }),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => dailySnapshots.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    quantity: real("quantity"),
    unitPrice: real("unit_price"),
    avgCostPrice: real("avg_cost_price"),
    dailyChange: integer("daily_change"),
    unrealizedGain: integer("unrealized_gain"),
    unrealizedGainPct: real("unrealized_gain_pct"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("holding_values_holding_snapshot_idx").on(table.holdingId, table.snapshotId),
  ],
);

// ============================================================================
// MoneyForward 資産履歴系
// ============================================================================

export const assetHistory = sqliteTable(
  "asset_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    totalAssets: integer("total_assets").notNull(),
    change: integer("change").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("asset_history_group_date_idx").on(table.groupId, table.date),
    index("asset_history_group_id_idx").on(table.groupId),
  ],
);

export const assetHistoryCategories = sqliteTable(
  "asset_history_categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    assetHistoryId: integer("asset_history_id")
      .notNull()
      .references(() => assetHistory.id, { onDelete: "cascade" }),
    categoryName: text("category_name").notNull(),
    amount: integer("amount").notNull().default(0),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("asset_history_categories_history_category_idx").on(
      table.assetHistoryId,
      table.categoryName,
    ),
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
// リレーション定義
// ============================================================================

export const groupsRelations = relations(groups, ({ many }) => ({
  snapshots: many(dailySnapshots),
  groupAccounts: many(groupAccounts),
  assetHistories: many(assetHistory),
}));

export const groupAccountsRelations = relations(groupAccounts, ({ one }) => ({
  group: one(groups, {
    fields: [groupAccounts.groupId],
    references: [groups.id],
  }),
  account: one(accounts, {
    fields: [groupAccounts.accountId],
    references: [accounts.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ many, one }) => ({
  holdings: many(holdings),
  status: one(accountStatuses, {
    fields: [accounts.id],
    references: [accountStatuses.accountId],
  }),
  groupAccounts: many(groupAccounts),
}));

export const accountStatusesRelations = relations(accountStatuses, ({ one }) => ({
  account: one(accounts, {
    fields: [accountStatuses.accountId],
    references: [accounts.id],
  }),
}));

export const holdingsRelations = relations(holdings, ({ one, many }) => ({
  account: one(accounts, {
    fields: [holdings.accountId],
    references: [accounts.id],
  }),
  category: one(assetCategories, {
    fields: [holdings.categoryId],
    references: [assetCategories.id],
  }),
  values: many(holdingValues),
}));

export const dailySnapshotsRelations = relations(dailySnapshots, ({ one, many }) => ({
  group: one(groups, {
    fields: [dailySnapshots.groupId],
    references: [groups.id],
  }),
  holdingValues: many(holdingValues),
}));

export const holdingValuesRelations = relations(holdingValues, ({ one }) => ({
  holding: one(holdings, {
    fields: [holdingValues.holdingId],
    references: [holdings.id],
  }),
  snapshot: one(dailySnapshots, {
    fields: [holdingValues.snapshotId],
    references: [dailySnapshots.id],
  }),
}));

export const assetHistoryRelations = relations(assetHistory, ({ one, many }) => ({
  group: one(groups, {
    fields: [assetHistory.groupId],
    references: [groups.id],
  }),
  categories: many(assetHistoryCategories),
}));

export const assetHistoryCategoriesRelations = relations(assetHistoryCategories, ({ one }) => ({
  assetHistory: one(assetHistory, {
    fields: [assetHistoryCategories.assetHistoryId],
    references: [assetHistory.id],
  }),
}));
