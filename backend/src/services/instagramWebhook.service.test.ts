import { beforeEach, describe, expect, it, vi } from "vitest";
import { DmEventStatus } from "@prisma/client";

const {
  mockFindFirstAccount,
  mockFindManyRules,
  mockDmFindUnique,
  mockDmCreate,
  mockDmUpdateMany,
  mockDmUpdate,
  mockDmFindUniqueOrThrow,
  mockActivityLog,
  mockSendPrivateReply,
  mockDecryptToken,
  mockTransaction,
} = vi.hoisted(() => ({
  mockFindFirstAccount: vi.fn(),
  mockFindManyRules: vi.fn(),
  mockDmFindUnique: vi.fn(),
  mockDmCreate: vi.fn(),
  mockDmUpdateMany: vi.fn(),
  mockDmUpdate: vi.fn(),
  mockDmFindUniqueOrThrow: vi.fn(),
  mockActivityLog: vi.fn(),
  mockSendPrivateReply: vi.fn(),
  mockDecryptToken: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    instagramAccount: { findFirst: mockFindFirstAccount },
    keywordRule: { findMany: mockFindManyRules },
    dmEvent: {
      findUnique: mockDmFindUnique,
      create: mockDmCreate,
      updateMany: mockDmUpdateMany,
      update: mockDmUpdate,
      findUniqueOrThrow: mockDmFindUniqueOrThrow,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("./activity.service", () => ({
  activityService: { log: mockActivityLog },
}));

vi.mock("./metaGraph.service", () => ({
  metaGraphService: { sendPrivateReplyToComment: mockSendPrivateReply },
}));

vi.mock("../utils/tokenCrypto", () => ({
  encryptToken: vi.fn(),
  decryptToken: mockDecryptToken,
}));

import {
  commentMatchesKeyword,
  dmFailureActivityTitle,
  formatDmErrorSummary,
  instagramWebhookService,
  MAX_DM_ATTEMPTS,
  parseInstagramCommentWebhook,
  resolveDmFailureStatus,
  sanitizeErrorSummary,
  selectMatchingKeywordRule,
} from "./instagramWebhook.service";
import { AppError } from "../utils/errors";

const sampleWebhook = {
  object: "instagram",
  entry: [
    {
      id: "ig-business-123",
      time: 1,
      changes: [
        {
          field: "comments",
          value: {
            id: "comment-abc",
            text: "I want the PRICE please",
            from: { id: "user-1", username: "buyer_jane" },
            media: { id: "media-99" },
          },
        },
      ],
    },
  ],
};

const connectedAccount = {
  id: "acct-db-1",
  userId: "user-db-1",
  instagramUserId: "ig-business-123",
  username: "brand",
  accountType: "BUSINESS",
  accessTokenEncrypted: "iv:tag:cipher",
  pageId: null,
  connectionStatus: "connected",
};

const activeRule = {
  id: "rule-1",
  userId: "user-db-1",
  keyword: "PRICE",
  dmMessage: "Thanks! Here is our price list.",
  isActive: true,
};

function stubTransaction() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      dmEvent: {
        findUnique: mockDmFindUnique,
        create: mockDmCreate,
        updateMany: mockDmUpdateMany,
        findUniqueOrThrow: mockDmFindUniqueOrThrow,
      },
    };
    return fn(tx);
  });
}

