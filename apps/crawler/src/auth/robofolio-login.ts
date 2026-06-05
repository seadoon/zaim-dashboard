import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { info, log, debug, warn } from "../logger.js";

function getCredentials() {
  const email = process.env.ROBOFOLIO_EMAIL;
  const password = process.env.ROBOFOLIO_PASSWORD;
  if (!email || !password) {
    throw new Error("ROBOFOLIO_EMAIL and ROBOFOLIO_PASSWORD must be set");
  }
  return { email, password };
}

async function saveDebug(page: Page, name: string) {
  mkdirSync("debug", { recursive: true });
  await page.screenshot({ path: `debug/${name}.png`, fullPage: true }).catch(() => {});
  writeFileSync(`debug/${name}.html`, await page.content().catch(() => ""));
  log(`Debug saved: debug/${name}.png`);
}

export async function loginToRobofolio(page: Page): Promise<void> {
  const { email, password } = getCredentials();

  info("Navigating to robofolio login page...");
  await page.goto(rfUrls.login, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  await saveDebug(page, "login-page");

  // ページのすべてのinputフィールドをログに出す（デバッグ用）
  const inputs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("input")).map((el) => ({
      type: el.type,
      name: el.name,
      id: el.id,
      placeholder: el.placeholder,
      className: el.className.slice(0, 50),
    })),
  );
  log(`Input fields on login page: ${JSON.stringify(inputs)}`);

  // メールアドレス/ログインID入力
  // 実際のフィールド: input[name="login_id"], input[id="username"]
  const emailSelector = [
    'input[name="login_id"]',
    'input[id="username"]',
    'input[type="email"]',
    'input[name="email"]',
    'input[name="user[email]"]',
    'input[id="email"]',
    'input[placeholder*="メール"]',
    'input[placeholder*="email"]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
  ].join(", ");

  const passwordSelector = [
    'input[type="password"]',
    'input[name="password"]',
    'input[name="user[password]"]',
    'input[id="password"]',
  ].join(", ");

  log("Filling email field...");
  const emailInput = page.locator(emailSelector).first();
  const emailVisible = await emailInput.isVisible().catch(() => false);
  if (!emailVisible) {
    warn(`Email field not found with selector. Available inputs: ${JSON.stringify(inputs)}`);
    await saveDebug(page, "login-no-email-field");
    throw new Error("Email input field not found on login page");
  }
  await emailInput.fill(email);

  log("Filling password field...");
  await page.fill(passwordSelector, password);

  log("Submitting login form...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);

  let currentUrl = page.url();
  log(`After form submit, URL: ${currentUrl}`);

  // Google OAuth にリダイレクトされた場合はそのフローを処理
  if (currentUrl.includes("accounts.google.com")) {
    log("Redirected to Google OAuth, proceeding with Google sign-in...");
    await handleGoogleAuth(page, email, password);
    currentUrl = page.url();
  }

  if (currentUrl.includes("/login") || currentUrl.includes("/sign_in") || currentUrl.includes("accounts.google.com")) {
    await saveDebug(page, "login-failed");
    throw new Error(`Login failed - URL after login: ${currentUrl}`);
  }

  info(`Login successful - current URL: ${currentUrl}`);
}

async function handleGoogleAuth(page: Page, email: string, password: string): Promise<void> {
  // Google メール入力
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await saveDebug(page, "google-email-page");
  log("Filling Google email...");
  await page.fill('input[type="email"]', email);
  await page.click('#identifierNext');

  // Google パスワード入力
  await page.waitForSelector('input[type="password"]', { timeout: 15000 });
  await saveDebug(page, "google-password-page");
  log("Filling Google password...");
  await page.fill('input[type="password"]', password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.click('#passwordNext'),
  ]);

  const url = page.url();
  log(`After Google auth, URL: ${url}`);
  await saveDebug(page, "after-google-auth");
}
