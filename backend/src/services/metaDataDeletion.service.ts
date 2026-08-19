import crypto from "crypto";
import { getInstagramAppSecret } from "../config/meta";
import { readEmailRuntimeConfig } from "../config/email";
import { prisma } from "../lib/prisma";
import { parseMetaSignedRequest } from "../utils/metaSignedRequest";
import { AppError } from "../utils/errors";
import { DISCONNECTED_INSTAGRAM_CREDENTIALS } from "./instagramAccountState";

export type MetaDeletionStatus = "received" | "completed" | "not_found";

function generateConfirmationCode(): string {
  return crypto.randomBytes(10).toString("hex");
}

function statusUrl(code: string): string {
  const frontendUrl = readEmailRuntimeConfig().frontendUrl.replace(/\/$/, "");
  return `${frontendUrl}/data-deletion/status?code=${encodeURIComponent(code)}`;
}

async function findInstagramAccountByMetaUserId(metaUserId: string) {
  return prisma.instagramAccount.findFirst({
    where: {
      OR: [{ instagramUserId: metaUserId }, { pageId: metaUserId }],
    },
  });
}

/**
 * Wipe stored Instagram credentials and stop automation for this integration.
 * Does not delete the Comment2DM login account.
 */
async function disconnectInstagramAccount(accountId: string): Promise<void> {
  await prisma.instagramAccount.update({
    where: { id: accountId },
    data: {
      ...DISCONNECTED_INSTAGRAM_CREDENTIALS,
      lastSyncAt: new Date(),
    },
  });
}

/**
 * Delete Instagram-sourced records for a Meta data-deletion callback.
 * Comment2DM email/password account is retained.
 */
async function deleteInstagramSourcedData(account: {
  id: string;
}): Promise<void> {
  await prisma.dmEvent.deleteMany({ where: { instagramAccountId: account.id } });
  await prisma.instagramAccount.update({
    where: { id: account.id },
    data: {
      ...DISCONNECTED_INSTAGRAM_CREDENTIALS,
      instagramUserId: `revoked_${account.id}`,
      username: "deleted",
      profilePictureUrl: null,
      pageId: null,
      lastSyncAt: new Date(),
    },
  });
}

export class MetaDataDeletionService {
  async handleDataDeletion(signedRequest: string | undefined): Promise<{
    url: string;
    confirmation_code: string;
  }> {
    const appSecret = getInstagramAppSecret();
    if (!appSecret) {
      throw new AppError(503, "Data deletion is temporarily unavailable");
    }

    const parsed = signedRequest
      ? parseMetaSignedRequest(signedRequest, appSecret)
      : null;
    if (!parsed?.user_id) {
      throw new AppError(400, "Invalid signed_request");
    }

    const confirmationCode = generateConfirmationCode();
    const account = await findInstagramAccountByMetaUserId(parsed.user_id);

    let status: MetaDeletionStatus = "not_found";
    if (account) {
      await deleteInstagramSourcedData(account);
      status = "completed";
    }

    await prisma.metaDataDeletionRequest.create({
      data: {
        confirmationCode,
        metaUserId: parsed.user_id,
        userId: account?.userId ?? null,
        instagramAccountId: account?.id ?? null,
        status,
        completedAt: status === "completed" ? new Date() : null,
      },
    });

    console.info("[meta] data-deletion callback", {
      foundAccount: Boolean(account),
      status,
    });

    return {
      url: statusUrl(confirmationCode),
      confirmation_code: confirmationCode,
    };
  }

  async handleDeauthorize(signedRequest: string | undefined): Promise<{ ok: true }> {
    const appSecret = getInstagramAppSecret();
    if (!appSecret) {
      throw new AppError(503, "Deauthorize is temporarily unavailable");
    }

    const parsed = signedRequest
      ? parseMetaSignedRequest(signedRequest, appSecret)
      : null;
    if (!parsed?.user_id) {
      throw new AppError(400, "Invalid signed_request");
    }

    const account = await findInstagramAccountByMetaUserId(parsed.user_id);
    if (account && account.connectionStatus === "connected") {
      await disconnectInstagramAccount(account.id);
    }

    console.info("[meta] deauthorize callback", {
      foundAccount: Boolean(account),
      alreadyDisconnected: account ? account.connectionStatus !== "connected" : true,
    });

    return { ok: true };
  }

  async getStatus(code: string | undefined): Promise<{
    confirmationCode: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }> {
    const confirmationCode = code?.trim() ?? "";
    if (!confirmationCode) {
      throw new AppError(400, "Confirmation code is required");
    }

    const row = await prisma.metaDataDeletionRequest.findUnique({
      where: { confirmationCode },
      select: {
        confirmationCode: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

    if (!row) {
      throw new AppError(404, "Deletion request not found");
    }

    return {
      confirmationCode: row.confirmationCode,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}

export const metaDataDeletionService = new MetaDataDeletionService();
