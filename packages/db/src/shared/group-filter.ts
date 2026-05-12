import { eq } from "drizzle-orm";
import type { Db } from "../index";
import { schema } from "../index";

export function getDefaultGroupId(db: Db): string | null {
  const currentGroup = db
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(eq(schema.groups.isCurrent, true))
    .get();
  return currentGroup?.id ?? null;
}

export function resolveGroupId(db: Db, groupId?: string): string | null {
  return groupId ?? getDefaultGroupId(db);
}

export function getAccountIdsForGroup(db: Db, groupId: string): number[] {
  const groupAccounts = db
    .select({ accountId: schema.groupAccounts.accountId })
    .from(schema.groupAccounts)
    .where(eq(schema.groupAccounts.groupId, groupId))
    .all();
  return groupAccounts.map((ga) => ga.accountId);
}