describe("instagramWebhook.service helpers", () => {
  it("matches keywords case-insensitively as substrings", () => {
    expect(commentMatchesKeyword("Need the PRICE now", "price")).toBe(true);
    expect(commentMatchesKeyword("hello", "price")).toBe(false);
  });

  it("prefers post-scoped keyword rule over a global rule", () => {
    const rules = [
      { id: "global", keyword: "GUIDE", instagramMediaId: null as string | null },
      { id: "post-a", keyword: "GUIDE", instagramMediaId: "media-a" },
      { id: "post-b", keyword: "GUIDE", instagramMediaId: "media-b" },
    ];
    expect(selectMatchingKeywordRule(rules, "send GUIDE please", "media-a")?.id).toBe("post-a");
    expect(selectMatchingKeywordRule(rules, "GUIDE", "media-b")?.id).toBe("post-b");
  });

  it("falls back to the global keyword rule when no post-specific rule exists", () => {
    const rules = [
      { id: "global", keyword: "GUIDE", instagramMediaId: null as string | null },
      { id: "post-a", keyword: "GUIDE", instagramMediaId: "media-a" },
    ];
    expect(selectMatchingKeywordRule(rules, "GUIDE", "media-other")?.id).toBe("global");
    expect(selectMatchingKeywordRule(rules, "GUIDE", null)?.id).toBe("global");
    expect(selectMatchingKeywordRule(rules, "nope", "media-a")).toBeNull();
  });

  it("sanitizes and truncates error summaries without secrets", () => {
    const summary = sanitizeErrorSummary(
      "Bearer IGQxxxSECRET failed access_token=abc123 client_secret=shh " + "x".repeat(300),
    );
    expect(summary).not.toMatch(/IGQxxxSECRET/);
    expect(summary).not.toMatch(/abc123/);
    expect(summary).not.toMatch(/\bshh\b/);
    expect(summary).toMatch(/REDACTED/);
    expect(summary.length).toBeLessThanOrEqual(240);
  });

  it("formats Meta error summaries with code and resolves failure titles", () => {
    expect(formatDmErrorSummary({ metaCode: 190, metaMessage: "Invalid OAuth" })).toBe(
      "[190] Invalid OAuth",
    );
    expect(resolveDmFailureStatus(1)).toBe("retry_available");
    expect(resolveDmFailureStatus(2)).toBe("retry_available");
    expect(resolveDmFailureStatus(3)).toBe("action_required");
    expect(dmFailureActivityTitle("retry_available")).toBe("Failed — retry available");
    expect(dmFailureActivityTitle("action_required")).toBe("Failed — action required");
  });

  it("parses comment webhooks and skips missing commentId", () => {
    const parsed = parseInstagramCommentWebhook(sampleWebhook);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.commentId).toBe("comment-abc");
    expect(parsed[0]?.mediaId).toBe("media-99");

    const missingId = parseInstagramCommentWebhook({
      object: "instagram",
      entry: [
        {
          id: "ig-business-123",
          changes: [{ field: "comments", value: { text: "hi", from: { username: "x" } } }],
        },
      ],
    });
    expect(missingId).toHaveLength(0);
  });
});

