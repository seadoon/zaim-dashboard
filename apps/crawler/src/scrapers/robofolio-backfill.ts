import type { Page } from "playwright";
import { upsertAssetHistory, type Db } from "@moneyforward-daily-action/db";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { info, warn } from "../logger.js";

// Portfolio chart JS variable name → rf_asset_history asset_type
const VAR_TO_ASSET_TYPE: Record<string, string> = {
  stock: "株式",
  nisa: "株式(NISA)",
  margin: "信用",
  trust: "投資信託",
  trust_nisa: "投資信託(NISA)",
  foreign: "外国株",
  foreign_nisa: "外国株(NISA)",
  cash: "現金",
};

type HistoryEntry = { date: string; assetType: string; amount: number };

function parseChartData(html: string): HistoryEntry[] {
  // Matches: varName.push([Date.parse("2025-05-23"), 1234567.00]);
  const pattern = /(\w+)\.push\(\[Date\.parse\("(\d{4}-\d{2}-\d{2})"\),\s*([\d.]+)\]\)/g;
  const byVar: Record<string, Record<string, number>> = {};
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const [, varName, date, value] = match;
    if (!VAR_TO_ASSET_TYPE[varName]) continue;
    if (!byVar[varName]) byVar[varName] = {};
    byVar[varName][date] = parseFloat(value);
  }

  const entries: HistoryEntry[] = [];
  for (const [varName, dateMap] of Object.entries(byVar)) {
    const assetType = VAR_TO_ASSET_TYPE[varName]!;
    for (const [date, amount] of Object.entries(dateMap)) {
      entries.push({ date, assetType, amount: Math.round(amount) });
    }
  }
  return entries;
}

export async function backfillAssetHistory(page: Page, db: Db): Promise<void> {
  info("Backfilling asset history from portfolio chart...");
  await page.goto(rfUrls.portfolio, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  const html = await page.content();
  const entries = parseChartData(html);

  if (entries.length === 0) {
    warn("No historical chart data found on portfolio page");
    return;
  }

  const dates = [...new Set(entries.map((e) => e.date))];
  info(`Parsed ${entries.length} entries across ${dates.length} dates (${dates[0]} – ${dates[dates.length - 1]})`);

  upsertAssetHistory(entries, db);
  info("Asset history backfill complete");
}
