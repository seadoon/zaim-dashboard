import { eq } from "drizzle-orm";
import type { Db } from "../index";
import type { ScrapedData } from "../types";
import { schema } from "../index";
import { now } from "../utils";
import { upsertAccounts, saveAccountStatuses, buildAccountIdMap } from "./accounts";
import { getOrCreateCategory } from "./categories";
import {
  upsertGroup,
  updateGroupLastScrapedAt,
  clearGroupAccountLinks,
  linkAccountsToGroup,
} from "./groups";
import { createHolding, saveHoldingValue } from "./holdings";
import { createSnapshot } from "./snapshots";
import { saveAssetHistory } from "./summaries";

const isCI = process.env.CI === "true";
function log(...args: unknown[]) {
  if (!isCI) console.log(...args);
}

export function saveScrapedData(db: Db, data: ScrapedData): void {
  const today = new Date().toISOString().split("T")[0];

  log("Saving scraped data to database...");

  if (data.currentGroup) {
    upsertGroup(db, data.currentGroup);
    log(`  - Group: ${data.currentGroup.name}`);
  }

  const groupId = data.currentGroup?.id;
  if (groupId === undefined || groupId === null) {
    throw new Error("No group available. Cannot save data.");
  }

  upsertAccounts(db, data.registeredAccounts.accounts);
  log(`  - Accounts: ${data.registeredAccounts.accounts.length}`);

  const accountIdMap = buildAccountIdMap(db);
  log(`  - accountIdMap: ${accountIdMap.size} entries`);

  clearGroupAccountLinks(db, groupId);
  const accountIds = data.registeredAccounts.accounts
    .map((account) => accountIdMap.get(account.mfId))
    .filter((id): id is number => id !== undefined);
  linkAccountsToGroup(db, groupId, accountIds);
  log(`  - Group account links: ${accountIds.length}`);

  const statusRecords = data.registeredAccounts.accounts
    .map((account) => {
      const accountId = accountIdMap.get(account.mfId);
      if (accountId) {
        return { accountId, status: account };
      }
      return null;
    })
    .filter(
      (r): r is { accountId: number; status: (typeof data.registeredAccounts.accounts)[0] } =>
        r !== null,
    );
  saveAccountStatuses(db, statusRecords);

  const snapshotId = createSnapshot(db, groupId, today, data.refreshResult);
  log(`  - Snapshot ID: ${snapshotId}`);

  let unknownAccount = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.mfId, "unknown"))
    .get();

  if (!unknownAccount) {
    unknownAccount = db
      .insert(schema.accounts)
      .values({
        mfId: "unknown",
        name: "-",
        type: "手動",
        createdAt: now(),
        updatedAt: now(),
      })
      .returning()
      .get();
  }
  const unknownAccountId = unknownAccount.id;

  for (const item of data.portfolio.items) {
    const accountId = accountIdMap.get(item.institution) || unknownAccountId;
    const categoryId = getOrCreateCategory(db, item.type);
    const holdingId = createHolding(db, accountId, item.name, "asset", {
      categoryId,
      code: item.code,
    });
    const amount = Number.isFinite(item.balance) ? item.balance : 0;
    saveHoldingValue(db, holdingId, snapshotId, {
      amount,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      avgCostPrice: item.avgCostPrice,
      dailyChange: item.dailyChange,
      unrealizedGain: item.unrealizedGain,
      unrealizedGainPct: item.unrealizedGainPct,
    });
  }
  log(`  - Portfolio: ${data.portfolio.items.length}`);

  for (const liability of data.liabilities.items) {
    const accountId = accountIdMap.get(liability.institution) || unknownAccountId;
    const holdingId = createHolding(db, accountId, liability.name, "liability", {
      liabilityCategory: liability.category,
    });
    saveHoldingValue(db, holdingId, snapshotId, { amount: liability.balance });
  }
  log(`  - Liabilities: ${data.liabilities.items.length}`);

  if (data.assetHistory?.points?.length > 0) {
    saveAssetHistory(db, groupId, data.assetHistory.points);
    log(`  - Asset history: ${data.assetHistory.points.length}`);
  }

  updateGroupLastScrapedAt(db, groupId, now());

  log("Data saved successfully!");
}

export function saveGroupOnlyData(db: Db, data: ScrapedData): void {
  log("Saving group-only data to database...");

  if (data.currentGroup) {
    upsertGroup(db, data.currentGroup);
    log(`  - Group: ${data.currentGroup.name}`);
  }

  const groupId = data.currentGroup?.id;
  if (groupId === undefined || groupId === null) {
    throw new Error("No group available. Cannot save data.");
  }

  const accountIdMap = buildAccountIdMap(db);

  clearGroupAccountLinks(db, groupId);
  const accountIds = data.registeredAccounts.accounts
    .map((account) => accountIdMap.get(account.mfId))
    .filter((id): id is number => id !== undefined);
  linkAccountsToGroup(db, groupId, accountIds);
  log(`  - Group account links: ${accountIds.length}`);

  if (data.assetHistory?.points?.length > 0) {
    saveAssetHistory(db, groupId, data.assetHistory.points);
    log(`  - Asset history: ${data.assetHistory.points.length}`);
  }

  updateGroupLastScrapedAt(db, groupId, now());

  log("Group data saved successfully!");
}
