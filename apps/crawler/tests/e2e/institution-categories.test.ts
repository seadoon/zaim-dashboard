import type { Browser, BrowserContext } from "playwright";
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { scrapeInstitutionCategories } from "../../src/scrapers/institution-categories.js";
import {
  gotoHome,
  launchLoggedInContext,
  saveScreenshot,
  withErrorScreenshot,
  withNewPage,
} from "./helpers.js";

let browser: Browser;
let context: BrowserContext;

beforeAll(async () => {
  ({ browser, context } = await launchLoggedInContext());
});

afterAll(async () => {
  await context?.close();
  await browser?.close();
});

describe("scrapeInstitutionCategories", () => {
  test("口座カテゴリが取得できる", async () => {
    await withNewPage(context, async (page) => {
      // Debug: Log URL and save screenshot
      await gotoHome(page);
      await saveScreenshot(page, "institution-categories-test-before-scrape.png");

      const categoryMap = await withErrorScreenshot(
        page,
        "institution-categories-test-error.png",
        () => scrapeInstitutionCategories(page),
      );
      expect(categoryMap.size).toBeGreaterThan(0);
    });
  });

  test("カテゴリ名が有効な値", async () => {
    await withNewPage(context, async (page) => {
      const categoryMap = await scrapeInstitutionCategories(page);

      for (const category of categoryMap.values()) {
        expect(category).toBeTruthy();
        expect(typeof category).toBe("string");
        // カテゴリ名は日本語で意味のある文字列
        expect(category.length).toBeGreaterThan(0);
        expect(category.length).toBeLessThan(50);
      }
    });
  });

  test("mfIdが有効な形式", async () => {
    await withNewPage(context, async (page) => {
      const categoryMap = await scrapeInstitutionCategories(page);

      for (const mfId of categoryMap.keys()) {
        expect(mfId).toBeTruthy();
        expect(typeof mfId).toBe("string");
        expect(mfId.length).toBeGreaterThan(0);
      }
    });
  });
});
