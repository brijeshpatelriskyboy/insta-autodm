/**
 * Feature flags from GET /api/features (backend is source of truth).
 * No Smart Campaign UI in this milestone — helper only.
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
