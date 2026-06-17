import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { encryptToken } from "../utils/tokenCrypto";
import { activityService } from "./activity.service";
import { metaGraphService } from "./metaGraph.service";

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

function buildSetupChecklist(connected: boolean, source?: "mock" | "meta_oauth") {
  return {
    professionalAccount: connected && source === "mock",
    facebookPageLinked: connected && source === "mock",
    metaDeveloperApp: connected && source === "meta_oauth",
    webhookConfigured: false,
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
  } | null,
) {
  const connected = account?.connectionStatus === "connected";
  const source =
    account?.accessTokenEncrypted === "mock_encrypted_token_placeholder"
      ? "mock"
      : connected
        ? "meta_oauth"
        : undefined;

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
    setupChecklist: buildSetupChecklist(connected, source),
  };
}

function deriveFacebookUsername(profile: { id: string; name?: string }): string {
  if (profile.name?.trim()) {
    return profile.name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._]/g, "");
  }
  return `fb_user_${profile.id}`;
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

    const tokenResponse = await metaGraphService.exchangeCodeForToken(code);
    const profile = await metaGraphService.fetchFacebookProfile(tokenResponse.access_token);

    const now = new Date();
    const username = deriveFacebookUsername(profile);
    const instagramUserId = `fb_${profile.id}`;
    const profilePictureUrl = profile.picture?.data?.url ?? null;
    const accessTokenEncrypted = encryptToken(tokenResponse.access_token);

    let account;
    try {
      account = await prisma.instagramAccount.upsert({
        where: { userId },
        create: {
          userId,
          instagramUserId,
          username,
          accountType: "FACEBOOK_USER",
          profilePictureUrl,
          accessTokenEncrypted,
          connectionStatus: "connected",
          connectedAt: now,
          lastSyncAt: now,
        },
        update: {
          instagramUserId,
          username,
          accountType: "FACEBOOK_USER",
          profilePictureUrl,
          accessTokenEncrypted,
          connectionStatus: "connected",
          connectedAt: now,
          lastSyncAt: now,
        },
      });
    } catch (error) {
      logIntegrationError("connectViaOAuth failed", error);
      throw new AppError(503, "Could not save Meta connection. Database may need migration.");
    }

    await activityService.log(userId, {
      type: "account_connected",
      title: "Meta account connected",
      description: `${profile.name ?? username} connected via Meta OAuth (Facebook login — no Instagram permissions yet).`,
      metadata: {
        source: "meta_oauth",
        facebookUserId: profile.id,
        accountType: "FACEBOOK_USER",
        expiresIn: tokenResponse.expires_in ?? null,
      },
    });

    console.log("[meta-oauth] account saved:", {
      userId,
      facebookUserId: profile.id,
      username: account.username,
      connectionStatus: account.connectionStatus,
    });

    return formatAccountResponse(account);
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
