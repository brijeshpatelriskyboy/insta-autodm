import { Router } from "express";
import { getMetaGraphApiVersion } from "../config/meta";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { decryptToken } from "../utils/tokenCrypto";

/**
 * TEMPORARY Meta Graph probe — remove after production comments test.
 * GET /api/meta-test/comments
 */
const router = Router();

async function graphGet(url: string): Promise<{
  httpStatus: number;
  ok: boolean;
  body: unknown;
}> {
  const response = await fetch(url, { method: "GET" });
  const body = (await response.json()) as unknown;
  const hasError =
    body !== null &&
    typeof body === "object" &&
    "error" in body &&
    Boolean((body as { error?: unknown }).error);
  return {
    httpStatus: response.status,
    ok: response.ok && !hasError,
    body,
  };
}

router.get("/comments", async (_req, res, next) => {
  try {
    const account = await prisma.instagramAccount.findFirst({
      where: {
        connectionStatus: "connected",
        NOT: { accessTokenEncrypted: "mock_encrypted_token_placeholder" },
      },
      orderBy: { connectedAt: "desc" },
    });

    if (!account) {
      throw new AppError(404, "No connected Instagram account with a real access token found");
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

    const version = getMetaGraphApiVersion();
    const igUserId = account.instagramUserId;

    const mediaUrl = new URL(
      `https://graph.instagram.com/${version}/${encodeURIComponent(igUserId)}/media`,
    );
    mediaUrl.searchParams.set(
      "fields",
      "id,caption,media_type,media_url,permalink,timestamp,comments_count",
    );
    mediaUrl.searchParams.set("access_token", accessToken);

    const media = await graphGet(mediaUrl.toString());

    const mediaData =
      media.body &&
      typeof media.body === "object" &&
      Array.isArray((media.body as { data?: unknown }).data)
        ? ((media.body as { data: Array<{ id?: string }> }).data ?? [])
        : [];

    const firstMediaId =
      typeof mediaData[0]?.id === "string" ? mediaData[0].id : null;

    let comments: { httpStatus: number; ok: boolean; body: unknown } | null = null;
    if (firstMediaId) {
      const commentsUrl = new URL(
        `https://graph.instagram.com/${version}/${encodeURIComponent(firstMediaId)}/comments`,
      );
      commentsUrl.searchParams.set("fields", "id,text,username,timestamp,like_count");
      commentsUrl.searchParams.set("access_token", accessToken);
      comments = await graphGet(commentsUrl.toString());
    }

    res.json({
      temporary: true,
      account: {
        instagramUserId: igUserId,
        username: account.username,
        connectionStatus: account.connectionStatus,
      },
      graphApiVersion: version,
      media: {
        request: `GET /${igUserId}/media`,
        ...media,
      },
      comments: firstMediaId
        ? {
            mediaId: firstMediaId,
            request: `GET /${firstMediaId}/comments`,
            ...comments,
          }
        : {
            mediaId: null,
            skipped: true,
            reason: "No media returned from /{ig-user-id}/media",
          },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
