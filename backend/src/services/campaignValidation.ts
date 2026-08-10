/**
 * Lightweight invariant helpers for Smart Campaigns (V2).
 * No webhook wiring — validation only.
 */

import { MAX_CAMPAIGN_CLAIMS_CAP } from "./campaignCodeGenerator";

export type CampaignInvariantInput = {
  maxClaims: number;
  claimedCount: number;
  startsAt: Date;
  endsAt: Date;
  dmTemplate: string;
  /** When true, dmTemplate must include {{code}} */
  requiresCodePlaceholder?: boolean;
  /** Enforce safe upper bound (default true for create). */
  enforceMaxClaimsCap?: boolean;
};

export type CampaignInvariantIssue =
  | "maxClaims_must_be_positive"
  | "maxClaims_exceeds_cap"
  | "claimedCount_must_be_non_negative"
  | "claimedCount_exceeds_maxClaims"
  | "startsAt_must_precede_endsAt"
  | "dmTemplate_missing_code_placeholder";

export const CAMPAIGN_INVARIANT_MESSAGES: Record<CampaignInvariantIssue, string> = {
  maxClaims_must_be_positive: "maxClaims must be greater than 0",
  maxClaims_exceeds_cap: `maxClaims cannot exceed ${MAX_CAMPAIGN_CLAIMS_CAP}`,
  claimedCount_must_be_non_negative: "claimedCount cannot be negative",
  claimedCount_exceeds_maxClaims: "claimedCount cannot exceed maxClaims",
  startsAt_must_precede_endsAt: "startsAt must be before endsAt",
  dmTemplate_missing_code_placeholder: "dmTemplate must include {{code}}",
};

export function validateCampaignInvariants(
  input: CampaignInvariantInput,
): CampaignInvariantIssue[] {
  const issues: CampaignInvariantIssue[] = [];

  if (!(input.maxClaims > 0)) {
    issues.push("maxClaims_must_be_positive");
  } else if (input.enforceMaxClaimsCap !== false && input.maxClaims > MAX_CAMPAIGN_CLAIMS_CAP) {
    issues.push("maxClaims_exceeds_cap");
  }
  if (input.claimedCount < 0) {
    issues.push("claimedCount_must_be_non_negative");
  }
  if (input.claimedCount > input.maxClaims) {
    issues.push("claimedCount_exceeds_maxClaims");
  }
  if (!(input.startsAt.getTime() < input.endsAt.getTime())) {
    issues.push("startsAt_must_precede_endsAt");
  }
  if (input.requiresCodePlaceholder !== false) {
    if (!input.dmTemplate.includes("{{code}}")) {
      issues.push("dmTemplate_missing_code_placeholder");
    }
  }

  return issues;
}

export function assertCampaignInvariants(input: CampaignInvariantInput): void {
  const issues = validateCampaignInvariants(input);
  if (issues.length > 0) {
    throw new Error(`Campaign invariant violation: ${issues.join(", ")}`);
  }
}

export function firstInvariantMessage(input: CampaignInvariantInput): string | null {
  const issues = validateCampaignInvariants(input);
  if (issues.length === 0) return null;
  return CAMPAIGN_INVARIANT_MESSAGES[issues[0]!];
}
