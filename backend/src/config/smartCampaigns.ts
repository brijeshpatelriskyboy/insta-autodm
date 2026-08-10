/**
 * Smart Campaigns feature flag (foundation seam).
 * Only the string "true" enables the flag; missing/undefined/false → disabled.
 */
export function isSmartCampaignsEnabled(): boolean {
  return process.env.SMART_CAMPAIGNS_ENABLED === "true";
}
