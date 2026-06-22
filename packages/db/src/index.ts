import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema/schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

function getDbPath() {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }
  // Try cwd first, then try going up directories
  const cwdDataDir = join(process.cwd(), "data");
  if (existsSync(cwdDataDir)) {
    return join(cwdDataDir, "zaim.db");
  }
  // apps/web or apps/crawler -> monorepo root
  const rootDataDir = join(process.cwd(), "..", "..", "data");
  if (existsSync(rootDataDir)) {
    return join(rootDataDir, "zaim.db");
  }
  return join(cwdDataDir, "zaim.db");
}

export function isDatabaseAvailable(): boolean {
  return existsSync(getDbPath());
}

export function getDb() {
  if (!_db) {
    _sqlite = new Database(getDbPath());
    _sqlite.pragma("journal_mode = WAL");
    _db = drizzle(_sqlite, { schema });
  }
  return _db;
}

export function closeDb() {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
    _db = null;
  }
}

export type Db = ReturnType<typeof getDb>;

export function initDb() {
  const db = getDb();

  // Ensure the migrations table exists and reflects the actual state of the DB.
  // Journal when values: 0000=1770121677895, 0001=1778600833565, 0002=1778600833566,
  //                      0003=1778600833567, 0004=1778600833570
  const sqlite = _sqlite!;
  const hasMigrationsTable = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'")
    .get();
  if (!hasMigrationsTable) {
    const hasTransactions = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='transactions'")
      .get();
    if (hasTransactions) {
      sqlite.exec(
        `CREATE TABLE "__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
      );
    }
  }
  // Always catch up: if zaim_daily_bank_totals already exists in the DB but the
  // migrations table doesn't record it as applied, insert a catch-up entry so
  // Drizzle doesn't try to re-create it. This handles DBs migrated by other tools
  // or prior bootstrap failures that left the table in a partially-tracked state.
  const migrationsTableExists = sqlite
    .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'")
    .get();
  if (migrationsTableExists) {
    const lastApplied = (sqlite
      .prepare(`SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1`)
      .get() as { created_at: number } | undefined)?.created_at ?? 0;
    const hasBankHistory = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='zaim_daily_bank_totals'")
      .get();
    if (hasBankHistory && lastApplied < 1778600833566) {
      const hasCountCol = sqlite
        .prepare("SELECT 1 FROM pragma_table_info('transactions') WHERE name='count'")
        .get();
      const catchUpWhen = hasCountCol ? 1778600833567 : 1778600833566;
      sqlite
        .prepare(`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)`)
        .run("bootstrap-catch-up", catchUpWhen);
    } else if (!hasBankHistory && lastApplied === 0) {
      // Completely fresh DB with transactions table: bootstrap to 0000
      sqlite
        .prepare(`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)`)
        .run("bootstrap-pre-robofolio", 1770121677895);
    }
  }

  const migrationsFolder =
    process.env.DRIZZLE_MIGRATIONS_FOLDER ?? join(import.meta.dirname, "../drizzle");
  migrate(db, { migrationsFolder });

  // Ensure zaim_account_balances exists (created by Python Zaim crawler, may be absent in MF-only runs)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS zaim_account_balances (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      balance      INTEGER NOT NULL,
      updated_at   TEXT NOT NULL
    )
  `);
  // Add category column if missing (existing DBs won't have it)
  try { sqlite.exec(`ALTER TABLE zaim_account_balances ADD COLUMN category TEXT`); } catch {}

  return db;
}

export { schema };

export * from "./shared/utils";
export * from "./queries/transaction";
export * from "./queries/summary";
export * from "./queries/asset";
export * from "./queries/holding";
export * from "./queries/account";
export * from "./queries/zaim";
export * from "./queries/analytics";
export * from "./queries/nikko";
export * from "./repositories/save-scraped-data";
