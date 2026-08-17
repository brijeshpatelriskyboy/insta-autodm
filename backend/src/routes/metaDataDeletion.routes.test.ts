import http from "http";
import type { AddressInfo } from "net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMetaSignedRequestForTests } from "../utils/metaSignedRequest";

const { handleDataDeletion, handleDeauthorize, getStatus } = vi.hoisted(() => ({
  handleDataDeletion: vi.fn(),
  handleDeauthorize: vi.fn(),
  getStatus: vi.fn(),
}));

vi.mock("../services/metaDataDeletion.service", () => ({
  metaDataDeletionService: {
    handleDataDeletion,
    handleDeauthorize,
    getStatus,
  },
  MetaDataDeletionService: vi.fn(),
}));

import { createApp } from "../app";

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

describe("Meta data-deletion routes", () => {
  beforeEach(() => {
    handleDataDeletion.mockReset();
    handleDeauthorize.mockReset();
    getStatus.mockReset();
    handleDataDeletion.mockResolvedValue({
      url: "https://app.example.test/data-deletion/status?code=abc",
      confirmation_code: "abc",
    });
    handleDeauthorize.mockResolvedValue({ ok: true });
    getStatus.mockResolvedValue({
      confirmationCode: "abc",
      status: "completed",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
  });

  it("accepts form-encoded signed_request on POST /api/meta/data-deletion", async () => {
    const signed = createMetaSignedRequestForTests(
      { user_id: "ig-1" },
      "unused-in-mocked-service",
    );
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/meta/data-deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ signed_request: signed }).toString(),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        url: "https://app.example.test/data-deletion/status?code=abc",
        confirmation_code: "abc",
      });
      expect(handleDataDeletion).toHaveBeenCalledWith(signed);
    });
  });

  it("exposes public status by confirmation code", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/meta/data-deletion/status?code=abc`);
      expect(res.status).toBe(200);
      expect(handleDeauthorize).not.toHaveBeenCalled();
    });
  });
});
