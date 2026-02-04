import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { loginWithAuthState } from "../../src/auth/login.js";
import { getAuthStatePath } from "../../src/auth/state.js";
import { createBrowserContext } from "../../src/browser/context.js";

export const SCREENSHOT_DIR = path.resolve(process.cwd(), "tests/e2e/screenshots");

const ROOT_ENV_PATH = path.resolve(process.cwd(), "../../.env");

export function ensureScreenshotDir(): void {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

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
