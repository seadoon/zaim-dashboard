import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

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
