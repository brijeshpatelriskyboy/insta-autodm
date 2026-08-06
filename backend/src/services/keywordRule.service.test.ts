import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const {
  mockFindMany,
  mockFindFirst,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockFindUniqueAccount,
  mockGetMediaById,
  mockDecryptToken,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockFindUniqueAccount: vi.fn(),
  mockGetMediaById: vi.fn(),
  mockDecryptToken: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    keywordRule: {
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
    instagramAccount: {
      findUnique: mockFindUniqueAccount,
    },
  },
}));

vi.mock("./metaGraph.service", () => ({
  metaGraphService: {
    getInstagramMediaById: mockGetMediaById,
    listInstagramMedia: vi.fn(),
  },
}));

vi.mock("../utils/tokenCrypto", () => ({
  decryptToken: mockDecryptToken,
  encryptToken: vi.fn(),
}));

import {
  MEDIA_SCOPE_GLOBAL,
  keywordRuleService,
  toMediaScopeKey,
} from "./keywordRule.service";
import { AppError } from "../utils/errors";

const connectedAccount = {
  id: "acct-1",
  userId: "user-1",
  instagramUserId: "ig-1",
  connectionStatus: "connected",
  accessTokenEncrypted: "iv:tag:cipher",
};

describe("keywordRule media scope helpers", () => {
  it("maps null media id to __GLOBAL__", () => {
    expect(toMediaScopeKey(null)).toBe(MEDIA_SCOPE_GLOBAL);
    expect(toMediaScopeKey(undefined)).toBe(MEDIA_SCOPE_GLOBAL);
    expect(toMediaScopeKey("  ")).toBe(MEDIA_SCOPE_GLOBAL);
    expect(toMediaScopeKey("media-a")).toBe("media-a");
  });
});

describe("keywordRuleService media scope CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecryptToken.mockReturnValue("token");
    mockFindUniqueAccount.mockResolvedValue(connectedAccount);
    mockGetMediaById.mockImplementation(async ({ mediaId }: { mediaId: string }) => ({
      id: mediaId,
      caption: `Caption for ${mediaId}`,
      mediaType: "VIDEO",
      thumbnailUrl: `https://cdn.example/${mediaId}.jpg`,
      permalink: `https://instagram.com/p/${mediaId}`,
    }));
  });

  it("creates the same keyword on two different posts", async () => {
    mockCreate
      .mockResolvedValueOnce({
        id: "r1",
        keyword: "GUIDE",
        instagramMediaId: "media-a",
        mediaScopeKey: "media-a",
      })
      .mockResolvedValueOnce({
        id: "r2",
        keyword: "GUIDE",
        instagramMediaId: "media-b",
        mediaScopeKey: "media-b",
      });

    const a = await keywordRuleService.create("user-1", {
      keyword: "guide",
      dmMessage: "Hello A",
      instagramMediaId: "media-a",
    });
    const b = await keywordRuleService.create("user-1", {
      keyword: "guide",
      dmMessage: "Hello B",
      instagramMediaId: "media-b",
    });

    expect(a.mediaScopeKey).toBe("media-a");
    expect(b.mediaScopeKey).toBe("media-b");
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate.mock.calls[0]?.[0].data).toEqual(
      expect.objectContaining({
        keyword: "GUIDE",
        instagramMediaId: "media-a",
        mediaScopeKey: "media-a",
        mediaType: "VIDEO",
      }),
    );
    expect(mockCreate.mock.calls[1]?.[0].data).toEqual(
      expect.objectContaining({
        keyword: "GUIDE",
        mediaScopeKey: "media-b",
      }),
    );
  });

  it("rejects duplicate keyword on the same post via unique constraint", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    mockCreate.mockRejectedValue(err);

    await expect(
      keywordRuleService.create("user-1", {
        keyword: "GUIDE",
        dmMessage: "Dup",
        instagramMediaId: "media-a",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("already exists"),
    } satisfies Partial<AppError>);
  });

  it("allows only one global rule per keyword (unique on __GLOBAL__)", async () => {
    mockCreate.mockResolvedValueOnce({
      id: "g1",
      keyword: "GUIDE",
      instagramMediaId: null,
      mediaScopeKey: MEDIA_SCOPE_GLOBAL,
    });
    const global = await keywordRuleService.create("user-1", {
      keyword: "GUIDE",
      dmMessage: "Global",
      instagramMediaId: null,
    });
    expect(global.mediaScopeKey).toBe(MEDIA_SCOPE_GLOBAL);
    expect(mockCreate.mock.calls[0]?.[0].data).toEqual(
      expect.objectContaining({
        instagramMediaId: null,
        mediaScopeKey: MEDIA_SCOPE_GLOBAL,
        mediaType: null,
        mediaThumbnailUrl: null,
        mediaCaption: null,
        mediaPermalink: null,
      }),
    );

    const err = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "test",
    });
    mockCreate.mockRejectedValueOnce(err);
    await expect(
      keywordRuleService.create("user-1", {
        keyword: "GUIDE",
        dmMessage: "Second global",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("clears media metadata when switching a rule back to All posts", async () => {
    mockFindFirst.mockResolvedValue({
      id: "r1",
      userId: "user-1",
      keyword: "GUIDE",
      instagramMediaId: "media-a",
      mediaScopeKey: "media-a",
    });
    mockUpdate.mockResolvedValue({
      id: "r1",
      keyword: "GUIDE",
      instagramMediaId: null,
      mediaScopeKey: MEDIA_SCOPE_GLOBAL,
      mediaType: null,
    });

    await keywordRuleService.update("user-1", "r1", { instagramMediaId: null });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({
          instagramMediaId: null,
          mediaScopeKey: MEDIA_SCOPE_GLOBAL,
          mediaType: null,
          mediaThumbnailUrl: null,
          mediaCaption: null,
          mediaPermalink: null,
        }),
      }),
    );
    expect(mockGetMediaById).not.toHaveBeenCalled();
  });
});
