/**
 * Safe campaign message rendering for V2 Smart Campaigns.
 * Exact literal {{code}} replacement only — no eval / templating engine.
 */

export const CAMPAIGN_DM_MAX_LENGTH = 2000;

export type RenderCampaignMessageOptions = {
  /** When true, template must contain {{code}} and vars.code must be non-empty. */
  requireCode?: boolean;
  maxLength?: number;
};

export type RenderCampaignMessageResult =
  | { ok: true; message: string }
  | { ok: false; reason: "missing_code_placeholder" | "missing_code_value" | "message_too_long" };

/**
 * Replace every literal "{{code}}" occurrence. No other variables.
 */
export function renderCampaignMessage(
  template: string,
  vars: { code?: string | null },
  options: RenderCampaignMessageOptions = {},
): RenderCampaignMessageResult {
  const requireCode = options.requireCode === true;
  const maxLength = options.maxLength ?? CAMPAIGN_DM_MAX_LENGTH;

  if (requireCode && !template.includes("{{code}}")) {
    return { ok: false, reason: "missing_code_placeholder" };
  }

  if (requireCode && (!vars.code || !vars.code.trim())) {
    return { ok: false, reason: "missing_code_value" };
  }

  const code = vars.code ?? "";
  // Split/join avoids RegExp and replaces all exact occurrences.
  const message = template.split("{{code}}").join(code);

  if (message.length > maxLength) {
    return { ok: false, reason: "message_too_long" };
  }

  return { ok: true, message };
}

export const DEFAULT_CAMPAIGN_MESSAGES = {
  notStarted: "This campaign has not started yet.",
  ended: "This campaign has ended.",
  paused: "This campaign is temporarily unavailable.",
  missingIdentity:
    "We couldn't verify your Instagram account to issue a unique code. Please try again.",
} as const;
