import http from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listByUser } = vi.hoisted(() => ({
  listByUser: vi.fn(),
}));

vi.mock("../services/campaign.service", () => ({
  campaignService: {
    listByUser,
    getById: vi.fn(),
    create: vi.fn(),
    patch: vi.fn(),
    activate: vi.fn(),
    pause: vi.fn(),
    archive: vi.fn(),
    listClaims: vi.fn(),
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
});
