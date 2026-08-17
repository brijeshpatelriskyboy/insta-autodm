import http from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { connectMock } = vi.hoisted(() => ({
  connectMock: vi.fn(),
}));

vi.mock("../services/instagramIntegration.service", () => ({
  instagramIntegrationService: {
    connectMock,
    getStatus: vi.fn(),
    disconnect: vi.fn(),
    subscribeWebhooks: vi.fn(),
    syncFacebookPageId: vi.fn(),
    listMedia: vi.fn(),
  },
}));

import { createApp } from "../app";

function signToken(userId = "user-1"): string {
  return jwt.sign(
    { userId, email: "u@example.com", name: "U" },
    process.env.JWT_SECRET ?? "test-secret-min-16chars-vitest",
    { expiresIn: "1h" },
  );
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
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

describe("POST /api/integrations/instagram/connect/mock", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDeployEnv = process.env.COMMENT2DM_DEPLOYMENT_ENV;

  beforeEach(() => {
    connectMock.mockReset();
    connectMock.mockResolvedValue({ connected: true });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalDeployEnv === undefined) {
      delete process.env.COMMENT2DM_DEPLOYMENT_ENV;
    } else {
      process.env.COMMENT2DM_DEPLOYMENT_ENV = originalDeployEnv;
    }
  });

  it("returns 403 in production and does not call connectMock", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.COMMENT2DM_DEPLOYMENT_ENV;

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/integrations/instagram/connect/mock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${signToken()}` },
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/not available in production/i);
      expect(connectMock).not.toHaveBeenCalled();
    });
  });

  it("returns 403 when COMMENT2DM_DEPLOYMENT_ENV=production", async () => {
    process.env.NODE_ENV = "test";
    process.env.COMMENT2DM_DEPLOYMENT_ENV = "production";

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/integrations/instagram/connect/mock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${signToken()}` },
      });
      expect(res.status).toBe(403);
      expect(connectMock).not.toHaveBeenCalled();
    });
  });

  it("allows mock connect in test/development", async () => {
    process.env.NODE_ENV = "test";
    delete process.env.COMMENT2DM_DEPLOYMENT_ENV;

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/integrations/instagram/connect/mock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${signToken()}` },
      });
      expect(res.status).toBe(201);
      expect(connectMock).toHaveBeenCalledTimes(1);
    });
  });

  it("allows mock connect on hosted staging", async () => {
    process.env.NODE_ENV = "production";
    process.env.COMMENT2DM_DEPLOYMENT_ENV = "staging";

    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/integrations/instagram/connect/mock`, {
        method: "POST",
        headers: { Authorization: `Bearer ${signToken()}` },
      });
      expect(res.status).toBe(201);
      expect(connectMock).toHaveBeenCalledTimes(1);
    });
  });
});
