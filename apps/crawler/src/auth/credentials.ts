import { createHmac } from "node:crypto";
import { debug, error } from "../logger.js";

export interface Credentials {
  username: string;
  password: string;
}

function base32Decode(encoded: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = encoded.replace(/\s+/g, "").toUpperCase().replace(/=/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function generateTOTP(secret: string, digits = 6, period = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / period);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  return String(code % 10 ** digits).padStart(digits, "0");
}

export async function getCredentials(): Promise<Credentials> {
  const username = process.env.MF_EMAIL ?? "";
  const password = process.env.MF_PASSWORD ?? "";

  if (!username || !password) {
    error("MF_EMAIL または MF_PASSWORD が設定されていません");
    process.exit(1);
  }

  debug("環境変数から認証情報を取得しています...");
  return { username, password };
}

export async function getOTP(): Promise<string> {
  const secret = process.env.MF_TOTP_SECRET ?? "";

  if (!secret) {
    throw new Error("MF_TOTP_SECRET が設定されていません");
  }

  debug("TOTP を生成しています...");
  return generateTOTP(secret);
}
