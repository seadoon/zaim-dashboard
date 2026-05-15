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

  // If 'transactions' exists but '__drizzle_migrations' doesn't, the DB was
  // created by the old Python crawler. Pre-insert a baseline migration record
  // so Drizzle skips 0000_zaim_init.sql (which would fail with "table already exists").
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
      // created_at = journal 'when' for 0000_zaim_init, so Drizzle skips it
      sqlite
        .prepare(`INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES (?, ?)`)
        .run("bootstrap-0000-zaim-init", 1770121677895);
    }
  }

  migrate(db, { migrationsFolder: join(import.meta.dirname, "../drizzle") });

  // Ensure zaim_account_balances exists (created by Python Zaim crawler, may be absent in MF-only runs)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS zaim_account_balances (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      account_name TEXT NOT NULL,
      balance      INTEGER NOT NULL,
      updated_at   TEXT NOT NULL
    )
  `);

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
