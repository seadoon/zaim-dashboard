import type { Locator, Page } from "playwright";

/**
 * Money Forward ページから CSRF トークンを取得する
 */
export async function getCsrfToken(page: Page): Promise<string | null> {
  const token = await page
    .locator("meta[name='csrf-token']")
    .getAttribute("content")
    .catch(() => null);

  return token || null;
}

/**
 * トランザクションのカテゴリを更新する
 * /cf/update API を呼び出す
 */
export async function updateTransactionCategory(
  page: Page,
  csrfToken: string,
  transactionId: string,
  options: {
    largeCategoryId: string;
    middleCategoryId: string;
    isIncome?: boolean;
    isTarget?: boolean;
  },
): Promise<{ ok: boolean; status: number }> {
  return page.evaluate(
    async ({ id, csrf, largeCatId, middleCatId, isIncome, isTarget }) => {
      const formData = new URLSearchParams();
      formData.append("user_asset_act[id]", id);
      formData.append("user_asset_act[large_category_id]", largeCatId);
      formData.append("user_asset_act[middle_category_id]", middleCatId);
      formData.append("user_asset_act[is_income]", isIncome ? "1" : "0");
      formData.append("user_asset_act[is_target]", isTarget ? "1" : "0");
      formData.append("user_asset_act[table_name]", "user_asset_act");

      const res = await fetch("/cf/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-CSRF-Token": csrf,
          "X-Requested-With": "XMLHttpRequest",
        },
        body: formData.toString(),
      });
      return { status: res.status, ok: res.ok };
    },
    {
      id: transactionId,
      csrf: csrfToken,
      largeCatId: options.largeCategoryId,
      middleCatId: options.middleCategoryId,
      isIncome: options.isIncome ?? false,
      isTarget: options.isTarget ?? true,
    },
  );
}

/**
 * CF ページのトランザクション行を取得する
 * 事前に /cf ページへ遷移済みであること
 */
export function getTransactionRows(page: Page): Locator {
  return page.locator("#cf-detail-table tbody tr[id^='js-transaction-']");
}

/**
 * トランザクション行から ID を取得する
 */
export async function getTransactionId(row: Locator): Promise<string | null> {
  const id = await row
    .locator("input[name='user_asset_act[id]']")
    .getAttribute("value")
    .catch(() => null);

  return id || null;
}
