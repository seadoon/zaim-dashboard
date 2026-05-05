/**
 * Zaim デモデータ seed スクリプト
 *
 * 独身社会人（30代）を想定した1年分の家計データを生成する。
 *
 * 使い方:
 *   DB_PATH=../../data/demo.db npx tsx src/seed.ts
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema/schema";

const dbPath =
  process.env.DB_PATH || join(import.meta.dirname, "..", "..", "..", "data", "demo.db");

if (existsSync(dbPath)) unlinkSync(dbPath);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: join(import.meta.dirname, "../drizzle") });

const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const now = () => FIXED_TIMESTAMP;

function createRng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createRng(20250101);

function randInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

// ---------------------------------------------------------------------------
// カテゴリ定義（Zaim形式: category + genre）
// ---------------------------------------------------------------------------
const PAYMENT_CATEGORIES = [
  { category: "食費", genres: ["食料品", "外食", "カフェ・喫茶店", "コンビニ"] },
  { category: "日用品", genres: ["日用雑貨", "洗剤・掃除用品", "ティッシュ・トイレットペーパー"] },
  { category: "交通費", genres: ["電車・バス", "タクシー", "高速道路"] },
  { category: "娯楽・趣味", genres: ["映画・音楽", "書籍", "ゲーム", "スポーツ"] },
  { category: "衣服・美容", genres: ["衣服", "美容院・理容院", "化粧品"] },
  { category: "水道・光熱費", genres: ["電気代", "ガス代", "水道代"] },
  { category: "通信費", genres: ["携帯電話", "インターネット", "サブスク"] },
  { category: "医療・健康", genres: ["病院", "薬局", "サプリ"] },
  { category: "住宅", genres: ["家賃", "管理費"] },
] as const;

const ACCOUNTS = ["銀行（三菱UFJ）", "クレジットカード（楽天）", "Suica", "現金"] as const;

// ---------------------------------------------------------------------------
// 期間設定（2025-01 〜 2025-12）
// ---------------------------------------------------------------------------
const YEAR_START = 2025;
const MONTH_START = 1;
const YEAR_END = 2025;
const MONTH_END = 12;

let zaimIdCounter = 10000;
const nextId = () => ++zaimIdCounter;

const allTransactions: (typeof schema.transactions.$inferInsert)[] = [];

function addPayment(
  y: number,
  m: number,
  d: number,
  category: string,
  genre: string,
  amount: number,
  name = "",
  place = "",
  account: string = ACCOUNTS[0],
) {
  allTransactions.push({
    zaimId: nextId(),
    date: dateStr(y, m, d),
    type: "payment",
    category,
    genre,
    amount,
    name,
    place,
    fromAccount: account,
    toAccount: null,
    comment: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

function addIncome(
  y: number,
  m: number,
  d: number,
  category: string,
  genre: string,
  amount: number,
  name = "",
) {
  allTransactions.push({
    zaimId: nextId(),
    date: dateStr(y, m, d),
    type: "income",
    category,
    genre,
    amount,
    name,
    place: null,
    fromAccount: null,
    toAccount: "銀行（三菱UFJ）",
    comment: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

function addTransfer(y: number, m: number, d: number, amount: number, from: string, to: string) {
  allTransactions.push({
    zaimId: nextId(),
    date: dateStr(y, m, d),
    type: "transfer",
    category: null,
    genre: null,
    amount,
    name: null,
    place: null,
    fromAccount: from,
    toAccount: to,
    comment: null,
    createdAt: now(),
    updatedAt: now(),
  });
}

// ---------------------------------------------------------------------------
// データ生成
// ---------------------------------------------------------------------------
let y = YEAR_START;
let m = MONTH_START;

while (y < YEAR_END || (y === YEAR_END && m <= MONTH_END)) {
  const days = daysInMonth(y, m);

  // 給与（25日）
  const salary = randInt(280000, 320000);
  addIncome(y, m, 25, "給与", "給与", salary, "給与");

  // 賞与（6月・12月）
  if (m === 6 || m === 12) {
    addIncome(y, m, 25, "給与", "賞与", randInt(400000, 600000), "賞与");
  }

  // 家賃（月初）
  addPayment(y, m, 1, "住宅", "家賃", 85000, "家賃", "", "銀行（三菱UFJ）");

  // 光熱費
  addPayment(y, m, randInt(5, 10), "水道・光熱費", "電気代", randInt(5000, 12000), "電気代", "東京電力");
  addPayment(y, m, randInt(5, 10), "水道・光熱費", "ガス代", randInt(2000, 6000), "ガス代", "東京ガス");
  if (m % 2 === 0) {
    addPayment(y, m, randInt(10, 15), "水道・光熱費", "水道代", randInt(2000, 4000), "水道代", "東京都水道局");
  }

  // 通信費
  addPayment(y, m, randInt(1, 5), "通信費", "携帯電話", randInt(3000, 8000), "携帯料金", "楽天モバイル");
  addPayment(y, m, randInt(1, 5), "通信費", "インターネット", 5500, "光回線", "NTT");
  addPayment(y, m, randInt(1, 5), "通信費", "サブスク", pick([980, 1500, 2178]) as number, "Netflix", "Netflix");

  // 食費（月に15〜20件）
  const foodCount = randInt(15, 20);
  for (let i = 0; i < foodCount; i++) {
    const d = randInt(1, days);
    const genre = pick(["食料品", "外食", "カフェ・喫茶店", "コンビニ"] as const);
    const amounts: Record<string, [number, number]> = {
      "食料品": [2000, 8000],
      "外食": [800, 3000],
      "カフェ・喫茶店": [400, 1200],
      "コンビニ": [300, 1500],
    };
    const [min, max] = amounts[genre];
    addPayment(y, m, d, "食費", genre, randInt(min, max), "", "", "クレジットカード（楽天）");
  }

  // 交通費
  const transportCount = randInt(5, 10);
  for (let i = 0; i < transportCount; i++) {
    const d = randInt(1, days);
    const genre = pick(["電車・バス", "タクシー"] as const);
    addPayment(y, m, d, "交通費", genre, genre === "電車・バス" ? randInt(200, 1000) : randInt(800, 3000), "", "", "Suica");
  }

  // 娯楽
  const entertainCount = randInt(2, 5);
  for (let i = 0; i < entertainCount; i++) {
    const d = randInt(1, days);
    const { category: cat, genres } = pick(PAYMENT_CATEGORIES.filter((c) => c.category === "娯楽・趣味"));
    const genre = pick(genres);
    addPayment(y, m, d, cat, genre, randInt(500, 5000), "", "", "クレジットカード（楽天）");
  }

  // 日用品
  const miscCount = randInt(3, 6);
  for (let i = 0; i < miscCount; i++) {
    const d = randInt(1, days);
    addPayment(y, m, d, "日用品", pick(["日用雑貨", "洗剤・掃除用品"] as const), randInt(300, 3000), "", "ドン・キホーテ", "現金");
  }

  // 衣服・美容（隔月）
  if (m % 2 === 1) {
    addPayment(y, m, randInt(10, 20), "衣服・美容", "衣服", randInt(3000, 15000), "", "ユニクロ", "クレジットカード（楽天）");
  }
  addPayment(y, m, randInt(10, 25), "衣服・美容", "美容院・理容院", randInt(3000, 8000), "美容院", "");

  // 医療（確率的）
  if (rng() < 0.4) {
    addPayment(y, m, randInt(1, days), "医療・健康", "病院", randInt(1000, 5000), "", "クリニック", "現金");
  }

  // クレカ→銀行引き落とし振替（月初）
  addTransfer(y, m, 27, randInt(60000, 150000), "銀行（三菱UFJ）", "クレジットカード（楽天）");

  m++;
  if (m > 12) { m = 1; y++; }
}

// ---------------------------------------------------------------------------
// DBへ一括挿入
// ---------------------------------------------------------------------------
console.log(`${allTransactions.length} 件のトランザクションを挿入中...`);

const CHUNK = 100;
for (let i = 0; i < allTransactions.length; i += CHUNK) {
  db.insert(schema.transactions).values(allTransactions.slice(i, i + CHUNK)).run();
}

sqlite.close();
console.log(`完了: ${dbPath}`);
