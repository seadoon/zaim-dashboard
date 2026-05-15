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
    import json
    import requests as req
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    accounts = []
    try:
        # ── Step 1: money ページで JS 状態・DOM 要素・リンクを調査 ──────────────
        driver.get("https://zaim.net/money")
        wait = WebDriverWait(driver, 20)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(6)  # SPA の JS レンダリングを待つ

        log.info("[STEP1] URL=%s  title=%s", driver.current_url, driver.title)

        # JavaScript 状態オブジェクトの探索
        js_state = driver.execute_script("""
            var r = {};
            ['__INITIAL_STATE__','__NEXT_DATA__','__REDUX_STATE__','__APP_STATE__','Zaim','App'].forEach(function(k){
                if(window[k]!==undefined) r[k]=JSON.stringify(window[k]).substring(0,600);
            });
            r._windowKeys = Object.keys(window).filter(function(k){
                var l=k.toLowerCase();
                return l.includes('account')||l.includes('balance')||l.includes('zaim')||l.includes('asset');
            }).slice(0,20);
            return r;
        """)
        log.info("[JS状態] %s", json.dumps(js_state, ensure_ascii=False)[:3000])

        # ページ内のすべての数値要素（金額候補）を抽出
        yen_els = driver.execute_script("""
            var res=[];
            document.querySelectorAll('*').forEach(function(el){
                if(el.children.length>0) return;
                var t=el.textContent.trim();
                if((/[¥￥]/.test(t)||/^[-]?[\\d,]{3,}$/.test(t)) && t.length<40){
                    var p=el.parentElement;
                    res.push({tag:el.tagName, cls:el.className.substring(0,60),
                               id:el.id, text:t,
                               parentCls:(p?p.className:'').substring(0,60)});
                }
            });
            return res.slice(0,120);
        """)
        log.info("[金額要素 %d件]", len(yen_els))
        for el in yen_els[:40]:
            log.info("  %s", json.dumps(el, ensure_ascii=False))

        # ページ内リンク（内部ナビゲーション候補）
        nav_links = driver.execute_script("""
            var res=[];
            document.querySelectorAll('a[href]').forEach(function(a){
                var h=a.getAttribute('href');
                if(h&&(h.startsWith('/')||h.includes('zaim.net'))){
                    res.push({href:h, text:a.textContent.trim().substring(0,30)});
                }
            });
            return res.slice(0,60);
        """)
        log.info("[内部リンク %d件]:", len(nav_links))
        for lk in nav_links[:30]:
            log.info("  %s", json.dumps(lk, ensure_ascii=False))

        # ── Step 2: セッションクッキーで API エンドポイントを直接呼び出し ────────
        user_agent = driver.execute_script("return navigator.userAgent")
        cookies_raw = driver.get_cookies()
        session = req.Session()
        for c in cookies_raw:
            session.cookies.set(c["name"], c["value"], domain=".zaim.net")

        api_headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": "https://zaim.net/money",
            "User-Agent": user_agent,
        }

        for endpoint in [
            "https://zaim.net/api/v2/home",
            "https://zaim.net/api/v2/account",
            "https://zaim.net/api/v2/accounts",
            "https://zaim.net/api/v2/user/accounts",
            "https://zaim.net/home.json",
            "https://zaim.net/accounts.json",
            "https://zaim.net/money.json",
        ]:
            try:
                resp = session.get(endpoint, headers=api_headers, timeout=10, allow_redirects=False)
                body = resp.text[:400]
                log.info("[API] %s → %d: %s", endpoint, resp.status_code, body)
            except Exception as e:
                log.warning("[API] %s エラー: %s", endpoint, e)

        # ── Step 3: 銀行名・キーワードでページソースを検索 ─────────────────────
        html = driver.page_source
        for kw in ["楽天銀行", "三菱UFJ", "住信SBI", "イオン銀行", "口座残高", "総資産", "手動口座", "user_account", "accountBalance", "accountName"]:
            idx = html.find(kw)
            if idx >= 0:
                snippet = html[max(0, idx - 80):idx + 200].replace("\n", " ")
                log.info("[KW:%s] 位置%d: %s", kw, idx, snippet)

        # ── Step 4: /accounts URL を試す ─────────────────────────────────────
        for url in ["https://zaim.net/accounts", "https://zaim.net/account", "https://zaim.net/user_accounts"]:
            driver.get(url)
            wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
            time.sleep(3)
            log.info("[STEP4] %s → url=%s title=%s", url, driver.current_url, driver.title)
            page_html = driver.page_source
            if "口座" in page_html and "残高" in page_html:
                log.info("[STEP4] 「口座」「残高」両方あり — HTML(先頭8000):\n%s", page_html[:8000])
            else:
                log.info("[STEP4] 口座残高セクションなし (html_len=%d)", len(page_html))

    except Exception as exc:
        import traceback
        log.error("口座残高スクレイピング失敗: %s\n%s", exc, traceback.format_exc())

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
