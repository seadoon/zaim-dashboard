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

  // メールアドレス入力（よく使われる属性を順にトライ）
  const emailSelector = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="user[email]"]',
    'input[id="email"]',
    'input[placeholder*="メール"]',
    'input[placeholder*="email"]',
    'input[placeholder*="Email"]',
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
    page.click('button[type="submit"], input[type="submit"], .btn-login, button:has-text("ログイン"), button:has-text("Sign in"), button:has-text("ログイン")'),
  ]);

  const currentUrl = page.url();
  if (currentUrl.includes("/login") || currentUrl.includes("/sign_in")) {
    await saveDebug(page, "login-failed");
    throw new Error(`Login failed - still on login page: ${currentUrl}`);
  }

  info(`Login successful - current URL: ${currentUrl}`);
}
