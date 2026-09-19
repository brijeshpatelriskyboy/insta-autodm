import { describe, expect, it } from "vitest";
import { isResetTokenTestHelperEnabled } from "./authSecurity";

describe("isResetTokenTestHelperEnabled", () => {
  it("is false in production", () => {
    expect(isResetTokenTestHelperEnabled("production")).toBe(false);
  });

  it("is true in test and development", () => {
    expect(isResetTokenTestHelperEnabled("test")).toBe(true);
    expect(isResetTokenTestHelperEnabled("development")).toBe(true);
  });
});
