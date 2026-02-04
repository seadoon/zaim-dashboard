import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { pages } from "./fixtures";

test.describe("Accessibility tests", () => {
  for (const { name, path } of pages) {
    test(`${name} (${path}) should have no accessibility violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page }).exclude("nextjs-portal").analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
