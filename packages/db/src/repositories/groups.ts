import { eq } from "drizzle-orm";
import type { Db } from "../index";
import type { Group } from "../types";
import { schema } from "../index";
import { now, upsertById } from "../utils";

export function getCurrentGroupId(db: Db): string | null {
  const group = db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.isCurrent, true))
    .get();
  return group?.id ?? null;
}

export function clearGroupAccountLinks(db: Db, groupId: string): void {
  db.delete(schema.groupAccounts).where(eq(schema.groupAccounts.groupId, groupId)).run();
}

export function linkAccountToGroup(db: Db, groupId: string, accountId: number): void {
  db.insert(schema.groupAccounts)
    .values({
      groupId,
      accountId,
      createdAt: now(),
      updatedAt: now(),
    })
    .onConflictDoNothing()
    .run();
}

export function upsertGroup(db: Db, group: Group): void {
  // isCurrent=trueの場合のみ、他のグループをfalseにする
  if (group.isCurrent) {
    db.update(schema.groups).set({ isCurrent: false, updatedAt: now() }).run();
  }

  // グループをupsert
  upsertById(
    db,
    schema.groups,
    eq(schema.groups.id, group.id),
    {
      id: group.id,
      name: group.name,
      isCurrent: group.isCurrent,
    },
    {
      name: group.name,
      isCurrent: group.isCurrent,
    },
  );
}

export function updateGroupLastScrapedAt(db: Db, groupId: string, timestamp: string): void {
  db.update(schema.groups)
    .set({ lastScrapedAt: timestamp, updatedAt: now() })
    .where(eq(schema.groups.id, groupId))
    .run();
}

/**
 * 複数アカウントリンクの一括insert
 */
export function linkAccountsToGroup(db: Db, groupId: string, accountIds: number[]): void {
  if (accountIds.length === 0) return;

  const timestamp = now();
  const records = accountIds.map((accountId) => ({
    groupId,
    accountId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  db.insert(schema.groupAccounts).values(records).onConflictDoNothing().run();
}
