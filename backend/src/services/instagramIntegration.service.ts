import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { activityService } from "./activity.service";

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

function buildSetupChecklist(connected: boolean) {
  return {
    professionalAccount: connected,
    facebookPageLinked: connected,
    metaDeveloperApp: false,
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
  } | null,
) {
  const connected = account?.connectionStatus === "connected";

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
    setupChecklist: buildSetupChecklist(connected),
  };
}

export const instagramIntegrationService = {
  async getStatus(userId: string) {
    const account = await prisma.instagramAccount.findUnique({
      where: { userId },
    });

    return formatAccountResponse(account);
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
