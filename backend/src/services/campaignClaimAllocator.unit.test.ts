import { describe, expect, it } from "vitest";
import { CampaignClaimAllocator } from "./campaignClaimAllocator";

describe("CampaignClaimAllocator missing identity (unit)", () => {
  it("returns MISSING_IDENTITY without touching the database", async () => {
    const db = {
      $transaction: async () => {
        throw new Error("should not open a transaction");
      },
    };
    const allocator = new CampaignClaimAllocator(db as never);
    const result = await allocator.allocate({
      campaignId: "camp-1",
      sourceCommentId: "c1",
      instagramCommenterId: null,
      instagramUsername: "someone",
    });
    expect(result).toEqual({ outcome: "MISSING_IDENTITY" });
  });
});
