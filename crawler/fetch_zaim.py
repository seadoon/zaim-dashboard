#!/usr/bin/env python3
"""
Zaim データ取得スクリプト

pyzaim (1.x) を使って Zaim から収支データを取得し、SQLite に保存する。
ログイン部分は WebDriverWait で独自実装し、ページ変更に対応する。

pyzaim 1.x のトランザクションフィールド:
  id, date (datetime.date), type (payment/income/transfer),
  genre (カテゴリ名), account (口座名), amount (int),
  place (店舗名), name (品目名), comment

環境変数:
  ZAIM_ID        - Zaim ログイン ID（メールアドレス）
  ZAIM_PASSWORD  - Zaim パスワード
  DB_PATH        - SQLite DB ファイルパス (省略時: data/zaim.db)
  FETCH_MONTHS   - 取得する月数 (省略時: 3)
"""

import os
import sys
import sqlite3
import logging
import time
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

        CREATE TABLE IF NOT EXISTS zaim_account_balances (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            account_name TEXT NOT NULL,
            balance      INTEGER NOT NULL,
            updated_at   TEXT NOT NULL
        );
    """)
    conn.commit()


def scrape_account_balances(driver) -> list[dict]:
    """Zaim の口座一覧ページから口座名と残高を取得する。"""
    import re
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    # Zaim の口座ページ候補 (URL が変わることがあるため複数試す)
    candidate_urls = [
        "https://zaim.net/home",
        "https://zaim.net/user_accounts",
        "https://zaim.net/accounts",
    ]

    # 残高が含まれそうなURLを試す（zaim.net/money が実際のダッシュボード）
    candidate_urls = [
        "https://zaim.net/money",
        "https://zaim.net/user_accounts",
        "https://zaim.net/accounts",
        "https://zaim.net/home",
    ]

    candidate_selectors = [
        # 口座残高セクション向け (サイドバーや右カラム)
        "#bs-account-list li",
        ".account-list li",
        "[class*='account-list'] li",
        "[class*='AccountList'] li",
        "[class*='user-account'] li",
        # テーブル行
        "#account_tbody tr",
        "table.account tbody tr",
        # 汎用リスト
        "ul.account li",
    ]

    accounts = []
    try:
        for url in candidate_urls:
            driver.get(url)
            wait = WebDriverWait(driver, 15)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(4)

            title = driver.title
            log.info("試行 URL: %s  タイトル: %s", driver.current_url, title)

            if "見つかりません" in title or "not found" in title.lower():
                log.warning("404のためスキップ: %s", url)
                continue

            html = driver.page_source
            # "残高" を含む周辺 HTML を抽出してデバッグ
            idx = html.find("残高")
            if idx >= 0:
                log.info("'残高'発見 (位置 %d):\n%s", idx, html[max(0, idx-200):idx+500])
            else:
                log.warning("'残高'キーワードが見つかりません — ログイン済みか確認が必要")
                log.info("ページソース (先頭5000文字):\n%s", html[:5000])

            for sel in candidate_selectors:
                rows = driver.find_elements(By.CSS_SELECTOR, sel)
                if rows:
                    log.info("セレクター '%s' で %d 件発見", sel, len(rows))
                    for r in rows[:5]:
                        log.info("  row: %s", r.text.strip()[:100])
                    break

            break  # 最初の有効なページだけ調査

    except Exception as exc:
        log.error("口座残高スクレイピング失敗: %s", exc)

    return accounts


def upsert_account_balances(conn: sqlite3.Connection, accounts: list[dict]) -> int:
    """zaim_account_balances テーブルを全件置き換え。"""
    if not accounts:
        return 0
    now = datetime.now().isoformat()
    conn.execute("DELETE FROM zaim_account_balances")
    sql = "INSERT INTO zaim_account_balances (account_name, balance, updated_at) VALUES (?, ?, ?)"
    for a in accounts:
        conn.execute(sql, (a["account_name"], a["balance"], now))
    conn.commit()
    return len(accounts)


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

        tx_type = r.get("type", "")

        # pyzaim 1.x: genre = カテゴリ名, account = 口座名
        genre = r.get("genre") or None
        account = r.get("account") or None

        from_account = account if tx_type in ("payment", "transfer") else None
        to_account = account if tx_type == "income" else None

        conn.execute(sql, (
            r["id"],
            record_date,
            tx_type,
            genre,   # category カラムにも genre を格納
            genre,   # genre カラム
            int(r.get("amount", 0)),
            r.get("place") or None,
            r.get("name") or None,
            r.get("comment") or None,
            from_account,
            to_account,
            now,
            now,
        ))
        count += 1
    conn.commit()
    return count


def _dump_page_debug(driver, year: int, month: int) -> None:
    """失敗時に現在のページのURL・クラス名・HTMLをログ出力する。"""
    import re
    try:
        log.error("[DEBUG] 現在URL: %s", driver.current_url)
        # JSレンダリングをさらに待つ
        time.sleep(3)
        html = driver.page_source
        # すべてのクラス名を抽出
        all_classes = re.findall(r'class="([^"]+)"', html)
        unique = sorted({
            cls
            for group in all_classes
            for cls in group.split()
        })
        log.error("[DEBUG] 全クラス名 (%d種): %s", len(unique), unique[:80])
        log.error("[DEBUG] ページソース (先頭8000文字):\n%s", html[:8000])
    except Exception as e:
        log.error("[DEBUG] デバッグ情報取得失敗: %s", e)


def get_months_to_fetch() -> list[tuple[int, int]]:
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


def get_chromedriver_path() -> str:
    """webdriver-manager で ChromeDriver パスを取得する。"""
    from webdriver_manager.chrome import ChromeDriverManager
    return ChromeDriverManager().install()


def create_crawler(zaim_id: str, zaim_password: str, driver_path: str, headless: bool = True):
    """
    pyzaim の ZaimCrawler インスタンスを生成する。
    zaim.net から始めてリダイレクト先でログインし、
    zaim.net に戻るまで待機してセッションを確立する。
    """
    from selenium.webdriver import Chrome
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from pyzaim import ZaimCrawler

    options = Options()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    if headless:
        options.add_argument("--headless=new")

    service = Service(driver_path)
    driver = Chrome(service=service, options=options)

    try:
        # zaim.net/money から開始 → 未ログイン時は id.kufu.jp へリダイレクトされる
        log.info("zaim.net にアクセス中...")
        driver.get("https://zaim.net/money")

        wait = WebDriverWait(driver, 30)

        # ログインページ (id.kufu.jp) の input が現れるまで待機
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input")))
        log.info("ログインページ URL: %s", driver.current_url)

        # メールフィールドを複数のセレクターで即時チェック
        email_selectors = [
            (By.ID, "email_or_id"),
            (By.NAME, "email_or_id"),
            (By.CSS_SELECTOR, "input.kufu-input:not([type='password'])"),
            (By.CSS_SELECTOR, "input[type='email']"),
            (By.CSS_SELECTOR, "input[autocomplete='email']"),
            (By.XPATH, "//input[not(@type='password') and not(@type='hidden')]"),
        ]

        email_field = None
        for by, selector in email_selectors:
            try:
                email_field = driver.find_element(by, selector)
                log.info("メールフィールド発見: %s=%s", by, selector)
                break
            except Exception:
                continue

        if email_field is None:
            driver.save_screenshot("/tmp/zaim-login-debug.png")
            log.error("ページソース (先頭2000文字):\n%s", driver.page_source[:2000])
            raise RuntimeError("Zaim ログインページのメールフィールドが見つかりません")

        email_field.clear()
        email_field.send_keys(zaim_id)

        # パスワードフィールド
        password_field = None
        for by, selector in [
            (By.ID, "password"),
            (By.NAME, "password"),
            (By.CSS_SELECTOR, "input[type='password']"),
        ]:
            try:
                password_field = driver.find_element(by, selector)
                log.info("パスワードフィールド発見: %s=%s", by, selector)
                break
            except Exception:
                continue

        if password_field is None:
            driver.save_screenshot("/tmp/zaim-login-debug.png")
            raise RuntimeError("Zaim ログインページのパスワードフィールドが見つかりません")

        password_field.send_keys(zaim_password, Keys.ENTER)

        # ログイン後に zaim.net に戻るまで待機（id.kufu.jp → zaim.net のリダイレクト完了）
        wait.until(lambda d: "zaim.net" in d.current_url and "id." not in d.current_url)
        log.info("ログイン完了 (URL: %s)", driver.current_url)

    except Exception:
        log.error("ログイン失敗。現在 URL: %s", driver.current_url)
        driver.quit()
        raise

    # pyzaim の ZaimCrawler インスタンスを手動構築（ログインは上で完了済み）
    crawler = ZaimCrawler.__new__(ZaimCrawler)
    crawler.driver = driver
    crawler.data = []
    crawler.current = 0
    return crawler


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

    log.info("ChromeDriver を準備中...")
    driver_path = get_chromedriver_path()
    log.info(f"ChromeDriver: {driver_path}")

    log.info("Zaim クローラーを初期化中...")
    crawler = create_crawler(zaim_id, zaim_password, driver_path, headless=True)

    conn = sqlite3.connect(db_path)
    init_db(conn)

    total = 0
    balance_count = 0
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
                _dump_page_debug(crawler.driver, year, month)

        log.info("口座残高を取得中...")
        accounts = scrape_account_balances(crawler.driver)
        balance_count = upsert_account_balances(conn, accounts)
        log.info(f"口座残高: {balance_count} 件を保存しました")
    finally:
        conn.close()
        try:
            crawler.close()
        except Exception:
            pass

    log.info(f"完了: トランザクション {total} 件、口座残高 {balance_count} 件を保存しました")


if __name__ == "__main__":
    main()
