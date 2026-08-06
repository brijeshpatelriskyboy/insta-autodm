import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { instagramWebhookService } from "../services/instagramWebhook.service";
import { metaGraphService } from "../services/metaGraph.service";

/**
 * TEMPORARY production DM-failure probe — remove immediately after one call.
 * POST /api/meta-test/dm-failure-sim
 *
 * Runs the real webhook failure path with Meta private-reply stubbed to throw
 * code 10 / "User not eligible for private reply". Never calls Meta with a token.
 */
const router = Router();

const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._\-]+/i,
  /access_token=/i,
  /client_secret=/i,
  /IGQ[A-Za-z0-9]{10,}/,
  /sk_live_|sk_test_|whsec_/,
];

function containsSecret(value: unknown): boolean {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return SECRET_PATTERNS.some((re) => re.test(text));
}

router.post("/dm-failure-sim", async (_req, res, next) => {
  const originalSend = metaGraphService.sendPrivateReplyToComment;
  const originalLog = console.log;
  const originalError = console.error;
  const capturedLogLines: string[] = [];

  try {
    const account = await prisma.instagramAccount.findFirst({
      where: {
        connectionStatus: "connected",
        NOT: { accessTokenEncrypted: "mock_encrypted_token_placeholder" },
      },
      orderBy: { connectedAt: "desc" },
      select: {
        id: true,
        userId: true,
        instagramUserId: true,
        username: true,
      },
    });

    if (!account) {
      throw new AppError(404, "No connected Instagram account with a real token found");
    }

    const rule = await prisma.keywordRule.findFirst({
      where: { userId: account.userId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, keyword: true },
    });

    if (!rule) {
      throw new AppError(404, "No active keyword rule found for connected account");
    }

    const commentId = `dm-failure-sim-${Date.now()}`;
    const metaErrorCode = 10;
    const metaErrorMessage = "User not eligible for private reply";

    const payload = {
      object: "instagram",
      entry: [
        {
          id: account.instagramUserId,
          time: Date.now(),
          changes: [
            {
              field: "comments",
              value: {
                id: commentId,
                text: `Please send ${rule.keyword} info`,
                from: { id: "dm-failure-sim-user", username: "dm_failure_sim" },
                media: { id: "dm-failure-sim-media" },
              },
            },
          ],
        },
      ],
    };

    // Stub Meta — never use the real access token / never hit Graph.
    metaGraphService.sendPrivateReplyToComment = async () => {
      throw new AppError(502, metaErrorMessage, metaErrorCode, metaErrorMessage);
    };

    const capture = (...args: unknown[]) => {
      capturedLogLines.push(
        args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
      );
    };
    console.log = (...args: unknown[]) => {
      capture(...args);
      originalLog.apply(console, args as Parameters<typeof console.log>);
    };
    console.error = (...args: unknown[]) => {
      capture(...args);
      originalError.apply(console, args as Parameters<typeof console.error>);
    };

    const processResult = await instagramWebhookService.processWebhookPayload(payload);

    const dmEvent = await prisma.dmEvent.findUnique({
      where: {
        instagramAccountId_commentId: {
          instagramAccountId: account.id,
          commentId,
        },
      },
      select: {
        id: true,
        commentId: true,
        status: true,
        attemptCount: true,
        errorSummary: true,
        metaErrorCode: true,
        metaErrorMessage: true,
        messageId: true,
      },
    });

    const activity = await prisma.activityEvent.findFirst({
      where: {
        userId: account.userId,
        type: "dm_failed",
        metadata: {
          path: ["commentId"],
          equals: commentId,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        metadata: true,
        createdAt: true,
      },
    });

    const metadata =
      activity?.metadata && typeof activity.metadata === "object" && !Array.isArray(activity.metadata)
        ? (activity.metadata as Record<string, unknown>)
        : null;

    const checks = {
      titleIsRetryAvailable: activity?.title === "Failed — retry available",
      descriptionHasCode10: Boolean(activity?.description?.includes("10")),
      descriptionHasMessage: Boolean(
        activity?.description?.includes("User not eligible for private reply"),
      ),
      metadataMetaErrorCode: metadata?.metaErrorCode === 10,
      metadataMetaErrorMessage: metadata?.metaErrorMessage === "User not eligible for private reply",
      metadataFailureStatus: metadata?.failureStatus === "retry_available",
      metadataAttemptCount: metadata?.attemptCount === 1,
      dmAttemptCountIs1: dmEvent?.attemptCount === 1,
      dmMetaErrorCodeIs10: dmEvent?.metaErrorCode === 10,
      dmMetaErrorMessageExact: dmEvent?.metaErrorMessage === "User not eligible for private reply",
      processFailed: processResult.failed === 1,
      noSecretsInActivity: activity ? !containsSecret(activity) : false,
      noSecretsInDmEvent: dmEvent ? !containsSecret(dmEvent) : false,
      noSecretsInCapturedLogs: !containsSecret(capturedLogLines),
    };

    const allChecksPassed = Object.values(checks).every(Boolean);

    res.json({
      temporary: true,
      metaStubbed: true,
      note: "Meta sendPrivateReply was stubbed — no real Graph call and no token used.",
      commentId,
      username: account.username,
      keywordUsed: rule.keyword,
      processResult,
      activityEvent: activity
        ? {
            id: activity.id,
            type: activity.type,
            title: activity.title,
            description: activity.description,
            metadata: activity.metadata,
            createdAt: activity.createdAt.toISOString(),
          }
        : null,
      dmEvent,
      checks,
      allChecksPassed,
    });
  } catch (error) {
    next(error);
  } finally {
    metaGraphService.sendPrivateReplyToComment = originalSend;
    console.log = originalLog;
    console.error = originalError;
  }
});

export default router;
