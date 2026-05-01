import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.spyOn(process, "exit").mockImplementation(() => {
  throw new Error("process.exit called");
});

import { getCredentials, getOTP } from "./credentials.js";

describe("credentials", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      MF_EMAIL: "test@example.com",
      MF_PASSWORD: "test-password",
      MF_TOTP_SECRET: "JBSWY3DPEHPK3PXP",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getCredentials", () => {
    test("returns credentials from env vars", async () => {
      const result = await getCredentials();
      expect(result).toEqual({
        username: "test@example.com",
        password: "test-password",
      });
    });

    test("exits when MF_EMAIL is not set", async () => {
      delete process.env.MF_EMAIL;
      await expect(getCredentials()).rejects.toThrow("process.exit called");
    });

    test("exits when MF_PASSWORD is not set", async () => {
      delete process.env.MF_PASSWORD;
      await expect(getCredentials()).rejects.toThrow("process.exit called");
    });
  });

  describe("getOTP", () => {
    test("returns 6-digit TOTP code", async () => {
      const result = await getOTP();
      expect(result).toMatch(/^\d{6}$/);
    });

    test("throws when MF_TOTP_SECRET is not set", async () => {
      delete process.env.MF_TOTP_SECRET;
      await expect(getOTP()).rejects.toThrow("MF_TOTP_SECRET が設定されていません");
    });

    test("handles TOTP secret with spaces", async () => {
      process.env.MF_TOTP_SECRET = "JBSW Y3DP EHPK 3PXP";
      const result = await getOTP();
      expect(result).toMatch(/^\d{6}$/);
    });
  });
});
