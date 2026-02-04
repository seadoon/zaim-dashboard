import { describe, test, expect } from "vitest";
import { identifyTableTypeFromTitle } from "./portfolio.js";

describe("identifyTableTypeFromTitle", () => {
  test("「ポイント・マイル」はそのまま返す", () => {
    expect(identifyTableTypeFromTitle("ポイント・マイル")).toBe("ポイント・マイル");
  });

  test("「年金」はそのまま返す", () => {
    expect(identifyTableTypeFromTitle("年金")).toBe("年金");
  });

  test("「保険」はそのまま返す", () => {
    expect(identifyTableTypeFromTitle("保険")).toBe("保険");
  });

  test("「預金・現金・暗号資産」はそのまま返す", () => {
    expect(identifyTableTypeFromTitle("預金・現金・暗号資産")).toBe("預金・現金・暗号資産");
  });

  test("「株式(現物)」はそのまま返す", () => {
    expect(identifyTableTypeFromTitle("株式(現物)")).toBe("株式(現物)");
  });

  test("「投資信託」はそのまま返す", () => {
    expect(identifyTableTypeFromTitle("投資信託")).toBe("投資信託");
  });

  test("不明なタイトルは「不明」を返す", () => {
    expect(identifyTableTypeFromTitle("")).toBe("不明");
    expect(identifyTableTypeFromTitle("不明なカテゴリ")).toBe("不明");
    expect(identifyTableTypeFromTitle("ポイント")).toBe("不明"); // "ポイント・マイル"ではない
  });
});
