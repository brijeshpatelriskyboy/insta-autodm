/**
 * Smart Campaigns feature flag — backend source of truth.
 *
 * Rules:
 * - missing / undefined → false
 * - "false" → false
 * - "true" → true
 * - any other string → false
 *
 * Production must keep SMART_CAMPAIGNS_ENABLED unset or "false".
 */
export function isSmartCampaignsEnabled(
  value: string | undefined = process.env.SMART_CAMPAIGNS_ENABLED,
): boolean {
  return value === "true";
}

/** Public feature availability payload (no secrets, no unrelated env). */
export type FeatureFlags = {
  smartCampaigns: boolean;
};

export function getFeatureFlags(): FeatureFlags {
  return {
    smartCampaigns: isSmartCampaignsEnabled(),
  };
}
