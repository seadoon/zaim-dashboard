import type { Page } from "playwright";
import type { RfHoldingInput } from "@moneyforward-daily-action/db/repository/save-scraped-data";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { log, debug, warn } from "../logger.js";

const CELL_TIMEOUT = 2000;

async function getText(locator: import("playwright").Locator, fallback = ""): Promise<string> {
  try {
    return (await locator.textContent({ timeout: CELL_TIMEOUT }))?.trim() ?? fallback;
  } catch {
    return fallback;
  }
}

function parseAmount(text: string): number {
  // "1,234,567円" や "+1,234" や "-1,234" などをパース
  const cleaned = text.replace(/[¥円,\s]/g, "").replace(/[^\d.\-+]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

function parseDecimal(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parsePercent(text: string): number | null {
  const cleaned = text.replace(/[%\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * robofolio のポートフォリオページから保有銘柄を取得する。
 *
 * NOTE: セレクターはローカルでの探索スクリプト実行後に確定する。
 * 現在はよく使われるパターンに基づいた実装で、実際の HTML に合わせて調整が必要。
 */
export async function scrapeHoldings(page: Page): Promise<RfHoldingInput[]> {
  log("Navigating to portfolio page...");
  await page.goto(rfUrls.portfolio, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  // デバッグ: スクリーンショットとHTMLダンプ
  await page.screenshot({ path: "debug/portfolio.png", fullPage: true }).catch(() => {});
  debug("Portfolio page screenshot saved");

  const holdings: RfHoldingInput[] = [];

  // --- 方式1: テーブルベースのスクレイピング ---
  // robofolio は broker（証券会社）ごとにセクションを分けている可能性が高い
  // まずテーブルの存在を確認
  const tableCount = await page.locator("table").count();
  log(`Found ${tableCount} tables on portfolio page`);

  if (tableCount > 0) {
    holdings.push(...(await scrapeFromTables(page)));
  }

  // --- 方式2: リストベース（テーブルがない場合） ---
  if (holdings.length === 0) {
    holdings.push(...(await scrapeFromList(page)));
  }

  if (holdings.length === 0) {
    warn("No holdings found. The page structure may have changed.");
    // HTMLをダンプして構造を確認できるようにする
    const html = await page.content();
    const { writeFileSync, mkdirSync } = await import("node:fs");
    mkdirSync("debug", { recursive: true });
    writeFileSync("debug/portfolio.html", html);
    log("HTML dumped to debug/portfolio.html for inspection");
  }

  log(`Scraped ${holdings.length} holdings`);
  return holdings;
}

async function scrapeFromTables(page: Page): Promise<RfHoldingInput[]> {
  const holdings: RfHoldingInput[] = [];

  // ページ内のすべてのテーブルを走査
  const tables = page.locator("table");
  const count = await tables.count();

  for (let t = 0; t < count; t++) {
    const table = tables.nth(t);

    // テーブルの直前の見出しからブローカー名を取得
    const brokerName = await table.evaluate((el) => {
      let prev = el.previousElementSibling;
      while (prev) {
        const text = prev.textContent?.trim();
        if (text && text.length > 0 && text.length < 50) return text;
        prev = prev.previousElementSibling;
      }
      // フォールバック: h1-h4 を親の中から探す
      const heading = el.closest("section, div")?.querySelector("h1, h2, h3, h4");
      return heading?.textContent?.trim() ?? "不明";
    });

    debug(`Table ${t}: broker="${brokerName}"`);

    const headers = await table.locator("thead th, thead td").allTextContents();
    debug(`  Headers: ${headers.join(", ")}`);

    // ヘッダーからカラムインデックスを動的に判定
    const col = detectColumns(headers);

    const rows = table.locator("tbody tr");
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const cells = rows.nth(i).locator("td");
      const cellCount = await cells.count();
      if (cellCount < 3) continue;

      const name = col.name !== -1 ? await getText(cells.nth(col.name)) : "";
      if (!name) continue;

      const code = col.code !== -1 ? (await getText(cells.nth(col.code))) || null : null;
      const assetType = detectAssetType(code, name);
      const quantityText = col.quantity !== -1 ? await getText(cells.nth(col.quantity)) : "";
      const avgCostText = col.avgCost !== -1 ? await getText(cells.nth(col.avgCost)) : "";
      const unitPriceText = col.unitPrice !== -1 ? await getText(cells.nth(col.unitPrice)) : "";
      const amountText = col.amount !== -1 ? await getText(cells.nth(col.amount)) : "0";
      const unrealizedText = col.unrealized !== -1 ? await getText(cells.nth(col.unrealized)) : "";
      const unrealizedPctText = col.unrealizedPct !== -1 ? await getText(cells.nth(col.unrealizedPct)) : "";
      const dailyChangeText = col.dailyChange !== -1 ? await getText(cells.nth(col.dailyChange)) : "";

      holdings.push({
        broker: brokerName,
        code: code || null,
        name,
        assetType,
        quantity: parseDecimal(quantityText),
        avgCostPrice: parseDecimal(avgCostText),
        unitPrice: parseDecimal(unitPriceText),
        amount: parseAmount(amountText),
        unrealizedGain: unrealizedText ? parseAmount(unrealizedText) : null,
        unrealizedGainPct: unrealizedPctText ? parsePercent(unrealizedPctText) : null,
        dailyChange: dailyChangeText ? parseAmount(dailyChangeText) : null,
      });
    }
  }

  return holdings;
}

async function scrapeFromList(page: Page): Promise<RfHoldingInput[]> {
  // テーブルがない場合のフォールバック: 一般的なリスト構造を試みる
  const items = page.locator("[data-holding], .holding-row, .stock-row, li.holding");
  const count = await items.count();
  if (count === 0) return [];

  const holdings: RfHoldingInput[] = [];
  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const text = await item.textContent();
    debug(`List item ${i}: ${text?.slice(0, 80)}`);
    // テキストベースの解析は構造確認後に実装
  }
  return holdings;
}

/** ヘッダーテキストからカラムインデックスを判定 */
function detectColumns(headers: string[]) {
  const find = (...keywords: string[]) => {
    const idx = headers.findIndex((h) =>
      keywords.some((k) => h.includes(k)),
    );
    return idx;
  };

  return {
    code: find("コード", "銘柄コード", "ticker", "code"),
    name: find("銘柄名", "名称", "name", "銘柄"),
    quantity: find("保有数", "数量", "口数", "qty"),
    avgCost: find("平均取得", "取得単価", "平均"),
    unitPrice: find("現在値", "株価", "基準価額", "単価"),
    amount: find("評価額", "時価", "残高", "金額"),
    unrealized: find("含み損益", "評価損益", "損益"),
    unrealizedPct: find("損益率", "損益%", "%"),
    dailyChange: find("前日比", "前日差"),
  };
}

/** 銘柄コードや名前から資産タイプを推定 */
function detectAssetType(code: string | null, name: string): string {
  if (!code) {
    // コードなし → 投資信託の可能性が高い
    if (name.includes("ファンド") || name.includes("投信") || name.includes("インデックス")) {
      return "投資信託";
    }
    return "投資信託";
  }
  if (/^\d{4}$/.test(code)) return "株式";
  if (/^\d{5}$/.test(code)) return "ETF";
  if (/^[A-Z]{1,5}$/.test(code)) return "米国株";
  return "その他";
}
