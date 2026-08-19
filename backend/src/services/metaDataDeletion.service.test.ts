import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMetaSignedRequestForTests } from "../utils/metaSignedRequest";

const {
  mockFindFirst,
  mockUpdate,
  mockDmDeleteMany,
  mockCreateRequest,
  mockFindUniqueRequest,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockDmDeleteMany: vi.fn(),
  mockCreateRequest: vi.fn(),
  mockFindUniqueRequest: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    instagramAccount: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    dmEvent: { deleteMany: mockDmDeleteMany },
    metaDataDeletionRequest: {
      create: mockCreateRequest,
      findUnique: mockFindUniqueRequest,
    },
  },
}));

import { metaDataDeletionService } from "./metaDataDeletion.service";

const secret = "test-instagram-app-secret";
const account = {
  id: "acct-1",
  userId: "user-1",
  instagramUserId: "ig-user-99",
  pageId: "page-1",
  connectionStatus: "connected",
};

describe("Meta data deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INSTAGRAM_APP_SECRET = secret;
    process.env.FRONTEND_URL = "https://app.example.test";
    mockCreateRequest.mockResolvedValue({});
    mockUpdate.mockResolvedValue({});
    mockDmDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("verifies signed_request, deletes Instagram-sourced data, and returns url + confirmation_code", async () => {
    mockFindFirst.mockResolvedValue(account);
    const signed = createMetaSignedRequestForTests(
      { algorithm: "HMAC-SHA256", user_id: "ig-user-99" },
      secret,
    );
    const result = await metaDataDeletionService.handleDataDeletion(signed);
    expect(result.confirmation_code).toMatch(/^[a-z0-9]+$/);
    expect(result.url).toContain("/data-deletion/status?code=");
    expect(mockDmDeleteMany).toHaveBeenCalledWith({ where: { instagramAccountId: "acct-1" } });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessTokenEncrypted: "",
          connectionStatus: "disconnected",
          instagramUserId: "revoked_acct-1",
        }),
      }),
    );
    expect(mockCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "completed", metaUserId: "ig-user-99" }),
      }),
    );
  });

  it("still returns confirmation JSON when no Instagram account matches", async () => {
    mockFindFirst.mockResolvedValue(null);
    const signed = createMetaSignedRequestForTests({ user_id: "unknown" }, secret);
    const result = await metaDataDeletionService.handleDataDeletion(signed);
    expect(result.confirmation_code).toBeTruthy();
    expect(mockDmDeleteMany).not.toHaveBeenCalled();
    expect(mockCreateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "not_found" }),
      }),
    );
  });

  it("rejects a tampered signed_request", async () => {
    await expect(metaDataDeletionService.handleDataDeletion("not-valid")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("deauthorize disconnects credentials without deleting DM events", async () => {
    mockFindFirst.mockResolvedValue(account);
    const signed = createMetaSignedRequestForTests({ user_id: "ig-user-99" }, secret);
    await expect(metaDataDeletionService.handleDeauthorize(signed)).resolves.toEqual({ ok: true });
    expect(mockDmDeleteMany).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accessTokenEncrypted: "",
          connectionStatus: "disconnected",
        }),
      }),
    );
  });
});
