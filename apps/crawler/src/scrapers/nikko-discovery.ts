/**
 * 日興証券 持株会 探索スクリプト
 *
 * 使い方: pnpm --filter @zaim-dashboard/crawler dev:nikko-discover
 *
 * ログイン前後のページ構造を debug/ に保存する。
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

async function dumpPage(page: import("playwright").Page, name: string) {
  await page.screenshot({ path: `debug/nikko-${name}.png`, fullPage: true });
  writeFileSync(`debug/nikko-${name}.html`, await page.content());
  console.log(`[nikko] Saved debug/nikko-${name}.png`);

  // フォーム要素を列挙
  const inputs = await page.locator("input").all();
  console.log(`[nikko] [${name}] Found ${inputs.length} inputs:`);
  for (const inp of inputs) {
    const type = await inp.getAttribute("type").catch(() => null);
    const name_ = await inp.getAttribute("name").catch(() => null);
    const id = await inp.getAttribute("id").catch(() => null);
    const placeholder = await inp.getAttribute("placeholder").catch(() => null);
    console.log(`  input type=${type} name=${name_} id=${id} placeholder=${placeholder}`);
  }

  const buttons = await page.locator("button, [role=button], a[href]").all();
  console.log(`[nikko] [${name}] Found ${buttons.length} buttons/links`);
  for (const btn of buttons.slice(0, 10)) {
    const text = await btn.textContent().catch(() => null);
    const href = await btn.getAttribute("href").catch(() => null);
    if (text?.trim()) console.log(`  button/link: "${text?.trim()}" href=${href}`);
  }

  // テーブル
  const tables = await page.locator("table").all();
  console.log(`[nikko] [${name}] Found ${tables.length} tables`);
  for (let i = 0; i < tables.length; i++) {
    const headers = await tables[i].locator("thead th, thead td, th").allTextContents();
    const rowCount = await tables[i].locator("tbody tr, tr").count();
    console.log(`  Table[${i}]: headers=[${headers.join(", ")}] rows=${rowCount}`);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // API リクエストをキャプチャ
  const apiRequests: string[] = [];
  page.on("request", (req) => {
    if (["xhr", "fetch"].includes(req.resourceType())) {
      apiRequests.push(`${req.method()} ${req.url()}`);
      console.log(`  [API] ${req.method()} ${req.url()}`);
    }
  });
  page.on("response", (res) => {
    if (["xhr", "fetch"].includes(res.request().resourceType())) {
      console.log(`  [API res] ${res.status()} ${res.url()}`);
    }
  });

  try {
    console.log("=== 日興証券 Discovery ===");
    console.log(`NIKKO_GROUP_CODE: ${GROUP_CODE ? "set" : "NOT SET"}`);

    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    // Vue.js SPA: フォームが描画されるまで待つ
    await page.locator("form .el-input__inner").first().waitFor({ state: "visible", timeout: 30000 });
    await dumpPage(page, "login");

    if (!GROUP_CODE || !MEMBER_CODE || !PASSWORD) {
      console.log("NIKKO_GROUP_CODE/NIKKO_MEMBER_CODE/NIKKO_PASSWORD not set. Stopping before login.");
      return;
    }

    // ログイン試行
    // フォーム内の .el-input__inner が 持株会コード・会員コード・パスワードの順
    console.log("\n=== Attempting login ===");
    const inputs = page.locator("form .el-input__inner");
    await inputs.nth(0).fill(GROUP_CODE);
    await inputs.nth(1).fill(MEMBER_CODE);
    await inputs.nth(2).fill(PASSWORD);
    await dumpPage(page, "before-submit");

    // ログインボタンクリック
    const loginBtn = page.locator('button:has-text("ログインする")').first();
    await loginBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, 3000));
    await dumpPage(page, "after-login");

    console.log(`\nCurrent URL: ${page.url()}`);

    // API リクエスト保存
    writeFileSync("debug/nikko-api-requests.txt", apiRequests.join("\n"));
    console.log(`Captured ${apiRequests.length} API requests`);

    console.log("=== Discovery complete. Check debug/nikko-* files. ===");
  } finally {
    await browser.close();
  }
}

void main();
