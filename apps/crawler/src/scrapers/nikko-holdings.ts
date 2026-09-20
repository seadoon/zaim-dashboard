import path from "node:path";
import { chromium } from "playwright";
import { saveNikkoHolding } from "@moneyforward-daily-action/db";
import { log, info } from "../logger.js";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {}

const LOGIN_URL = "https://ald.smbcnikko.co.jp/aldMemberMain.html#/login";

/** 残高照会レスポンスの待機上限。相手サイトが遅い日でも取りこぼさない長さにする */
const BALANCE_TIMEOUT_MS = 30_000;
/** 同意画面の出現待ち。出ないまま残高照会が来ることもあるので短めで打ち切る */
const AGREE_TIMEOUT_MS = 10_000;

const isBalanceInquiry = (url: string): boolean => url.includes("ald-next/balance-inquiry");

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

  // レスポンス到達を待ち受ける保険。waitForResponse より先に来た場合も取りこぼさない。
  page.on("response", async (res) => {
    if (!captured && isBalanceInquiry(res.url())) {
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

    // 残高照会レスポンスの待機はログイン操作より前に仕掛ける。
    // クリック後に仕掛けると、応答が速かったときに取りこぼす。
    const balanceResponse = page
      .waitForResponse((res) => isBalanceInquiry(res.url()), { timeout: BALANCE_TIMEOUT_MS })
      .catch(() => null);

    await page.locator('button:has-text("ログインする")').first().click();

    // 同意画面を挟む場合と、挟まずに残高照会まで進む場合がある。
    // 固定秒数で待つと相手サイトが少し遅いだけで失敗するため、
    // 「同意ボタンの出現」か「残高照会の到達」のどちらか早い方まで待つ。
    const agreeBtn = page.locator('button:has-text("取扱規程に同意する")');
    await Promise.race([
      agreeBtn.waitFor({ state: "visible", timeout: AGREE_TIMEOUT_MS }).catch(() => {}),
      balanceResponse,
    ]);
    if (await agreeBtn.isVisible().catch(() => false)) {
      await agreeBtn.click();
    }

    const res = await balanceResponse;
    if (!captured && res) {
      try {
        captured = (await res.json()) as BalanceData;
      } catch {}
    }

    const data: BalanceData | null = captured;
    if (!data) throw new Error("balance-inquiry API response not captured");

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
