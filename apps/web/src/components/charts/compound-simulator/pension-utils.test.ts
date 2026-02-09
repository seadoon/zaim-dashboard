import { describe, expect, test } from "vitest";
import { adjustedPension, pensionMultiplier } from "./pension-utils";

describe("pensionMultiplier", () => {
  test("65歳 → 1.0", () => {
    expect(pensionMultiplier(65)).toBe(1.0);
  });

  test("60歳 → 0.76", () => {
    expect(pensionMultiplier(60)).toBeCloseTo(0.76, 10);
  });

  test("70歳 → 1.42", () => {
    expect(pensionMultiplier(70)).toBeCloseTo(1.42, 10);
  });

  test("75歳 → 1.84", () => {
    expect(pensionMultiplier(75)).toBeCloseTo(1.84, 10);
  });

  test("59歳以下はクランプされて60歳と同じ", () => {
    expect(pensionMultiplier(59)).toBe(pensionMultiplier(60));
    expect(pensionMultiplier(50)).toBe(pensionMultiplier(60));
  });

  test("76歳以上はクランプされて75歳と同じ", () => {
    expect(pensionMultiplier(76)).toBe(pensionMultiplier(75));
    expect(pensionMultiplier(80)).toBe(pensionMultiplier(75));
  });
});

describe("adjustedPension", () => {
  test("65歳基準146,000円 → 146,000円", () => {
    expect(adjustedPension(146_000, 65)).toBe(146_000);
  });

  test("60歳繰上げ → 76%", () => {
    expect(adjustedPension(146_000, 60)).toBe(Math.round(146_000 * 0.76));
  });

  test("70歳繰下げ → 142%", () => {
    expect(adjustedPension(146_000, 70)).toBe(Math.round(146_000 * 1.42));
  });

  test("75歳繰下げ → 184%", () => {
    expect(adjustedPension(146_000, 75)).toBe(Math.round(146_000 * 1.84));
  });
});
