import { Prisma } from "@prisma/client";
import { INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS } from "../config/meta";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { decryptToken, encryptToken } from "../utils/tokenCrypto";
import { activityService } from "./activity.service";
import { metaGraphService } from "./metaGraph.service";

function mapInstagramSaveError(error: unknown): AppError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return new AppError(
        503,
        "instagram_accounts table is missing. Redeploy the backend so prisma migrate deploy can create it.",
      );
    }

    if (error.code === "P2002") {
      return new AppError(409, "This Meta account is already connected to another user.");
    }
  }

  return new AppError(
    503,
    "Could not save Meta connection. Check Railway deploy logs for prisma migrate deploy errors.",
  );
}

function logIntegrationError(context: string, error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[integrations] ${context}:`, {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: JSON.stringify(error.meta),
    });
    return;
  }

  console.error(`[integrations] ${context}:`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  });
}

const MOCK_PROFILE_PICTURE =
  "https://scontent.cdninstagram.com/v/mock-profile-picture.jpg";

function buildMockInstagramUserId(userId: string): string {
  const suffix = userId.replace(/\D/g, "").slice(-11).padStart(11, "0");
  return `178414${suffix}`;
}

function buildMockPageId(userId: string): string {
  const suffix = userId.replace(/\D/g, "").slice(-14).padStart(14, "1");
  return suffix;
}

function deriveMockUsername(userId: string, name: string | null, email: string): string {
  if (name) {
    return name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._]/g, "");
  }
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9._]/g, "");
}

function buildSetupChecklist(
  connected: boolean,
  source?: "mock" | "meta_oauth",
  webhookConfigured = false,
  facebookPageLinked = false,
) {
  return {
    // Instagram Login does not require a Professional→Page link in Meta's model;
    // mark professional when connected via either mock or real OAuth.
    professionalAccount: connected,
    facebookPageLinked: connected && facebookPageLinked,
    metaDeveloperApp: connected && source === "meta_oauth",
    webhookConfigured: connected && (source === "mock" || webhookConfigured),
  };
}

function formatAccountResponse(
  account: {
    instagramUserId: string;
    username: string;
    accountType: string;
    profilePictureUrl: string | null;
    pageId: string | null;
    connectionStatus: string;
    connectedAt: Date | null;
    lastSyncAt: Date | null;
    accessTokenEncrypted?: string;
    webhookSubscribedAt?: Date | null;
    webhookSubscribedFields?: string | null;
  } | null,
) {
  const connected = account?.connectionStatus === "connected";
  const source =
    account?.accessTokenEncrypted === "mock_encrypted_token_placeholder"
      ? "mock"
      : connected
        ? "meta_oauth"
        : undefined;
  const webhookConfigured = Boolean(account?.webhookSubscribedAt);
  const facebookPageLinked = Boolean(account?.pageId);

  return {
    connected,
    connectionStatus: account?.connectionStatus ?? "disconnected",
    username: account?.username ?? null,
    instagramUserId: account?.instagramUserId ?? null,
    accountType: account?.accountType ?? null,
    profilePictureUrl: account?.profilePictureUrl ?? null,
    pageId: account?.pageId ?? null,
    connectedAt: account?.connectedAt?.toISOString() ?? null,
    lastSyncAt: account?.lastSyncAt?.toISOString() ?? null,
    webhookSubscribedAt: account?.webhookSubscribedAt?.toISOString() ?? null,
    webhookSubscribedFields: account?.webhookSubscribedFields ?? null,
    setupChecklist: buildSetupChecklist(
      connected,
      source,
      webhookConfigured,
      facebookPageLinked,
    ),
  };
}

function deriveFacebookUsername(profile: { id: string; name?: string }): string {
  if (profile.name?.trim()) {
    return profile.name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._]/g, "");
  }
  return `fb_user_${profile.id}`;
}

/**
 * Meta Step 3: enable this IG professional account to send webhook notifications
 * to the app via POST /{ig-user-id}/subscribed_apps.
 * Failures are logged; callers decide whether to surface them.
 */
async function enableAccountWebhookSubscription(params: {
  userId: string;
  accountId: string;
  instagramUserId: string;
  accessToken: string;
  username: string;
}): Promise<{ success: true; fields: string[] } | { success: false; error: string }> {
  try {
    const result = await metaGraphService.subscribeAppWebhooks({
      igUserId: params.instagramUserId,
      accessToken: params.accessToken,
    });

    const now = new Date();
    const fieldsCsv = result.fields.join(",");

    await prisma.instagramAccount.update({
      where: { id: params.accountId },
      data: {
        webhookSubscribedAt: now,
        webhookSubscribedFields: fieldsCsv,
        lastSyncAt: now,
      },
    });

    try {
      await activityService.log(params.userId, {
        type: "webhook_subscribed",
        title: "Instagram webhooks enabled",
        description: `Subscribed @${params.username} to ${fieldsCsv} via subscribed_apps.`,
        metadata: {
          source: "instagram_subscribed_apps",
          instagramUserId: params.instagramUserId,
          fields: result.fields,
        },
      });
    } catch (error) {
      logIntegrationError("webhook subscription activity log failed", error);
    }

    return { success: true, fields: result.fields };
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : error instanceof Error
          ? error.message
          : "subscribed_apps failed";

    logIntegrationError("subscribed_apps failed", error);
    console.error("[instagram-webhooks] account not subscribed — real comments will not arrive:", {
      userId: params.userId,
      instagramUserId: params.instagramUserId,
      message,
    });

    return { success: false, error: message };
  }
}

export const instagramIntegrationService = {
  async getStatus(userId: string) {
    try {
      const account = await prisma.instagramAccount.findUnique({
        where: { userId },
      });

      return formatAccountResponse(account);
    } catch (error) {
      // A missing instagram_accounts table or transient DB error must not 500 the
      // whole Integrations page (which also drives Meta OAuth detection).
      logIntegrationError("getStatus failed — returning disconnected default", error);
      return formatAccountResponse(null);
    }
  },

  async connectMock(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const now = new Date();
    const username = deriveMockUsername(user.id, user.name, user.email);
    const instagramUserId = buildMockInstagramUserId(user.id);
    const pageId = buildMockPageId(user.id);

    const account = await prisma.instagramAccount.upsert({
      where: { userId },
      create: {
        userId,
        instagramUserId,
        username,
        accountType: "BUSINESS",
        profilePictureUrl: MOCK_PROFILE_PICTURE,
        accessTokenEncrypted: "mock_encrypted_token_placeholder",
        pageId,
        connectionStatus: "connected",
        connectedAt: now,
        lastSyncAt: now,
        webhookSubscribedAt: now,
        webhookSubscribedFields: INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS.join(","),
      },
      update: {
        instagramUserId,
        username,
        accountType: "BUSINESS",
        profilePictureUrl: MOCK_PROFILE_PICTURE,
        accessTokenEncrypted: "mock_encrypted_token_placeholder",
        pageId,
        connectionStatus: "connected",
        connectedAt: now,
        lastSyncAt: now,
        webhookSubscribedAt: now,
        webhookSubscribedFields: INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS.join(","),
      },
    });

    await activityService.log(userId, {
      type: "account_connected",
      title: "Instagram account connected",
      description: `@${account.username} connected (mock Meta integration — Phase 2a).`,
      metadata: {
        source: "mock",
        instagramUserId: account.instagramUserId,
        pageId: account.pageId,
        accountType: account.accountType,
      },
    });

    return formatAccountResponse(account);
  },

  async connectViaOAuth(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new AppError(404, "User not found for OAuth state");
    }

    const shortLived = await metaGraphService.exchangeCodeForToken(code);
    const longLived = await metaGraphService.exchangeForLongLivedToken(shortLived.access_token);
    const profile = await metaGraphService.fetchInstagramProfile(longLived.access_token);

    const now = new Date();
    const instagramUserId = String(profile.user_id ?? profile.id ?? shortLived.user_id);
    const username =
      profile.username?.trim() ||
      deriveFacebookUsername({ id: instagramUserId, name: profile.name });
    const accountType = (profile.account_type?.trim() || "BUSINESS").toUpperCase();
    const profilePictureUrl = profile.profile_picture_url ?? null;
    const accessTokenEncrypted = encryptToken(longLived.access_token);

    // Instagram Login may not return a Facebook Page ID (Page is optional for this API).
    // Probe Graph and persist only when Meta actually returns one.
    const pageLookup = await metaGraphService.resolveLinkedFacebookPageId({
      igUserId: instagramUserId,
      accessToken: longLived.access_token,
    });
    const pageId = pageLookup.pageId;

    let account;
    try {
      account = await prisma.instagramAccount.upsert({
        where: { userId },
        create: {
          userId,
          instagramUserId,
          username,
          accountType,
          profilePictureUrl,
          accessTokenEncrypted,
          pageId,
          connectionStatus: "connected",
          connectedAt: now,
          lastSyncAt: now,
          // Cleared until subscribed_apps succeeds for this token/account.
          webhookSubscribedAt: null,
          webhookSubscribedFields: null,
        },
        update: {
          instagramUserId,
          username,
          accountType,
          profilePictureUrl,
          accessTokenEncrypted,
          pageId,
          connectionStatus: "connected",
          connectedAt: now,
          lastSyncAt: now,
          webhookSubscribedAt: null,
          webhookSubscribedFields: null,
        },
      });
    } catch (error) {
      logIntegrationError("connectViaOAuth failed", error);
      throw mapInstagramSaveError(error);
    }

    try {
      await activityService.log(userId, {
        type: "account_connected",
        title: "Instagram account connected",
        description: `@${username} connected via Instagram Business Login.`,
        metadata: {
          source: "instagram_oauth",
          instagramUserId,
          accountType,
          pageId,
          pageLookupSource: pageLookup.source,
          expiresIn: longLived.expires_in ?? shortLived.expires_in ?? null,
          permissions: shortLived.permissions ?? null,
        },
      });
    } catch (error) {
      logIntegrationError("connectViaOAuth activity log failed (connection saved)", error);
    }

    const subscription = await enableAccountWebhookSubscription({
      userId,
      accountId: account.id,
      instagramUserId,
      accessToken: longLived.access_token,
      username,
    });

    console.log("[instagram-oauth] account saved:", {
      userId,
      instagramUserId,
      username: account.username,
      connectionStatus: account.connectionStatus,
      pageId,
      pageLookupSource: pageLookup.source,
      webhookSubscribed: subscription.success,
    });

    const refreshed = await prisma.instagramAccount.findUnique({ where: { id: account.id } });
    const response = formatAccountResponse(refreshed ?? account);

    return {
      ...response,
      webhookSubscription: subscription,
      pageLookup: {
        pageId: pageLookup.pageId,
        source: pageLookup.source,
        probes: pageLookup.probes,
      },
    };
  },

  /**
   * Re-probe Meta for a Facebook Page ID on an already-connected Instagram Login account.
   */
  async syncFacebookPageId(userId: string) {
    const account = await prisma.instagramAccount.findUnique({
      where: { userId },
    });

    if (!account || account.connectionStatus !== "connected") {
      throw new AppError(404, "No connected Instagram account found");
    }

    if (account.accessTokenEncrypted === "mock_encrypted_token_placeholder") {
      return {
        ...formatAccountResponse(account),
        pageLookup: {
          pageId: account.pageId,
          source: "mock" as const,
          probes: [],
        },
      };
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(account.accessTokenEncrypted);
    } catch {
      throw new AppError(
        400,
        "Stored Instagram access token could not be decrypted. Disconnect and reconnect Instagram.",
      );
    }

    const pageLookup = await metaGraphService.resolveLinkedFacebookPageId({
      igUserId: account.instagramUserId,
      accessToken,
    });

    const updated = await prisma.instagramAccount.update({
      where: { userId },
      data: {
        pageId: pageLookup.pageId,
        lastSyncAt: new Date(),
      },
    });

    return {
      ...formatAccountResponse(updated),
      pageLookup: {
        pageId: pageLookup.pageId,
        source: pageLookup.source,
        probes: pageLookup.probes,
      },
    };
  },

  /**
   * Re-run Meta Step 3 for an already-connected Instagram account.
   * Needed when OAuth completed before subscribed_apps was implemented.
   */
  async subscribeWebhooks(userId: string) {
    const account = await prisma.instagramAccount.findUnique({
      where: { userId },
    });

    if (!account || account.connectionStatus !== "connected") {
      throw new AppError(404, "No connected Instagram account found");
    }

    if (account.accessTokenEncrypted === "mock_encrypted_token_placeholder") {
      const now = new Date();
      const fieldsCsv = INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS.join(",");
      const updated = await prisma.instagramAccount.update({
        where: { userId },
        data: {
          webhookSubscribedAt: now,
          webhookSubscribedFields: fieldsCsv,
          lastSyncAt: now,
        },
      });
      return {
        ...formatAccountResponse(updated),
        webhookSubscription: { success: true as const, fields: [...INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS] },
      };
    }

    let accessToken: string;
    try {
      accessToken = decryptToken(account.accessTokenEncrypted);
    } catch {
      throw new AppError(
        400,
        "Stored Instagram access token could not be decrypted. Disconnect and reconnect Instagram.",
      );
    }

    const subscription = await enableAccountWebhookSubscription({
      userId,
      accountId: account.id,
      instagramUserId: account.instagramUserId,
      accessToken,
      username: account.username,
    });

    if (!subscription.success) {
      throw new AppError(
        502,
        `Instagram subscribed_apps failed: ${subscription.error}. Real comment webhooks will not arrive until this succeeds.`,
      );
    }

    const refreshed = await prisma.instagramAccount.findUnique({ where: { userId } });
    return {
      ...formatAccountResponse(refreshed ?? account),
      webhookSubscription: subscription,
    };
  },

  async disconnect(userId: string) {
    const account = await prisma.instagramAccount.findUnique({
      where: { userId },
    });

    if (!account || account.connectionStatus !== "connected") {
      throw new AppError(404, "No connected Instagram account found");
    }

    await prisma.instagramAccount.delete({
      where: { userId },
    });

    await activityService.log(userId, {
      type: "account_disconnected",
      title: "Instagram account disconnected",
      description: `@${account.username} was disconnected.`,
      metadata: {
        source: "mock",
        instagramUserId: account.instagramUserId,
      },
    });

    return { disconnected: true };
  },
};
