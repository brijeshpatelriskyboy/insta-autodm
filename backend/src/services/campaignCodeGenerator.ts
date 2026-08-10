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
  const maxAttempts = options.maxAttempts ?? Math.max(count * 25, count + 100);

  const codes = new Set<string>();
  let attempts = 0;
  while (codes.size < count) {
    attempts += 1;
    if (attempts > maxAttempts) {
      throw new Error("code_generation_exhausted");
    }
    const code = `${prefix}-${randomSegment(length, randomBytesFn)}`;
    codes.add(code);
  }
  return Array.from(codes);
}
