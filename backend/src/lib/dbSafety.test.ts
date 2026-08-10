import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafeV2DatabaseUrl,
  isLocalHostname,
  looksLikeProductionHost,
  parseDatabaseUrl,
} from "./dbSafety";

describe("dbSafety", () => {
  afterEach(() => {
    delete process.env.COMMENT2DM_ALLOW_REMOTE_V2_DB;
  });

  it("parses database URL parts", () => {
    const parts = parseDatabaseUrl(
      "postgresql://comment2dm_v2:secret@127.0.0.1:5432/comment2dm_v2_dev?schema=public",
    );
    expect(parts.hostname).toBe("127.0.0.1");
    expect(parts.database).toBe("comment2dm_v2_dev");
    expect(parts.port).toBe("5432");
  });

  it("detects local and production-like hosts", () => {
    expect(isLocalHostname("localhost")).toBe(true);
    expect(isLocalHostname("127.0.0.1")).toBe(true);
    expect(looksLikeProductionHost("insta-autodm.up.railway.app")).toBe(true);
    expect(looksLikeProductionHost(" Magical.rlwy.net ".trim().toLowerCase())).toBe(true);
    expect(looksLikeProductionHost("127.0.0.1")).toBe(false);
  });

  it("allows isolated local V2 database URLs", () => {
    expect(() =>
      assertSafeV2DatabaseUrl(
        "postgresql://comment2dm_v2:v2_dev_only_local@127.0.0.1:5432/comment2dm_v2_dev?schema=public",
      ),
    ).not.toThrow();
  });

  it("rejects production-like hosts", () => {
    expect(() =>
      assertSafeV2DatabaseUrl(
        "postgresql://user:pass@insta-autodm.up.railway.app:5432/comment2dm_v2_dev",
      ),
    ).toThrow(/production-like host/);
  });

  it("rejects local DB names without v2", () => {
    expect(() =>
      assertSafeV2DatabaseUrl("postgresql://postgres@127.0.0.1:5432/insta_autodm"),
    ).toThrow(/must include "v2"/);
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() => assertSafeV2DatabaseUrl("")).toThrow(/DATABASE_URL is required/);
  });
});
