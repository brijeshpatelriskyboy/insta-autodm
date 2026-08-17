import { afterEach, describe, expect, it } from "vitest";
import { isMockInstagramConnectAllowed } from "./mockInstagram";

describe("isMockInstagramConnectAllowed", () => {
  afterEach(() => {
    delete process.env.COMMENT2DM_DEPLOYMENT_ENV;
  });

  it("refuses NODE_ENV=production without a staging deployment env", () => {
    expect(isMockInstagramConnectAllowed("production", undefined)).toBe(false);
    expect(isMockInstagramConnectAllowed("production", "")).toBe(false);
  });

  it("refuses COMMENT2DM_DEPLOYMENT_ENV=production even in test/dev", () => {
    expect(isMockInstagramConnectAllowed("test", "production")).toBe(false);
    expect(isMockInstagramConnectAllowed("development", "production")).toBe(false);
  });

  it("allows hosted staging (NODE_ENV=production + COMMENT2DM_DEPLOYMENT_ENV=staging)", () => {
    expect(isMockInstagramConnectAllowed("production", "staging")).toBe(true);
  });

  it("allows development and test", () => {
    expect(isMockInstagramConnectAllowed("development", undefined)).toBe(true);
    expect(isMockInstagramConnectAllowed("test", undefined)).toBe(true);
    expect(isMockInstagramConnectAllowed("test", "staging")).toBe(true);
  });
});
