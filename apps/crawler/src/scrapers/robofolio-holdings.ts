import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";
import type { RfHoldingInput } from "@moneyforward-daily-action/db";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { log, info, warn } from "../logger.js";

function parseAmount(text: string): number {
  const cleaned = text.replace(/[¥円,\s]/g, "").replace(/[^\d.\-+]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.round(n);
}

function parseDecimal(text: string): number | null {
  const cleaned = text.replace(/[株口,\s円]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parsePercent(text: string): number | null {
  const cleaned = text.replace(/[%\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseDailyChange(text: string): number | null {
  // 形式: (-328.00円/-0.73%) または (+1,234円/+0.12%)
  const match = text.match(/\(([+\-][\d,.]+)円\//);
  if (!match) return null;
  const n = parseFloat(match[1].replace(/,/g, ""));
  return isNaN(n) ? null : Math.round(n);
}

function detectAssetTypeFromClass(rowClass: string): string {
  if (rowClass.includes("list-trust_nisa")) return "投資信託(NISA)";
  if (rowClass.includes("list-trust")) return "投資信託";
  if (rowClass.includes("list-nisa")) return "株式(NISA)";
  if (rowClass.includes("list-foreign_nisa")) return "外国株(NISA)";
  if (rowClass.includes("list-foreign")) return "外国株";
  if (rowClass.includes("list-margin")) return "信用";
  if (rowClass.includes("list-stock")) return "株式";
  return "その他";
}

export async function triggerCrawlIfReady(page: Page): Promise<void> {
  info("Navigating to portfolio page to check crawling button...");
  await page.goto(rfUrls.portfolio, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  const btn = page.locator("#crawling-btn");
  const status = await btn.getAttribute("data-status").catch(() => null);
  info(`#crawling-btn data-status="${status}"`);

  if (status !== "1") {
    info("Crawling not needed (already running or recently completed)");
    return;
  }

  info("Clicking crawling button...");
  await btn.click();

  await page.locator(".icon-crawling").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  info("Crawling started, waiting for completion...");

  await page.locator(".icon-crawling").waitFor({ state: "hidden", timeout: 300000 });
  info("Crawl complete");
}

export async function scrapeHoldings(page: Page): Promise<RfHoldingInput[]> {
  log("Navigating to portfolio page...");
  await page.goto(rfUrls.portfolio, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  mkdirSync("debug", { recursive: true });
  await page.screenshot({ path: "debug/portfolio.png", fullPage: true }).catch(() => {});
  writeFileSync("debug/portfolio.html", await page.content().catch(() => ""));

  const holdings: RfHoldingInput[] = [];

  // 証券会社ごとのカード (.sh-account-block > .card.card-table) を走査
  const brokerCards = page.locator(".sh-account-block .card.card-table");
  const cardCount = await brokerCards.count();
  info(`Found ${cardCount} broker cards`);

  for (let i = 0; i < cardCount; i++) {
    const card = brokerCards.nth(i);

    // ブローカー名: button.title から <i> タグを除いたテキスト
    const brokerName = await card
      .locator(".sh-stock-table-header button.title")
      .evaluate((el) => {
        const clone = el.cloneNode(true) as Element;
        clone.querySelectorAll("i").forEach((icon) => icon.remove());
        return clone.textContent?.trim() ?? "不明";
      })
      .catch(() => "不明");

    info(`Broker ${i + 1}: ${brokerName}`);

    const rows = card.locator(".sh-stock-table tbody tr");
    const rowCount = await rows.count();

    for (let j = 0; j < rowCount; j++) {
      const row = rows.nth(j);

      // 銘柄コード
      const code = await row
        .locator(".c01 .sh-en")
        .textContent()
        .then((t) => t?.trim() || null)
        .catch(() => null);

      // 銘柄名 (<small> タグの口座種別表記を除去)
      const nameRaw = await row
        .locator(".c02 .name.sh-table-col-name")
        .textContent()
        .catch(() => "");
      const name = (nameRaw ?? "").replace(/\s*（\s*\/[^）]*）\s*$/, "").trim();
      if (!name) continue;

      // 資産タイプ (trのclassから判定)
      const rowClass = (await row.getAttribute("class")) ?? "";
      const assetType = detectAssetTypeFromClass(rowClass);

      // 評価額・評価損益・評価損益率 (c03〜c05)
      const amountText = await row.locator(".c03 .sh-en").textContent().catch(() => "0");
      const unrealizedText = await row.locator(".c04 .sh-en").textContent().catch(() => "");
      const unrealizedPctText = await row.locator(".c05 .sh-en").textContent().catch(() => "");

      // 明細 (平均取得単価・保有株数・現在値・前日比)
      const details = await row
        .locator(".c02 .lower .row")
        .evaluate((el) => {
          const cols = el.querySelectorAll(":scope > div");
          return {
            avgCost: cols[0]?.querySelector(".sh-en")?.textContent?.trim() ?? "",
            quantity: cols[1]?.querySelector(".sh-en")?.textContent?.trim() ?? "",
            unitPrice: cols[2]?.querySelector(".sh-unit-yen")?.textContent?.trim() ?? "",
            dailyChangeText:
              cols[2]?.querySelector(".sh-text-plus, .sh-text-minus")?.textContent?.trim() ?? "",
          };
        })
        .catch(() => ({ avgCost: "", quantity: "", unitPrice: "", dailyChangeText: "" }));

      holdings.push({
        broker: brokerName,
        code,
        name,
        assetType,
        quantity: parseDecimal(details.quantity),
        avgCostPrice: parseDecimal(details.avgCost),
        unitPrice: parseDecimal(details.unitPrice),
        amount: parseAmount(amountText ?? "0"),
        unrealizedGain: unrealizedText ? parseAmount(unrealizedText) : null,
        unrealizedGainPct: unrealizedPctText ? parsePercent(unrealizedPctText) : null,
        dailyChange: details.dailyChangeText ? parseDailyChange(details.dailyChangeText) : null,
      });
    }
  }

  if (holdings.length === 0) {
    warn("No holdings found. The page structure may have changed.");
  }

  log(`Scraped ${holdings.length} holdings`);
  return holdings;
}
