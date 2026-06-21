/**
 * 日興証券 持株会 探索スクリプト
 *
 * 使い方: pnpm --filter @zaim-dashboard/crawler dev:nikko-discover
 */
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "../../../.env"));
} catch {
  // .env not found
}

mkdirSync("debug", { recursive: true });

const LOGIN_URL = "https://ald.smbcnikko.co.jp/aldMemberMain.html#/login";
const GROUP_CODE = process.env.NIKKO_GROUP_CODE ?? "";
const MEMBER_CODE = process.env.NIKKO_MEMBER_CODE ?? "";
const PASSWORD = process.env.NIKKO_PASSWORD ?? "";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // balance-inquiry のレスポンスを丸ごとキャプチャ
  const capturedResponses: Record<string, unknown> = {};
  page.on("response", async (res) => {
    const url = res.url();
    if (!["xhr", "fetch"].includes(res.request().resourceType())) return;
    console.log(`  [API] ${res.status()} ${url}`);
    // 残高照会APIのレスポンスを保存
    if (url.includes("ald-next/")) {
      const endpoint = url.split("ald-next/")[1];
      try {
        const body = await res.json();
        capturedResponses[endpoint] = body;
        console.log(`    → captured: ${endpoint}`);
      } catch {
        // JSONでない場合はスキップ
      }
    }
  });

  try {
    console.log("=== 日興証券 Discovery ===");

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.locator("form .el-input__inner").first().waitFor({ state: "visible", timeout: 30000 });

    console.log("ログイン中...");
    const inputs = page.locator("form .el-input__inner");
    await inputs.nth(0).fill(GROUP_CODE);
    await inputs.nth(1).fill(MEMBER_CODE);
    await inputs.nth(2).fill(PASSWORD);
    await page.locator('button:has-text("ログインする")').first().click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    // 取扱規程同意画面
    const agreeBtn = page.locator('button:has-text("取扱規程に同意する")');
    if (await agreeBtn.isVisible()) {
      console.log("同意画面 → 同意ボタンをクリック");
      await agreeBtn.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await new Promise((r) => setTimeout(r, 3000));
    }

    console.log(`現在のURL: ${page.url()}`);
    await page.screenshot({ path: "debug/nikko-home.png", fullPage: true });

    // 全キャプチャ結果を保存
    writeFileSync("debug/nikko-api-responses.json", JSON.stringify(capturedResponses, null, 2));
    console.log(`\nキャプチャしたAPI: ${Object.keys(capturedResponses).join(", ")}`);
    console.log("=== 完了。debug/nikko-api-responses.json を確認 ===");
  } finally {
    await browser.close();
  }
}

void main();
