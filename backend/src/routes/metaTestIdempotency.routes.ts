import { Router } from "express";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { instagramWebhookService } from "../services/instagramWebhook.service";
import { metaGraphService } from "../services/metaGraph.service";

/**
 * TEMPORARY production idempotency probe — remove immediately after one call.
 * POST /api/meta-test/idempotency
 *
 * Runs the real webhook processor twice with the same commentId.
 * Stubs Meta private-reply so no real DM is sent and tokens are never logged.
 */
const router = Router();

router.post("/idempotency", async (_req, res, next) => {
  const originalSend = metaGraphService.sendPrivateReplyToComment;
  const originalLog = console.log;
  const capturedLogs: string[] = [];
  let sendPrivateReplyCalls = 0;

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

    const commentId = `idempotency-verify-${Date.now()}`;
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
                from: { id: "idempotency-tester", username: "idempotency_tester" },
                media: { id: "idempotency-media-probe" },
              },
            },
          ],
        },
      ],
    };

    // Count Meta calls without invoking Graph or logging tokens.
    metaGraphService.sendPrivateReplyToComment = async (params) => {
      sendPrivateReplyCalls += 1;
      if (!params.commentId || !params.messageText) {
        throw new Error("sendPrivateReply stub missing required fields");
      }
      // Intentionally ignore accessToken — never log or return it.
      return {
        recipientId: "idempotency-stub-recipient",
        messageId: `idempotency-stub-mid-${sendPrivateReplyCalls}`,
      };
    };

    console.log = (...args: unknown[]) => {
      const line = args
        .map((a) => (typeof a === "string" ? a : ""))
        .filter(Boolean)
        .join(" ");
      if (line) capturedLogs.push(line);
      originalLog.apply(console, args as Parameters<typeof console.log>);
    };

    const first = await instagramWebhookService.processWebhookPayload(payload);
    const second = await instagramWebhookService.processWebhookPayload(payload);

    const duplicateLogExact = capturedLogs.filter((line) => line === "duplicate event ignored");

    const dmEvent = await prisma.dmEvent.findUnique({
      where: {
        instagramAccountId_commentId: {
          instagramAccountId: account.id,
          commentId,
        },
      },
      select: {
        id: true,
        status: true,
        commentId: true,
        attemptCount: true,
        messageId: true,
      },
    });

    res.json({
      temporary: true,
      commentId,
      instagramUserId: account.instagramUserId,
      username: account.username,
      keywordUsed: rule.keyword,
      first,
      second,
      sendPrivateReplyCalls,
      duplicateEventIgnoredLogCount: duplicateLogExact.length,
      duplicateEventIgnoredLogged: duplicateLogExact.length >= 1,
      dmEvent,
      metaStubbed: true,
      note: "Meta sendPrivateReply was stubbed — no real DM and no tokens logged.",
    });
  } catch (error) {
    next(error);
  } finally {
    metaGraphService.sendPrivateReplyToComment = originalSend;
    console.log = originalLog;
  }
});

export default router;