describe("processWebhookPayload private reply flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLog.mockResolvedValue({ id: "act-1" });
    mockDmUpdate.mockResolvedValue({});
    stubTransaction();
  });

  it("matches a keyword and sends a private reply, logging dm_sent", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({
      id: "dm-1",
      attemptCount: 1,
      status: DmEventStatus.sending,
    });
    mockDecryptToken.mockReturnValue("decrypted-access-token");
    mockSendPrivateReply.mockResolvedValue({
      recipientId: "igsid-1",
      messageId: "mid-1",
    });

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.matched).toBe(1);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockSendPrivateReply).toHaveBeenCalledTimes(1);
    expect(mockSendPrivateReply).toHaveBeenCalledWith(
      expect.objectContaining({
        igUserId: "ig-business-123",
        commentId: "comment-abc",
        messageText: "Thanks! Here is our price list.",
        accessToken: "decrypted-access-token",
      }),
    );
    // Claim happens before keyword matching (create with no ruleId yet).
    expect(mockDmCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          commentId: "comment-abc",
          ruleId: null,
          status: DmEventStatus.sending,
        }),
      }),
    );
    expect(mockDmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dm-1" },
        data: { ruleId: "rule-1" },
      }),
    );

    const types = mockActivityLog.mock.calls.map((c) => c[1].type);
    expect(types).toEqual(["comment_received", "keyword_matched", "dm_sent"]);
    const dmSentMeta = mockActivityLog.mock.calls.find((c) => c[1].type === "dm_sent")?.[1]
      .metadata as Record<string, unknown>;
    expect(dmSentMeta.commentId).toBe("comment-abc");
    expect(dmSentMeta.commenterUsername).toBe("buyer_jane");
    expect(dmSentMeta.keyword).toBe("PRICE");
    expect(dmSentMeta.mediaId).toBe("media-99");
    expect(dmSentMeta.dmStatus).toBe("sent");
    expect(dmSentMeta.timestamp).toBeTruthy();
    expect(JSON.stringify(dmSentMeta)).not.toMatch(/decrypted-access-token/);
  });

  it("claims then marks skipped when no keyword matches", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([{ ...activeRule, keyword: "SHIPPING" }]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({
      id: "dm-skip",
      attemptCount: 1,
      status: DmEventStatus.sending,
    });

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.matched).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockDmCreate).toHaveBeenCalled();
    expect(mockDmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dm-skip" },
        data: expect.objectContaining({ status: DmEventStatus.skipped }),
      }),
    );
    expect(mockActivityLog).not.toHaveBeenCalled();
  });

  it("first delivery sends one DM", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({ id: "dm-1", attemptCount: 1, status: DmEventStatus.sending });
    mockDecryptToken.mockReturnValue("tok");
    mockSendPrivateReply.mockResolvedValue({ recipientId: "r", messageId: "m" });

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.sent).toBe(1);
    expect(result.duplicates).toBe(0);
    expect(mockSendPrivateReply).toHaveBeenCalledTimes(1);
  });

  it("replay of the same comment ID sends no second DM and logs duplicate event ignored", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockDmFindUnique.mockResolvedValue({
      id: "dm-1",
      status: DmEventStatus.sent,
      attemptCount: 1,
    });

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.duplicates).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockFindManyRules).not.toHaveBeenCalled();
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockActivityLog).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "duplicate event ignored",
      expect.objectContaining({ commentId: "comment-abc" }),
    );
    logSpy.mockRestore();
  });

  it("new comment ID from the same person and same keyword sends normally", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({ id: "dm-1", attemptCount: 1, status: DmEventStatus.sending });
    mockDecryptToken.mockReturnValue("tok");
    mockSendPrivateReply.mockResolvedValue({ recipientId: "r1", messageId: "m1" });

    const first = await instagramWebhookService.processWebhookPayload(sampleWebhook);
    expect(first.sent).toBe(1);
    expect(mockSendPrivateReply).toHaveBeenCalledTimes(1);

    const secondWebhook = {
      object: "instagram",
      entry: [
        {
          id: "ig-business-123",
          time: 2,
          changes: [
            {
              field: "comments",
              value: {
                id: "comment-xyz-new",
                text: "I want the PRICE please",
                from: { id: "user-1", username: "buyer_jane" },
                media: { id: "media-99" },
              },
            },
          ],
        },
      ],
    };

    mockDmCreate.mockResolvedValue({ id: "dm-2", attemptCount: 1, status: DmEventStatus.sending });
    mockSendPrivateReply.mockResolvedValue({ recipientId: "r2", messageId: "m2" });

    const second = await instagramWebhookService.processWebhookPayload(secondWebhook);

    expect(second.sent).toBe(1);
    expect(second.duplicates).toBe(0);
    expect(mockSendPrivateReply).toHaveBeenCalledTimes(2);
    expect(mockSendPrivateReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ commentId: "comment-xyz-new" }),
    );
    expect(mockDmCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ commentId: "comment-xyz-new" }),
      }),
    );
  });

  it("treats skipped comment replay as duplicate event ignored", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockDmFindUnique.mockResolvedValue({
      id: "dm-skip",
      status: DmEventStatus.skipped,
      attemptCount: 1,
    });

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.duplicates).toBe(1);
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith("duplicate event ignored", expect.any(Object));
    logSpy.mockRestore();
  });

  it("logs dm_failed when token decrypt fails", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({
      id: "dm-1",
      attemptCount: 1,
      status: DmEventStatus.sending,
    });
    mockDecryptToken.mockImplementation(() => {
      throw new Error("Invalid encrypted token format");
    });

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.failed).toBe(1);
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockDmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dm-1" },
        data: expect.objectContaining({
          status: DmEventStatus.failed,
          metaErrorCode: null,
          metaErrorMessage: "Invalid encrypted token format",
        }),
      }),
    );
    const failedCall = mockActivityLog.mock.calls.find((c) => c[1].type === "dm_failed");
    expect(failedCall?.[1].title).toBe("Failed — retry available");
    expect(failedCall?.[1].type).toBe("dm_failed");
  });

  it("stores Meta error code/message and titles Failed — retry available when attempts remain", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({
      id: "dm-1",
      attemptCount: 1,
      status: DmEventStatus.sending,
    });
    mockDecryptToken.mockReturnValue("decrypted-access-token");
    mockSendPrivateReply.mockRejectedValue(
      new AppError(502, "User not eligible for private reply", 10, "User not eligible for private reply"),
    );

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.failed).toBe(1);
    expect(mockDmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dm-1" },
        data: expect.objectContaining({
          status: DmEventStatus.failed,
          metaErrorCode: 10,
          metaErrorMessage: "User not eligible for private reply",
          errorSummary: "[10] User not eligible for private reply",
        }),
      }),
    );

    const failedCall = mockActivityLog.mock.calls.find((c) => c[1].type === "dm_failed");
    expect(failedCall?.[1]).toEqual(
      expect.objectContaining({
        type: "dm_failed",
        title: "Failed — retry available",
        description: expect.stringContaining("(10): User not eligible for private reply"),
      }),
    );
    expect(failedCall?.[1].metadata).toEqual(
      expect.objectContaining({
        metaErrorCode: 10,
        metaErrorMessage: "User not eligible for private reply",
        failureStatus: "retry_available",
        attemptCount: 1,
      }),
    );
    expect(JSON.stringify(failedCall?.[1])).not.toMatch(/decrypted-access-token/);
  });

  it("titles Failed — action required when attemptCount reaches MAX_DM_ATTEMPTS", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue({
      id: "dm-1",
      status: DmEventStatus.failed,
      attemptCount: 2,
      mediaId: "media-99",
    });
    mockDmUpdateMany.mockResolvedValue({ count: 1 });
    mockDmFindUniqueOrThrow.mockResolvedValue({
      id: "dm-1",
      attemptCount: 3,
      status: DmEventStatus.sending,
    });
    mockDecryptToken.mockReturnValue("decrypted-access-token");
    mockSendPrivateReply.mockRejectedValue(
      new AppError(502, "Application request limit reached", 4, "Application request limit reached"),
    );

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.failed).toBe(1);
    expect(mockDmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DmEventStatus.failed,
          metaErrorCode: 4,
          metaErrorMessage: "Application request limit reached",
          errorSummary: "[4] Application request limit reached",
        }),
      }),
    );

    const failedCall = mockActivityLog.mock.calls.find((c) => c[1].type === "dm_failed");
    expect(failedCall?.[1].title).toBe("Failed — action required");
    expect(failedCall?.[1].type).toBe("dm_failed");
    expect(failedCall?.[1].metadata).toEqual(
      expect.objectContaining({
        failureStatus: "action_required",
        attemptCount: 3,
        metaErrorCode: 4,
      }),
    );
  });

  it("logs dm_failed on Meta API failure and retries failed→sending later", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({
      id: "dm-1",
      attemptCount: 1,
      status: DmEventStatus.sending,
    });
    mockDecryptToken.mockReturnValue("decrypted-access-token");
    mockSendPrivateReply.mockRejectedValue(new Error("Meta API timeout"));

    const first = await instagramWebhookService.processWebhookPayload(sampleWebhook);
    expect(first.failed).toBe(1);
    const firstFail = mockActivityLog.mock.calls.find((c) => c[1].type === "dm_failed");
    expect(firstFail?.[1].title).toBe("Failed — retry available");

    vi.clearAllMocks();
    mockActivityLog.mockResolvedValue({ id: "act-2" });
    mockDmUpdate.mockResolvedValue({});
    stubTransaction();
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue({
      id: "dm-1",
      status: DmEventStatus.failed,
      attemptCount: 1,
      mediaId: "media-99",
    });
    mockDmUpdateMany.mockResolvedValue({ count: 1 });
    mockDmFindUniqueOrThrow.mockResolvedValue({
      id: "dm-1",
      attemptCount: 2,
      status: DmEventStatus.sending,
    });
    mockDecryptToken.mockReturnValue("decrypted-access-token");
    mockSendPrivateReply.mockResolvedValue({ recipientId: "igsid-1", messageId: "mid-2" });

    const second = await instagramWebhookService.processWebhookPayload(sampleWebhook);
    expect(second.sent).toBe(1);
    expect(mockDmUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: DmEventStatus.failed,
          attemptCount: { lt: MAX_DM_ATTEMPTS },
        }),
        data: expect.objectContaining({
          status: DmEventStatus.sending,
          metaErrorCode: null,
          metaErrorMessage: null,
        }),
      }),
    );
    expect(mockActivityLog.mock.calls.map((c) => c[1].type)).toContain("dm_sent");
  });

  /**
   * Private reply limitations:
   * - one private reply to a commenter (not unrestricted outbound DM)
   * - Meta eligibility / response-window restrictions still apply
   */
  it("sends exactly one private reply attempt per newly claimed comment", async () => {
    mockFindFirstAccount.mockResolvedValue(connectedAccount);
    mockFindManyRules.mockResolvedValue([activeRule]);
    mockDmFindUnique.mockResolvedValue(null);
    mockDmCreate.mockResolvedValue({ id: "dm-1", attemptCount: 1, status: DmEventStatus.sending });
    mockDecryptToken.mockReturnValue("tok");
    mockSendPrivateReply.mockResolvedValue({ recipientId: "r", messageId: "m" });

    await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(mockSendPrivateReply).toHaveBeenCalledTimes(1);
    expect(mockSendPrivateReply.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        commentId: "comment-abc",
        messageText: expect.any(String),
      }),
    );
  });

  it("does not send when no connected Instagram account matches (disconnected integrations)", async () => {
    mockFindFirstAccount.mockResolvedValue(null);

    const result = await instagramWebhookService.processWebhookPayload(sampleWebhook);

    expect(result.sent).toBe(0);
    expect(result.matched).toBe(0);
    expect(mockSendPrivateReply).not.toHaveBeenCalled();
    expect(mockFindFirstAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          connectionStatus: "connected",
        }),
      }),
    );
  });
});
