/**
 * robofolio 探索スクリプト
 *
 * 使い方: pnpm --filter @zaim-dashboard/crawler dev:discover
 *
 * ログイン後に各ページのスクリーンショットとHTML構造をdebug/に保存する。
 * これを実行してdebug/ディレクトリの内容を確認し、セレクターを確定させる。
 */
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { loginToRobofolio } from "../auth/robofolio-login.js";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { log, info } from "../logger.js";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {
  // .env not found
}

mkdirSync("debug", { recursive: true });

async function dumpPage(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: `debug/${name}.png`, fullPage: true });
  writeFileSync(`debug/${name}.html`, await page.content());
  log(`Saved debug/${name}.png and debug/${name}.html`);

  // テーブル構造のサマリーを出力
  const tables = await page.locator("table").all();
  info(`[${name}] Found ${tables.length} tables`);
  for (let i = 0; i < tables.length; i++) {
    const headers = await tables[i].locator("thead th, thead td").allTextContents();
    const rowCount = await tables[i].locator("tbody tr").count();
    info(`  Table[${i}]: headers=[${headers.join(", ")}] rows=${rowCount}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    info("=== robofolio Discovery ===");

    await loginToRobofolio(page);
    await dumpPage(page, "home");

    info("Navigating to portfolio page...");
    await page.goto(rfUrls.portfolio, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpPage(page, "portfolio");

    info("Navigating to history page...");
    await page.goto(rfUrls.history, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await dumpPage(page, "history");

    // チャートAPIのリクエストをキャプチャ
    info("Intercepting API requests on history page...");
    const apiRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (req.resourceType() === "xhr" || req.resourceType() === "fetch") {
        apiRequests.push(`${req.method()} ${url}`);
        info(`  API: ${req.method()} ${url}`);
      }
    });
    // チャートデータ読み込み待ち
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    writeFileSync("debug/api-requests.txt", apiRequests.join("\n"));
    info(`Captured ${apiRequests.length} API requests`);

    info("Navigating to profit/weekly page...");
    await page.goto(`${rfUrls.history}profit/weekly`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    await dumpPage(page, "profit-weekly");

    info("=== Discovery complete. Check debug/ directory. ===");
  } finally {
    await browser.close();
  }
}

void main();
