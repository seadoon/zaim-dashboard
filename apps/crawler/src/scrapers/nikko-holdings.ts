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
    saveNikkoHolding(data);
    log(`日興証券 保存完了: ${data.sMeignmRyakKnj} ${data.sMotibnKbsu}株 @ ${data.sAvSyutkTnka}円`);
  } finally {
    await browser.close();
  }
}
