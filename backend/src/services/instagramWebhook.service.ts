import { prisma } from "../lib/prisma";
import { activityService } from "./activity.service";

export interface ParsedComment {
  instagramAccountId: string;
  commentId: string;
  text: string;
  commenterUsername?: string;
  commenterId?: string;
  mediaId?: string;
}

export interface WebhookProcessResult {
  processed: number;
  matched: number;
  skipped: number;
  eventsCreated: number;
}

function commentMatchesKeyword(commentText: string, keyword: string): boolean {
  return commentText.trim().toUpperCase().includes(keyword.toUpperCase());
}

export function parseInstagramCommentWebhook(body: unknown): ParsedComment[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const payload = body as { object?: string; entry?: unknown[] };
  if (payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    return [];
  }

  const comments: ParsedComment[] = [];

  for (const entry of payload.entry) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const entryObj = entry as { id?: string; changes?: unknown[] };
    const accountId = entryObj.id?.trim();
    if (!accountId || !Array.isArray(entryObj.changes)) {
      continue;
    }

    for (const change of entryObj.changes) {
      if (!change || typeof change !== "object") {
        continue;
      }

      const changeObj = change as { field?: string; value?: unknown };
      if (changeObj.field !== "comments" && changeObj.field !== "live_comments") {
        continue;
      }

      const value = changeObj.value;
      if (!value || typeof value !== "object") {
        continue;
      }

      const valueObj = value as {
        id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string };
      };

      const text = valueObj.text?.trim();
      if (!text) {
        continue;
      }

      comments.push({
        instagramAccountId: accountId,
        commentId: valueObj.id ?? `unknown-${Date.now()}`,
        text,
        commenterUsername: valueObj.from?.username,
        commenterId: valueObj.from?.id,
        mediaId: valueObj.media?.id,
      });
    }
  }

  return comments;
}

async function findAccountByInstagramId(instagramAccountId: string) {
  return prisma.instagramAccount.findFirst({
    where: {
      connectionStatus: "connected",
      OR: [{ instagramUserId: instagramAccountId }, { pageId: instagramAccountId }],
    },
  });
}

async function matchAndLogComment(comment: ParsedComment): Promise<boolean> {
  const account = await findAccountByInstagramId(comment.instagramAccountId);
  if (!account) {
    console.log("[webhook] no connected account for instagram id:", {
      instagramAccountId: comment.instagramAccountId,
      commentId: comment.commentId,
    });
    return false;
  }

  const rules = await prisma.keywordRule.findMany({
    where: { userId: account.userId, isActive: true },
  });

  const matchedRule = rules.find((rule) => commentMatchesKeyword(comment.text, rule.keyword));
  if (!matchedRule) {
    console.log("[webhook] comment received, no keyword match:", {
      userId: account.userId,
      commentId: comment.commentId,
      activeRuleCount: rules.length,
    });
    return false;
  }

  const commenter = comment.commenterUsername ? `@${comment.commenterUsername}` : "A user";
  const metadata = {
    keyword: matchedRule.keyword,
    ruleId: matchedRule.id,
    commentId: comment.commentId,
    commentText: comment.text.slice(0, 200),
    commenterUsername: comment.commenterUsername ?? null,
    commenterId: comment.commenterId ?? null,
    mediaId: comment.mediaId ?? null,
    instagramAccountId: comment.instagramAccountId,
    dmStatus: "pending",
  };

  const truncatedComment =
    comment.text.length > 80 ? `${comment.text.slice(0, 80)}…` : comment.text;

  await activityService.log(account.userId, {
    type: "comment_received",
    title: "Comment received",
    description: `${commenter} commented: "${truncatedComment}"`,
    metadata,
  });

  await activityService.log(account.userId, {
    type: "keyword_matched",
    title: `Keyword matched: ${matchedRule.keyword}`,
    description: `${commenter} triggered your "${matchedRule.keyword}" rule.`,
    metadata,
  });

  await activityService.log(account.userId, {
    type: "dm_pending",
    title: "DM pending",
    description: `Auto-DM queued for ${commenter} (not sent yet — Phase 2d foundation).`,
    metadata,
  });

  console.log("[webhook] keyword matched:", {
    userId: account.userId,
    keyword: matchedRule.keyword,
    ruleId: matchedRule.id,
    commentId: comment.commentId,
    commenter: comment.commenterUsername ?? null,
  });

  return true;
}

export const instagramWebhookService = {
  parseInstagramCommentWebhook,

  async processWebhookPayload(body: unknown): Promise<WebhookProcessResult> {
    const payload = body as { object?: string; entry?: unknown[] };
    const comments = parseInstagramCommentWebhook(body);

    console.log("[webhook] processing payload:", {
      object: payload.object ?? "unknown",
      entryCount: Array.isArray(payload.entry) ? payload.entry.length : 0,
      commentCount: comments.length,
    });

    let matched = 0;
    let skipped = 0;

    for (const comment of comments) {
      const didMatch = await matchAndLogComment(comment);
      if (didMatch) {
        matched++;
      } else {
        skipped++;
      }
    }

    return {
      processed: comments.length,
      matched,
      skipped,
      eventsCreated: matched * 3,
    };
  },
};
