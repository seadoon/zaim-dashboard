import { mkdirSync, writeFileSync } from "node:fs";
import type { Page } from "playwright";
import { rfUrls } from "@moneyforward-daily-action/meta/urls";
import { info, log } from "../logger.js";

function getCredentials() {
  const loginId = process.env.ROBOFOLIO_EMAIL;
  const password = process.env.ROBOFOLIO_PASSWORD;
  if (!loginId || !password) {
    throw new Error("ROBOFOLIO_EMAIL and ROBOFOLIO_PASSWORD must be set");
  }
  return { loginId, password };
}

async function saveDebug(page: Page, name: string) {
  mkdirSync("debug", { recursive: true });
  await page.screenshot({ path: `debug/${name}.png`, fullPage: true }).catch(() => {});
  writeFileSync(`debug/${name}.html`, await page.content().catch(() => ""));
  log(`Debug saved: debug/${name}.png`);
}

export async function loginToRobofolio(page: Page): Promise<void> {
  const { loginId, password } = getCredentials();

  info("Navigating to robofolio login page...");
  await page.goto(rfUrls.login, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForLoadState("networkidle").catch(() => {});

  await saveDebug(page, "login-page");

  await page.waitForSelector('input[name="login_id"]', { timeout: 15000 });
  await page.fill('input[name="login_id"]', loginId);
  await page.fill('input[name="password"]', password);

  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }),
    page.locator('a[href="javascript:form.submit()"]').click(),
  ]);

  const currentUrl = page.url();
  log(`URL after login: ${currentUrl}`);

  if (currentUrl.includes("/login") || currentUrl.includes("/sign_in")) {
    await saveDebug(page, "login-failed");
    throw new Error(`Login failed - still on login page: ${currentUrl}`);
  }

  info(`Login successful - current URL: ${currentUrl}`);
}
