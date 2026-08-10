import { isSmartCampaignsEnabled } from "../config/smartCampaigns";
import {
  standardDmResponseService,
  type StandardDmExecuteParams,
  type StandardDmResponseResult,
} from "./standardDmResponse.service";

/**
 * Optional future alternate response (e.g. smart campaigns).
 * Not wired in production for this milestone — DI exists for isolation tests only.
 */
export type CampaignResponseResolver = {
  tryResolve: (
    params: StandardDmExecuteParams,
  ) => Promise<StandardDmResponseResult | null>;
};

export type ResponseRouterDeps = {
  campaignResolver?: CampaignResponseResolver;
  standardDmExecute?: (
    params: StandardDmExecuteParams,
  ) => Promise<StandardDmResponseResult>;
};

/**
 * Post-match / pre-send response router.
 *
 * This milestone: always ends at Standard DM.
 * When the flag is off/missing/invalid, campaignResolver must never be invoked.
 * When the flag is on and a resolver is injected, it may be consulted; null → Standard DM.
 */
export function createResponseRouter(deps: ResponseRouterDeps = {}) {
  const runStandard =
    deps.standardDmExecute ??
    ((params: StandardDmExecuteParams) => standardDmResponseService.execute(params));

  return {
    async dispatch(params: StandardDmExecuteParams): Promise<StandardDmResponseResult> {
      if (isSmartCampaignsEnabled()) {
        if (deps.campaignResolver) {
          const alternate = await deps.campaignResolver.tryResolve(params);
          if (alternate) {
            return alternate;
          }
        }
      }

      return runStandard(params);
    },
  };
}

/** Default router used by the webhook hot path (no campaign resolver). */
export const responseRouter = createResponseRouter();
