import { loginWithAuthState } from "@moneyforward-daily-action/crawler/auth/login";
import { getAuthStatePath } from "@moneyforward-daily-action/crawler/auth/state";
import { createBrowserContext } from "@moneyforward-daily-action/crawler/browser/context";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const ROOT_ENV_PATH = path.resolve(process.cwd(), "../../.env");

function cleanupAuthState(): void {
  const authStatePath = getAuthStatePath();
  if (existsSync(authStatePath)) {
    unlinkSync(authStatePath);
  }
}

export async function setup() {
  try {
    process.loadEnvFile(ROOT_ENV_PATH);
  } catch {
    // CI environment
  }

  console.log("Setting up E2E tests...");
  cleanupAuthState();
  const browser = await chromium.launch({ headless: true });
  const context = await createBrowserContext(browser, { useAuthState: true });
  const page = await context.newPage();

  try {
    await loginWithAuthState(page, context);
    console.log("Login successful, auth state ready");
  } finally {
    await browser.close();
  }

  return () => {
    cleanupAuthState();
  };
}
