/**
 * Feature flags from GET /api/features (backend is source of truth).
 * Campaign UI must stay hidden unless smartCampaigns === true.
 */
export type FeatureFlags = {
  smartCampaigns: boolean;
};

export function parseFeatureFlags(payload: unknown): FeatureFlags {
  if (!payload || typeof payload !== "object") {
    return { smartCampaigns: false };
  }
  const smartCampaigns = (payload as { smartCampaigns?: unknown }).smartCampaigns === true;
  return { smartCampaigns };
}

/** Nav helper — used by Sidebar / tests. */
export function shouldShowCampaignsNav(flags: FeatureFlags): boolean {
  return flags.smartCampaigns === true;
}
