import { isSmartCampaignsEnabled } from "../config/smartCampaigns";
import { prisma } from "../lib/prisma";
import {
  activeCampaignLookup as defaultLookup,
  type ActiveCampaignLookup,
  type ActiveCampaignLookupResult,
} from "./activeCampaignLookup";
import { activityService } from "./activity.service";
import {
  smartCampaignResponseService,
  type SmartCampaignExecuteParams,
  type SmartCampaignResponseResult,
} from "./smartCampaignResponse.service";
import {
  buildActivityMetadata,
  dmFailureActivityTitle,
  resolveDmFailureStatus,
  sanitizeErrorSummary,
  standardDmResponseService,
  type StandardDmExecuteParams,
  type StandardDmResponseResult,
} from "./standardDmResponse.service";

export type ResponseRouterDeps = {
  standardDmExecute?: (
    params: StandardDmExecuteParams,
  ) => Promise<StandardDmResponseResult>;
  smartCampaignExecute?: (
    params: SmartCampaignExecuteParams,
  ) => Promise<SmartCampaignResponseResult>;
  findCampaign?: ActiveCampaignLookup["forKeywordRule"];
  /** Test seam — defaults to isSmartCampaignsEnabled(). */
  isEnabled?: () => boolean;
};

/**
 * Post-match / pre-send response router.
 *
 * Decision tree:
 * 1. Flag off/missing/invalid → StandardDmResponseService (zero campaign lookup).
 * 2. Flag on → lookup ACTIVE (any window) else single PAUSED for rule+user.
 * 3. none → Standard DM
 * 4. found → SmartCampaignResponseService
 * 5. ambiguous / lookup throw → fail closed (no Standard DM fallback)
 *
 * Window / sold-out / pause messaging lives in SmartCampaignResponseService.
 */
export function createResponseRouter(deps: ResponseRouterDeps = {}) {
  const runStandard =
    deps.standardDmExecute ??
    ((params: StandardDmExecuteParams) => standardDmResponseService.execute(params));

  const runSmart =
    deps.smartCampaignExecute ??
    ((params: SmartCampaignExecuteParams) => smartCampaignResponseService.execute(params));

  const findCampaign =
    deps.findCampaign ??
    ((args: { keywordRuleId: string; userId: string }) =>
      defaultLookup.forKeywordRule(args));

  const isEnabled = deps.isEnabled ?? (() => isSmartCampaignsEnabled());

  return {
    async dispatch(params: StandardDmExecuteParams): Promise<StandardDmResponseResult> {
      if (!isEnabled()) {
        return runStandard(params);
      }

      let lookup: ActiveCampaignLookupResult;
      try {
        lookup = await findCampaign({
          keywordRuleId: params.matchedRule.id,
          userId: params.account.userId,
        });
      } catch (error) {
        console.error("[response-router] campaign lookup failed", {
          ruleId: params.matchedRule.id,
          error: sanitizeErrorSummary(error),
        });
        return failClosedOnLookup(params, "Campaign lookup failed");
      }

      if (lookup.status === "none") {
        return runStandard(params);
      }

      if (lookup.status === "ambiguous") {
        console.error("[response-router] ambiguous campaign lookup", {
          ruleId: params.matchedRule.id,
          detail: lookup.detail,
        });
        return failClosedOnLookup(params, lookup.detail);
      }

      return runSmart({
        account: params.account,
        matchedRule: {
          id: params.matchedRule.id,
          keyword: params.matchedRule.keyword,
        },
        campaign: lookup.campaign,
        comment: params.comment,
        dmClaim: params.claim,
        priorEventsCreated: params.priorEventsCreated,
      });
    },
  };
}

async function failClosedOnLookup(
  params: StandardDmExecuteParams,
  reason: string,
): Promise<StandardDmResponseResult> {
  const errorSummary = sanitizeErrorSummary(reason);
  const failureStatus = resolveDmFailureStatus(params.claim.attemptCount);

  await prisma.dmEvent.update({
    where: { id: params.claim.dmEventId },
    data: {
      status: "failed",
      errorSummary,
      metaErrorCode: null,
      metaErrorMessage: errorSummary,
    },
  });

  const commenter = params.comment.commenterUsername
    ? `@${params.comment.commenterUsername}`
    : "A user";

  await activityService.log(params.account.userId, {
    type: "dm_failed",
    title: dmFailureActivityTitle(failureStatus),
    description: sanitizeErrorSummary(
      `Campaign routing failed for ${commenter}: ${errorSummary}`,
    ),
    metadata: buildActivityMetadata({
      keyword: params.matchedRule.keyword,
      ruleId: params.matchedRule.id,
      comment: params.comment,
      dmStatus: "failed",
      errorSummary,
      attemptCount: params.claim.attemptCount,
      failureStatus,
    }),
  });

  return {
    matched: true,
    sent: false,
    failed: true,
    duplicate: false,
    eventsCreated: params.priorEventsCreated + 1,
  };
}

/** Default router used by the webhook hot path. */
export const responseRouter = createResponseRouter();
