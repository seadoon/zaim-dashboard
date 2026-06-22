import path from "node:path";
import { chromium } from "playwright";
import { saveNikkoHolding } from "@moneyforward-daily-action/db";
import { log, info } from "../logger.js";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {}

const LOGIN_URL = "https://ald.smbcnikko.co.jp/aldMemberMain.html#/login";

interface BalanceData {
  sMotibnKbsu: string;
  sAvSyutkTnka: string;
  sMeignmRyakKnj: string;
  sMeigaraCd: string;
  sKystKingkRuik: string;
  sSyoreiKinRuik: string;
}

/**
 * 日興の銘柄コード (例 "0072030000") から証券コード4桁 (例 "7203") を抽出。
 * Yahoo Finance で現在株価を取得する。失敗時は null。
 */
async function fetchCurrentPrice(meigaraCd: string): Promise<number | null> {
  const code = meigaraCd.substring(2, 6);
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?interval=1d&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" } },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    return json.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch {
    return null;
  }
}

export async function scrapeNikkoHoldings(): Promise<void> {
  const GROUP_CODE = process.env.NIKKO_GROUP_CODE ?? "";
  const MEMBER_CODE = process.env.NIKKO_MEMBER_CODE ?? "";
  const PASSWORD = process.env.NIKKO_PASSWORD ?? "";

  if (!GROUP_CODE || !MEMBER_CODE || !PASSWORD) {
    info("NIKKO credentials not set, skipping");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  let captured: BalanceData | null = null;

  page.on("response", async (res) => {
    if (res.url().includes("ald-next/balance-inquiry")) {
      try {
        captured = (await res.json()) as BalanceData;
      } catch {}
    }
  });

  try {
    info("日興証券 持株会 scraping start");

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.locator("form .el-input__inner").first().waitFor({ state: "visible", timeout: 30000 });

    const inputs = page.locator("form .el-input__inner");
    await inputs.nth(0).fill(GROUP_CODE);
    await inputs.nth(1).fill(MEMBER_CODE);
    await inputs.nth(2).fill(PASSWORD);
    await page.locator('button:has-text("ログインする")').first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    const agreeBtn = page.locator('button:has-text("取扱規程に同意する")');
    if (await agreeBtn.isVisible()) {
      await agreeBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await new Promise((r) => setTimeout(r, 3000));
    }

    if (!captured) throw new Error("balance-inquiry API response not captured");

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const data: BalanceData = captured!;

    // 現在株価を取得して評価額を計算（取得失敗時は null で保存）
    const price = await fetchCurrentPrice(data.sMeigaraCd);
    saveNikkoHolding(data, price);

    const shares = Number(data.sMotibnKbsu.replace(/,/g, ""));
    const valuation = price !== null ? Math.round(shares * price).toLocaleString() : "N/A";
    log(`日興証券 保存完了: ${data.sMeignmRyakKnj} ${data.sMotibnKbsu}株 @ ${data.sAvSyutkTnka}円 / 現在値 ${price ?? "N/A"}円 / 評価額 ${valuation}円`);
  } finally {
    await browser.close();
  }
}
