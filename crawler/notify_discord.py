#!/usr/bin/env python3
"""Zaim クローラー完了後の Discord 通知スクリプト"""

import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone, timedelta, date

JST = timezone(timedelta(hours=9))
DISCORD_MAX_LENGTH = 2000
DIVIDER = "────────────────"


def get_db_path() -> str:
    if path := os.environ.get("DB_PATH"):
        return path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(os.path.dirname(script_dir), "data", "zaim.db")


def fmt(n: int) -> str:
    return f"¥{n:,}"


def fmt_signed(n: int) -> str:
    return f"+¥{n:,}" if n >= 0 else f"-¥{abs(n):,}"


def send(webhook_url: str, content: str) -> None:
    payload = json.dumps({"content": content})
    result = subprocess.run(
        ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
         "-X", "POST", webhook_url,
         "-H", "Content-Type: application/json",
         "-d", payload],
        capture_output=True, text=True,
    )
    code = result.stdout.strip()
    print(f"Discord: {code}")
    if code not in ("200", "204"):
        raise RuntimeError(f"Discord webhook エラー: HTTP {code}")


def main() -> None:
    webhook_url = (os.environ.get("DISCORD_WEBHOOK_URL") or "").strip()
    if not webhook_url:
        print("DISCORD_WEBHOOK_URL が未設定のためスキップ")
        return

    db_path = get_db_path()
    if not os.path.exists(db_path):
        print(f"DB が見つかりません: {db_path}")
        return

    now_jst = datetime.now(JST)
    today_str = date.today().isoformat()
    updated_at = now_jst.strftime("%Y年%m月%d日 %H:%M JST")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 銀行残高（Zaim）
    zaim_bank_total = conn.execute(
        "SELECT COALESCE(SUM(balance), 0) AS total FROM zaim_account_balances"
    ).fetchone()["total"]

    # 証券残高（MoneyForward）— 最新スナップショット
    mf_securities_total = conn.execute("""
        SELECT COALESCE(SUM(hv.amount), 0) AS total
        FROM holding_values hv
        JOIN holdings h ON h.id = hv.holding_id
        JOIN accounts a ON a.id = h.account_id
        JOIN daily_snapshots ds ON ds.id = hv.snapshot_id
        WHERE ds.id = (SELECT id FROM daily_snapshots ORDER BY date DESC LIMIT 1)
          AND h.type = 'asset'
    """).fetchone()["total"]

    total_assets = zaim_bank_total + mf_securities_total

    # 前日比（zaim_daily_bank_totals の当日 vs 前日）
    rows = conn.execute(
        "SELECT date, total FROM zaim_daily_bank_totals ORDER BY date DESC LIMIT 2"
    ).fetchall()
    daily_change = None
    if len(rows) >= 2:
        # 最新のMF証券合計を前日時点でも使う（朝時点ではMFは昨日のまま）
        daily_change = rows[0]["total"] - rows[1]["total"]

    conn.close()

    lines = [
        "**💰 資産サマリー**",
        "",
        f"**総資産** {fmt(total_assets)}",
        f"**前日比** {fmt_signed(daily_change) if daily_change is not None else '-'}",
        "",
        DIVIDER,
        "",
        "**内訳**",
        f"銀行・現金（Zaim）: {fmt(zaim_bank_total)}",
        f"証券（MoneyForward）: {fmt(mf_securities_total)}",
        "",
        DIVIDER,
        "",
        f"更新日時: {updated_at}",
    ]

    dashboard_url = (os.environ.get("DASHBOARD_URL") or "").strip()
    if dashboard_url:
        lines.append(f"ダッシュボード: {dashboard_url}")

    content = "\n".join(lines)
    if len(content) > DISCORD_MAX_LENGTH:
        content = content[:DISCORD_MAX_LENGTH - 3] + "..."

    send(webhook_url, content)


if __name__ == "__main__":
    main()
