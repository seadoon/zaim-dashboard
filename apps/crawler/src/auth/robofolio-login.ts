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

// robofolio 側の一時的な応答遅延で page.goto が 30 秒を超えることがある
// （2026-10-06 15:34 の Daily Update が 1 回目のナビゲーションだけで失敗）。
// サイト自体は稼働しているため、少し待って数回やり直す。
async function gotoLoginWithRetry(page: Page, attempts = 3): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await page.goto(rfUrls.login, { waitUntil: "domcontentloaded", timeout: 30000 });
      if (i > 1) info(`Navigation succeeded on attempt ${i}`);
      return;
    } catch (err) {
      if (i === attempts) throw err;
      const waitMs = i * 10000;
      log(`Navigation attempt ${i}/${attempts} failed, retrying in ${waitMs / 1000}s: ${String(err)}`);
      await page.waitForTimeout(waitMs);
    }
  }
}

export async function loginToRobofolio(page: Page): Promise<void> {
  const { loginId, password } = getCredentials();

  info("Navigating to robofolio login page...");
  await gotoLoginWithRetry(page);
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
