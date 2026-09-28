import { prisma } from "../lib/prisma";
import { decryptToken } from "../utils/tokenCrypto";
import { metaGraphService } from "./metaGraph.service";
import { activityService } from "./activity.service";
import { reserveMonthlyDm, releaseMonthlyDm } from "./planLimits.service";

export const FOLLOW_GATE_PREFIX = "C2D_FOLLOW:";
export function followRequest(username: string) {
  return `Follow @${username}, then tap “I've followed” to receive your link or offer. You can also reply DONE here.`;
}

type Interaction = { accountId: string; senderId: string; timestamp: number; gateId?: string };

/** Ignore echoes, unrelated DMs, stale deliveries, and events for another recipient. */
export function parseFollowInteractions(body: unknown, now = Date.now()): Interaction[] {
  const payload = body as { object?: string; entry?: Array<{ id?: string; messaging?: Array<{
    sender?: { id?: string }; recipient?: { id?: string }; timestamp?: number;
    postback?: { payload?: string }; message?: { is_echo?: boolean; text?: string };
  }> }> } | null;
  if (payload?.object !== "instagram" || !Array.isArray(payload.entry)) return [];
  const results: Interaction[] = [];
  for (const entry of payload.entry) {
    if (!entry?.id || !Array.isArray(entry.messaging)) continue;
    for (const event of entry.messaging) {
      if (!event || event.message?.is_echo || !event.sender?.id || event.recipient?.id !== entry.id) continue;
      const timestamp = event.timestamp;
      // Leave a margin inside Meta's standard 24-hour messaging window.
      if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || now - timestamp > 23 * 3600_000 || timestamp > now + 300_000) continue;
      const data = event.postback?.payload;
      if (typeof data === "string" && data.startsWith(FOLLOW_GATE_PREFIX)) {
        const gateId = data.slice(FOLLOW_GATE_PREFIX.length);
        if (/^[a-zA-Z0-9_-]{1,100}$/.test(gateId)) results.push({ accountId: entry.id, senderId: event.sender.id, timestamp, gateId });
      } else if (typeof event.message?.text === "string" && event.message.text.trim().toUpperCase() === "DONE") {
        results.push({ accountId: entry.id, senderId: event.sender.id, timestamp });
      }
    }
  }
  return results;
}

export async function processFollowInteractions(body: unknown) {
  for (const event of parseFollowInteractions(body)) {
    const account = await prisma.instagramAccount.findUnique({ where: { instagramUserId: event.accountId } });
    if (!account || account.connectionStatus !== "connected") continue;
    const gate = await prisma.dmEvent.findFirst({
      where: {
        ...(event.gateId ? { id: event.gateId } : {}),
        instagramAccountId: account.id, userId: account.userId,
        followGateRecipientId: event.senderId, followGateStatus: "waiting",
        status: "sent",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) },
      },
      include: { rule: true }, orderBy: { createdAt: "desc" },
    });
    if (!gate?.rule?.isActive || !gate.rule.requireFollow || gate.rule.userId !== account.userId) continue;
    const interactionAt = new Date(event.timestamp);
    // Compare-and-set prevents parallel taps and replayed/out-of-order events.
    const claim = await prisma.dmEvent.updateMany({ where: {
      id: gate.id, followGateStatus: "waiting",
      AND: [
        { OR: [{ followGateLastInteractionAt: null }, { followGateLastInteractionAt: { lt: interactionAt } }] },
        { OR: [{ followGateCheckedAt: null }, { followGateCheckedAt: { lt: new Date(Date.now() - 10_000) } }] },
      ],
    }, data: { followGateStatus: "checking", followGateLastInteractionAt: interactionAt, followGateCheckedAt: new Date() } });
    if (!claim.count) continue;
    let quotaReserved = false;
    let sending = false;
    let sent = false;
    try {
      const accessToken = decryptToken(account.accessTokenEncrypted);
      const follows = await metaGraphService.getFollowerStatus(event.senderId, accessToken);
      const quota = await reserveMonthlyDm(account.userId);
      if (!quota.allowed) {
        await prisma.dmEvent.update({ where: { id: gate.id }, data: { followGateStatus: "waiting", errorSummary: "Monthly DM limit reached during follow check" } });
        await activityService.log(account.userId, { type: "dm_quota_blocked", title: "Follow check — monthly DM limit reached", description: "The follow-up was not sent. Each follow-up DM counts toward your monthly allowance." });
        continue;
      }
      quotaReserved = true;
      // Do not auto-retry uncertain sends after a timeout or process crash.
      await prisma.dmEvent.update({ where: { id: gate.id }, data: { followGateStatus: "delivering" } });
      sending = true;
      const result = await metaGraphService.sendPrivateReplyToComment({
        igUserId: account.instagramUserId, recipientId: event.senderId, accessToken,
        messageText: follows ? gate.rule.dmMessage : `We couldn't confirm your follow yet. ${followRequest(account.username)}`,
        ...(follows ? {} : { followGatePayload: `${FOLLOW_GATE_PREFIX}${gate.id}` }),
      });
      sent = true;
      await prisma.dmEvent.update({ where: { id: gate.id }, data: {
        followGateStatus: follows ? "delivered" : "waiting",
        followGateMessageId: follows ? result.messageId : null, errorSummary: null,
      } });
      await activityService.log(account.userId, {
        type: follows ? "follow_offer_sent" : "follow_check_pending",
        title: follows ? "Follow verified — offer sent" : "Waiting for follow",
        description: follows ? "Instagram confirmed the follow and the rule's DM was sent." : "The offer remains locked. The recipient can follow and tap again.",
        metadata: { ruleId: gate.ruleId, dmEventId: gate.id, messageId: result.messageId },
      });
    } catch {
      // A network failure while sending is ambiguous: keep the quota and require
      // review instead of risking duplicate delivery or sending without a check.
      if (quotaReserved && !sending) await releaseMonthlyDm(account.userId);
      if (!sent) await prisma.dmEvent.update({ where: { id: gate.id }, data: {
        followGateStatus: sending ? "review_required" : "waiting",
        errorSummary: sending ? "Follow-up delivery uncertain; review Instagram inbox before retrying." : "Could not verify follow status. Recipient can reply DONE to try again.",
      } });
      await activityService.log(account.userId, {
        type: "follow_check_failed", title: sent ? "Follow-up sent — activity update failed" : "Follow check needs attention",
        description: sending ? "Check the Instagram conversation before sending anything again." : "The offer was not released. Ask the recipient to reply DONE to try again; check Instagram messaging permissions if this continues.",
        metadata: { ruleId: gate.ruleId, dmEventId: gate.id },
      });
    }
  }
}
