import { getDb, type Db, schema } from "../index";
import { desc, eq } from "drizzle-orm";

/** Robofolio ブローカー一覧 */
export function getRfBrokers(db: Db = getDb()) {
  return db.select().from(schema.rfBrokers).orderBy(schema.rfBrokers.name).all();
}

/** ブローカーIDで銘柄一覧を取得 */
export function getRfHoldingsByBrokerId(brokerId: number, db: Db = getDb()) {
  return db
    .select()
    .from(schema.rfHoldings)
    .where(eq(schema.rfHoldings.brokerId, brokerId))
    .all();
}
