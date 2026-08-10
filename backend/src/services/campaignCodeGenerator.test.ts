import { describe, expect, it } from "vitest";
import {
  assertValidCodeGenerationConfig,
  generateUniqueCampaignCodes,
  MAX_CAMPAIGN_CLAIMS_CAP,
} from "./campaignCodeGenerator";

describe("campaignCodeGenerator", () => {
  it("exports a safe maxClaims cap of 10_000", () => {
    expect(MAX_CAMPAIGN_CLAIMS_CAP).toBe(10_000);
  });

  it("generates exactly count unique PREFIX-SEGMENT codes", () => {
    const codes = generateUniqueCampaignCodes({
      count: 50,
      prefix: "SUNDAY",
      length: 8,
    });
    expect(codes).toHaveLength(50);
    expect(new Set(codes).size).toBe(50);
    for (const code of codes) {
      expect(code).toMatch(/^SUNDAY-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("supports deterministic generation via injected randomBytes", () => {
    let n = 0;
    const codes = generateUniqueCampaignCodes({
      count: 3,
      prefix: "TEST",
      length: 6,
      randomBytesFn: (size) => {
        const buf = Buffer.alloc(size);
        for (let i = 0; i < size; i += 1) {
          buf[i] = (n + i) % 256;
        }
        n += 17;
        return buf;
      },
    });
    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);
    expect(codes[0]).toBe(codes[0]); // stable shape
  });

  it("validates prefix and length", () => {
    expect(() => assertValidCodeGenerationConfig({ prefix: "ok!", length: 8 })).toThrow(
      /prefix_invalid/,
    );
    expect(() => assertValidCodeGenerationConfig({ prefix: "OK", length: 3 })).toThrow(
      /length_invalid/,
    );
  });
});
