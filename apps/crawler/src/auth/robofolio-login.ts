import type { Page } from "playwright";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { info, log, debug } from "../logger.js";

function getCredentials() {
  const email = process.env.ROBOFOLIO_EMAIL;
  const password = process.env.ROBOFOLIO_PASSWORD;
  if (!email || !password) {
    throw new Error("ROBOFOLIO_EMAIL and ROBOFOLIO_PASSWORD must be set");
  }
  return { email, password };
}

export async function loginToRobofolio(page: Page): Promise<void> {
  const { email, password } = getCredentials();

  info("Navigating to robofolio login page...");
  await page.goto(rfUrls.login, { waitUntil: "domcontentloaded", timeout: 30000 });

  // ページが完全に読み込まれるまで待機
  await page.waitForLoadState("networkidle").catch(() => {});

  debug("Login page loaded");

  // メールアドレス入力（よく使われる属性を順にトライ）
  const emailSelector = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="user[email]"]',
    'input[id="email"]',
    'input[placeholder*="メール"]',
    'input[placeholder*="email"]',
  ].join(", ");

  const passwordSelector = [
    'input[type="password"]',
    'input[name="password"]',
    'input[name="user[password]"]',
    'input[id="password"]',
  ].join(", ");

  log("Filling email field...");
  await page.waitForSelector(emailSelector, { timeout: 10000 });
  await page.fill(emailSelector, email);

  log("Filling password field...");
  await page.fill(passwordSelector, password);

  log("Submitting login form...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.click('button[type="submit"], input[type="submit"], .btn-login, button:has-text("ログイン")'),
  ]);

  // ログイン後ページがログインページに戻っていたらエラー
  const currentUrl = page.url();
  if (currentUrl.includes("/login") || currentUrl.includes("/sign_in")) {
    // スクリーンショットを保存して詳細を確認
    await page.screenshot({ path: "debug/login-failed.png", fullPage: true }).catch(() => {});
    throw new Error(`Login failed - still on login page: ${currentUrl}`);
  }

  info("Login successful");
}
