#!/usr/bin/env python3
"""
Zaim データ取得スクリプト

pyzaim を使って Zaim から収支データを取得し、SQLite に保存する。

環境変数:
  ZAIM_ID        - Zaim ログインID（メールアドレス）
  ZAIM_PASSWORD  - Zaim パスワード
  DB_PATH        - SQLite DB ファイルパス (省略時: data/zaim.db)
  FETCH_MONTHS   - 取得する月数 (省略時: 3)
"""

import os
import sys
import sqlite3
import logging
from datetime import date, datetime

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger(__name__)


def get_db_path() -> str:
    if path := os.environ.get("DB_PATH"):
        return path
    # スクリプトのあるディレクトリから data/ を探す
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    data_dir = os.path.join(root_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    return os.path.join(data_dir, "zaim.db")


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            zaim_id     INTEGER NOT NULL UNIQUE,
            date        TEXT NOT NULL,
            type        TEXT NOT NULL,
            category    TEXT,
            genre       TEXT,
            amount      INTEGER NOT NULL,
            place       TEXT,
            name        TEXT,
            comment     TEXT,
            from_account TEXT,
            to_account  TEXT,
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS transactions_date_idx     ON transactions (date);
        CREATE INDEX IF NOT EXISTS transactions_type_idx     ON transactions (type);
        CREATE INDEX IF NOT EXISTS transactions_category_idx ON transactions (category);
    """)
    conn.commit()


def upsert_transactions(conn: sqlite3.Connection, records: list[dict]) -> int:
    now = datetime.now().isoformat()
    sql = """
        INSERT INTO transactions
            (zaim_id, date, type, category, genre, amount,
             place, name, comment, from_account, to_account, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(zaim_id) DO UPDATE SET
            date         = excluded.date,
            type         = excluded.type,
            category     = excluded.category,
            genre        = excluded.genre,
            amount       = excluded.amount,
            place        = excluded.place,
            name         = excluded.name,
            comment      = excluded.comment,
            from_account = excluded.from_account,
            to_account   = excluded.to_account,
            updated_at   = excluded.updated_at
    """
    count = 0
    for r in records:
        raw_date = r.get("date")
        if hasattr(raw_date, "strftime"):
            record_date = raw_date.strftime("%Y-%m-%d")
        else:
            record_date = str(raw_date)[:10]

        conn.execute(sql, (
            r["id"],
            record_date,
            r.get("type", ""),
            r.get("category") or None,
            r.get("genre") or None,
            int(r.get("amount", 0)),
            r.get("place") or None,
            r.get("name") or None,
            r.get("comment") or None,
            r.get("from_account") or None,
            r.get("to_account") or None,
            now,
            now,
        ))
        count += 1
    conn.commit()
    return count


def get_months_to_fetch() -> list[tuple[int, int]]:
    """取得対象の (year, month) リストを返す（新しい順）"""
    fetch_months = int(os.environ.get("FETCH_MONTHS", "3"))
    today = date.today()
    months = []
    y, m = today.year, today.month
    for _ in range(fetch_months):
        months.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    return months


def main() -> None:
    zaim_id = os.environ.get("ZAIM_ID")
    zaim_password = os.environ.get("ZAIM_PASSWORD")

    if not zaim_id or not zaim_password:
        log.error("ZAIM_ID と ZAIM_PASSWORD を環境変数に設定してください")
        sys.exit(1)

    db_path = get_db_path()
    log.info(f"DB: {db_path}")

    months = get_months_to_fetch()
    log.info(f"取得対象: {[f'{y}/{m:02d}' for y, m in months]}")

    log.info("Zaim クローラーを初期化中...")
    from pyzaim import ZaimCrawler  # noqa: PLC0415

    crawler = ZaimCrawler(zaim_id, zaim_password, headless=True)

    conn = sqlite3.connect(db_path)
    init_db(conn)

    total = 0
    try:
        for year, month in months:
            log.info(f"{year}/{month:02d} を取得中...")
            try:
                data = crawler.get_data(year, month)
                count = upsert_transactions(conn, data)
                log.info(f"  → {count} 件")
                total += count
            except Exception as exc:
                log.error(f"{year}/{month:02d} の取得に失敗しました: {exc}")
    finally:
        conn.close()
        try:
            crawler.close()
        except Exception:
            pass

    log.info(f"完了: 合計 {total} 件を保存しました")


if __name__ == "__main__":
    main()
