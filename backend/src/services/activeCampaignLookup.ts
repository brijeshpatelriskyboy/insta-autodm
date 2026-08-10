/**
 * Thin Active/Paused campaign lookup for ResponseRouter dispatch.
 *
 * Policy:
 * - Only invoked when SMART_CAMPAIGNS_ENABLED=true.
 * - Returns ACTIVE campaign for the KeywordRule (any time window) so
 *   SmartCampaignResponseService/allocator can emit NOT_STARTED / ENDED.
 * - If no ACTIVE row, returns a single PAUSED campaign (paused → campaign
 *   “temporarily unavailable” path). Multiple PAUSED rows → ambiguous failure.
 * - Ownership: keywordRuleId + userId must both match.
 * - Does not allocate codes or render messages.
 */

import type { Campaign, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/prisma";

export type ActiveCampaignLookupResult =
  | { status: "none" }
  | { status: "found"; campaign: Campaign }
  | { status: "ambiguous"; detail: string };

export type ActiveCampaignLookupDeps = {
  db?: PrismaClient;
};

export class ActiveCampaignLookup {
  private readonly db: PrismaClient;

  constructor(deps: ActiveCampaignLookupDeps = {}) {
    this.db = deps.db ?? defaultPrisma;
  }

  /**
   * Find the campaign that should handle a matched keyword rule for this user.
   * Time window is intentionally NOT filtered here.
   */
  async forKeywordRule(params: {
    keywordRuleId: string;
    userId: string;
  }): Promise<ActiveCampaignLookupResult> {
    const active = await this.db.campaign.findMany({
      where: {
        keywordRuleId: params.keywordRuleId,
        userId: params.userId,
        status: "ACTIVE",
      },
      take: 2,
    });

    if (active.length > 1) {
      console.error("[active-campaign-lookup] unexpected multiple ACTIVE campaigns", {
        keywordRuleId: params.keywordRuleId,
        count: active.length,
      });
      return {
        status: "ambiguous",
        detail: "Multiple ACTIVE campaigns for keyword rule",
      };
    }

    if (active.length === 1) {
      return { status: "found", campaign: active[0]! };
    }

    const paused = await this.db.campaign.findMany({
      where: {
        keywordRuleId: params.keywordRuleId,
        userId: params.userId,
        status: "PAUSED",
      },
      orderBy: { updatedAt: "desc" },
      take: 2,
    });

    if (paused.length > 1) {
      console.error("[active-campaign-lookup] ambiguous PAUSED campaigns", {
        keywordRuleId: params.keywordRuleId,
        count: paused.length,
      });
      return {
        status: "ambiguous",
        detail: "Multiple PAUSED campaigns for keyword rule",
      };
    }

    if (paused.length === 1) {
      return { status: "found", campaign: paused[0]! };
    }

    return { status: "none" };
  }
}

export const activeCampaignLookup = new ActiveCampaignLookup();
