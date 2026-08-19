import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockFindUnique,
  mockUpdate,
  mockActivityLog,
} = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockActivityLog: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    instagramAccount: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

vi.mock("./activity.service", () => ({
  activityService: { log: mockActivityLog },
}));

import { instagramIntegrationService } from "./instagramIntegration.service";

const connectedAccount = {
  id: "acct-1",
  userId: "user-1",
  instagramUserId: "ig-1",
  username: "brand",
  connectionStatus: "connected",
  accessTokenEncrypted: "iv:tag:cipher",
};

describe("instagramIntegrationService.disconnect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActivityLog.mockResolvedValue({ id: "act-1" });
    mockUpdate.mockResolvedValue({ ...connectedAccount, connectionStatus: "disconnected" });
  });

  it("wipes credentials for the authenticated user and keeps the row", async () => {
    mockFindUnique.mockResolvedValue(connectedAccount);
    const result = await instagramIntegrationService.disconnect("user-1");
    expect(result).toEqual({ disconnected: true });
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        data: expect.objectContaining({
          accessTokenEncrypted: "",
          connectionStatus: "disconnected",
          webhookSubscribedAt: null,
          webhookSubscribedFields: null,
        }),
      }),
    );
  });

  it("is idempotent when already disconnected or missing", async () => {
    mockFindUnique.mockResolvedValue({ ...connectedAccount, connectionStatus: "disconnected" });
    await expect(instagramIntegrationService.disconnect("user-1")).resolves.toEqual({
      disconnected: true,
      alreadyDisconnected: true,
    });
    expect(mockUpdate).not.toHaveBeenCalled();

    mockFindUnique.mockResolvedValue(null);
    await expect(instagramIntegrationService.disconnect("user-1")).resolves.toEqual({
      disconnected: true,
      alreadyDisconnected: true,
    });
  });

  it("does not look up another user's integration", async () => {
    mockFindUnique.mockResolvedValue(connectedAccount);
    await instagramIntegrationService.disconnect("user-1");
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mockFindUnique).not.toHaveBeenCalledWith({ where: { userId: "user-2" } });
  });
});
