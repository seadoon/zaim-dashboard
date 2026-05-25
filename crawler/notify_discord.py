#!/usr/bin/env python3
"""Zaim クローラー完了後の Discord 通知スクリプト"""

import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone, timedelta

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
    month_prefix = now_jst.strftime("%Y-%m")
    updated_at = now_jst.strftime("%Y年%m月%d日 %H:%M JST")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # 口座残高
    accounts = conn.execute(
        "SELECT account_name, balance FROM zaim_account_balances ORDER BY balance DESC"
    ).fetchall()
    bank_total = sum(a["balance"] for a in accounts)

    # 当月収支
    row = conn.execute(
        """
        SELECT
            SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS income,
            SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END) AS expense
        FROM transactions
        WHERE date LIKE ?
        """,
        (f"{month_prefix}%",),
    ).fetchone()
    income = row["income"] or 0
    expense = row["expense"] or 0
    net = income - expense

    # 前月同日比
    if now_jst.month > 1:
        prev_month = now_jst.replace(month=now_jst.month - 1)
    else:
        prev_month = now_jst.replace(year=now_jst.year - 1, month=12)
    prev_row = conn.execute(
        """
        SELECT SUM(amount) AS expense
        FROM transactions
        WHERE type = 'payment'
          AND date LIKE ?
          AND date <= ?
        """,
        (
            prev_month.strftime("%Y-%m%%"),
            prev_month.strftime(f"%Y-%m-{now_jst.strftime('%d')}"),
        ),
    ).fetchone()
    prev_expense = prev_row["expense"] or 0

    conn.close()

    month_label = now_jst.strftime("%Y年%m月")

    lines = [
        "**💰 Zaim 更新レポート**",
        "",
        f"**銀行・現金残高** {fmt(bank_total)}",
        "",
    ]
    for a in accounts:
        lines.append(f"• {a['account_name']}: {fmt(a['balance'])}")
    if not accounts:
        lines.append("• 残高データなし")

    lines += [
        "",
        DIVIDER,
        "",
        f"**{month_label} の収支**",
        f"収入: {fmt(income)}",
        f"支出: {fmt(expense)}",
        f"差引: {fmt_signed(net)}",
    ]
    if prev_expense > 0:
        diff = expense - prev_expense
        lines.append(f"前月同日比: {fmt_signed(diff)}")

    lines += [
        "",
        DIVIDER,
        f"更新日時: {updated_at}",
    ]

    content = "\n".join(lines)
    if len(content) > DISCORD_MAX_LENGTH:
        content = content[:DISCORD_MAX_LENGTH - 3] + "..."

    send(webhook_url, content)


if __name__ == "__main__":
    main()
