import { randomBytes } from "crypto";

/**
 * Safe initial maxClaims upper bound for AUTO code pool generation.
 *
 * Rationale: a single transactional insert of unique codes should stay bounded
 * for Postgres row volume, request latency, and creator-scale Instagram promos.
 * 10,000 covers large SMB giveaways while avoiding multi-minute transactions.
 * Raise later with async generation if needed — not in this milestone.
 */
export const MAX_CAMPAIGN_CLAIMS_CAP = 10_000;

/** Ambiguity-safe alphabet (no 0/O, 1/I/L). */
export const CAMPAIGN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type AutoCodeGenerationConfig = {
  mode: "AUTO";
  prefix: string;
  /** Random segment length (not including prefix + hyphen). */
  length: number;
};

export type CodeGeneratorOptions = {
  count: number;
  prefix: string;
  length: number;
  /**
   * Optional injectable source of random bytes (tests).
   * Defaults to crypto.randomBytes.
   */
  randomBytesFn?: (size: number) => Buffer;
  /** Max attempts to fill the unique set before failing. */
  maxAttempts?: number;
  /** Existing codes that must not be re-emitted (e.g. DRAFT pool resize). */
  exclude?: Iterable<string>;
};

export function normalizeCodePrefix(prefix: string): string {
  return prefix.trim().toUpperCase();
}

export function assertValidCodeGenerationConfig(config: {
  prefix: string;
  length: number;
}): { prefix: string; length: number } {
  const prefix = normalizeCodePrefix(config.prefix);
  if (!/^[A-Z0-9]{1,16}$/.test(prefix)) {
    throw new Error("prefix_invalid");
  }
  if (!Number.isInteger(config.length) || config.length < 6 || config.length > 12) {
    throw new Error("length_invalid");
  }
  return { prefix, length: config.length };
}

function randomSegment(
  length: number,
  randomBytesFn: (size: number) => Buffer,
): string {
  const alphabet = CAMPAIGN_CODE_ALPHABET;
  const bytes = randomBytesFn(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i]! % alphabet.length]!;
  }
  return out;
}

/**
 * Generates exactly `count` unique codes shaped like PREFIX-XXXXXXXX.
 * Uniqueness is enforced in-memory; DB unique constraints remain the final guard.
 */
export function generateUniqueCampaignCodes(options: CodeGeneratorOptions): string[] {
  const { count, prefix, length } = options;
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("count_invalid");
  }
  const randomBytesFn = options.randomBytesFn ?? randomBytes;
  const excluded = new Set(options.exclude ?? []);
  const maxAttempts =
    options.maxAttempts ?? Math.max(count * 25, count + 100 + excluded.size);

  const codes = new Set<string>();
  let attempts = 0;
  while (codes.size < count) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error("code_generation_exhausted");
    }
    const code = `${prefix}-${randomSegment(length, randomBytesFn)}`;
    if (excluded.has(code) || codes.has(code)) {
      continue;
    }
    codes.add(code);
  }
  return Array.from(codes);
}

/**
 * Infer AUTO prefix + random-segment length from an existing code (PREFIX-SEGMENT).
 * Does not accept or return secrets — codes are opaque pool values.
 */
export function inferAutoCodeFormatFromSample(sampleCode: string): {
  prefix: string;
  length: number;
} {
  const trimmed = sampleCode.trim();
  const dash = trimmed.indexOf("-");
  if (dash <= 0 || dash === trimmed.length - 1) {
    throw new Error("code_format_invalid");
  }
  const prefix = trimmed.slice(0, dash);
  const segment = trimmed.slice(dash + 1);
  return assertValidCodeGenerationConfig({ prefix, length: segment.length });
}
