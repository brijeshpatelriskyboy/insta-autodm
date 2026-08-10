/**
 * Lightweight invariant helpers for Smart Campaigns (V2).
 * No CRUD / webhook wiring — validation only.
 */

export type CampaignInvariantInput = {
  maxClaims: number;
  claimedCount: number;
  startsAt: Date;
  endsAt: Date;
  dmTemplate: string;
  /** When true, dmTemplate must include {{code}} */
  requiresCodePlaceholder?: boolean;
};

export type CampaignInvariantIssue =
  | "maxClaims_must_be_positive"
  | "claimedCount_must_be_non_negative"
  | "claimedCount_exceeds_maxClaims"
  | "startsAt_must_precede_endsAt"
  | "dmTemplate_missing_code_placeholder";

export function validateCampaignInvariants(
  input: CampaignInvariantInput
): CampaignInvariantIssue[] {
  const issues: CampaignInvariantIssue[] = [];

  if (!(input.maxClaims > 0)) {
    issues.push("maxClaims_must_be_positive");
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
