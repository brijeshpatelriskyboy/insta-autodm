import http from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";

const { listByUser, getById, patch, listClaims } = vi.hoisted(() => ({
  listByUser: vi.fn(),
  getById: vi.fn(),
  patch: vi.fn(),
  listClaims: vi.fn(),
}));

vi.mock("../services/campaign.service", () => ({
  campaignService: {
    listByUser,
    getById,
    create: vi.fn(),
    patch,
    activate: vi.fn(),
    pause: vi.fn(),
    archive: vi.fn(),
    listClaims,
  },
  CampaignService: vi.fn(),
  resetCampaignCodeGeneratorForTests: vi.fn(),
  setCampaignCodeGeneratorForTests: vi.fn(),
  CAMPAIGN_EDIT_MATRIX: {},
  MAX_CAMPAIGN_CLAIMS_CAP: 10_000,
}));

import { createApp } from "../app";

function signToken(userId = "user-1"): string {
  return jwt.sign(
    { userId, email: "u@example.com", name: "U" },
    process.env.JWT_SECRET ?? "test-secret-min-16chars-vitest",
    { expiresIn: "1h" },
  );
}

async function withServer(
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe("campaign routes feature flag", () => {
  beforeEach(() => {
    listByUser.mockReset();
    getById.mockReset();
    patch.mockReset();
    listClaims.mockReset();
  });

  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
  });

  it("flag OFF → 404 and campaignService is never called", async () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/campaigns`, {
        headers: { Authorization: `Bearer ${signToken()}` },
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body).toEqual({ error: "Not found" });
      expect(listByUser).not.toHaveBeenCalled();
    });
  });

  it("flag ON → reaches service", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    listByUser.mockResolvedValue([]);
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/campaigns`, {
        headers: { Authorization: `Bearer ${signToken()}` },
      });
      expect(res.status).toBe(200);
      expect(listByUser).toHaveBeenCalledWith("user-1");
    });
  });

  it("unauthenticated GET / PATCH / claims are 401", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    await withServer(async (baseUrl) => {
      const getRes = await fetch(`${baseUrl}/api/campaigns/camp-1`);
      expect(getRes.status).toBe(401);
      const patchRes = await fetch(`${baseUrl}/api/campaigns/camp-1`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soldOutMessage: "x" }),
      });
      expect(patchRes.status).toBe(401);
      const claimsRes = await fetch(`${baseUrl}/api/campaigns/camp-1/claims`);
      expect(claimsRes.status).toBe(401);
      expect(getById).not.toHaveBeenCalled();
      expect(patch).not.toHaveBeenCalled();
      expect(listClaims).not.toHaveBeenCalled();
    });
  });

  it("scopes GET / PATCH / claims to the JWT user (other user → 404)", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    getById.mockRejectedValue(new AppError(404, "Campaign not found"));
    patch.mockRejectedValue(new AppError(404, "Campaign not found"));
    listClaims.mockRejectedValue(new AppError(404, "Campaign not found"));

    await withServer(async (baseUrl) => {
      const headers = {
        Authorization: `Bearer ${signToken("user-2")}`,
        "Content-Type": "application/json",
      };
      const getRes = await fetch(`${baseUrl}/api/campaigns/camp-1`, { headers });
      expect(getRes.status).toBe(404);
      expect(getById).toHaveBeenCalledWith("user-2", "camp-1");

      const patchRes = await fetch(`${baseUrl}/api/campaigns/camp-1`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ soldOutMessage: "Updated sold out" }),
      });
      expect(patchRes.status).toBe(404);
      expect(patch).toHaveBeenCalledWith(
        "user-2",
        "camp-1",
        expect.objectContaining({ soldOutMessage: "Updated sold out" }),
      );

      const claimsRes = await fetch(`${baseUrl}/api/campaigns/camp-1/claims`, { headers });
      expect(claimsRes.status).toBe(404);
      expect(listClaims).toHaveBeenCalledWith("user-2", "camp-1", 100);
    });
  });
});
