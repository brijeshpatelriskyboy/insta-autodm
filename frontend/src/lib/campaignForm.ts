/**
 * Client-side create-form checks (mirror backend invariants for UX).
 * Backend remains authoritative.
 */

export const FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP = 10_000;

export type CampaignFormValues = {
  name: string;
  keywordRuleId: string;
  startsAt: string;
  endsAt: string;
  maxClaims: number;
  dmTemplate: string;
  soldOutMessage: string;
  alreadyClaimedMessage: string;
  prefix: string;
};

export function validateCampaignCreateForm(
  values: CampaignFormValues,
): string | null {
  if (!values.name.trim()) return "Name is required";
  if (!values.keywordRuleId) return "Choose a keyword rule";
  if (!values.startsAt || !values.endsAt) return "Start and end times are required";
  const startsAt = new Date(values.startsAt);
  const endsAt = new Date(values.endsAt);
  if (!(startsAt.getTime() < endsAt.getTime())) {
    return "Start time must be before end time";
  }
  if (!Number.isInteger(values.maxClaims) || values.maxClaims <= 0) {
    return "Quantity must be greater than 0";
  }
  if (values.maxClaims > FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP) {
    return `Quantity cannot exceed ${FRONTEND_MAX_CAMPAIGN_CLAIMS_CAP}`;
  }
  if (!values.dmTemplate.includes("{{code}}")) {
    return "DM template must include {{code}}";
  }
  if (!values.soldOutMessage.trim()) return "Sold-out message is required";
  if (!values.alreadyClaimedMessage.trim()) {
    return "Already-claimed message is required";
  }
  if (!/^[A-Za-z0-9]{1,16}$/.test(values.prefix.trim())) {
    return "Code prefix must be 1–16 alphanumeric characters";
  }
  return null;
}
