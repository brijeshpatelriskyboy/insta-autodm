import http from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";

const { deleteAccount } = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
}));

vi.mock("../services/account.service", () => ({
  ACCOUNT_DELETE_CONFIRMATION: "DELETE",
  accountService: { deleteAccount },
  AccountService: vi.fn(),
}));

import { createApp } from "../app";

function signToken(userId = "user-1"): string {
  return jwt.sign(
    { userId, email: "ada@example.com", name: "Ada" },
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

describe("DELETE /api/account", () => {
  beforeEach(() => {
    deleteAccount.mockReset();
    deleteAccount.mockResolvedValue({ deleted: true });
  });

  it("rejects unauthenticated requests", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: "x", confirmation: "DELETE" }),
      });
      expect(res.status).toBe(401);
      expect(deleteAccount).not.toHaveBeenCalled();
    });
  });

  it("rejects an incorrect DELETE confirmation", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signToken()}`,
        },
        body: JSON.stringify({ currentPassword: "secret12", confirmation: "please" }),
      });
      expect(res.status).toBe(400);
      expect(deleteAccount).not.toHaveBeenCalled();
    });
  });

  it("rejects a wrong password from the service", async () => {
    deleteAccount.mockRejectedValue(new AppError(401, "Current password is incorrect"));
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signToken()}`,
        },
        body: JSON.stringify({ currentPassword: "wrong", confirmation: "DELETE" }),
      });
      expect(res.status).toBe(401);
    });
  });

  it("succeeds for the authenticated user only", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signToken("user-1")}`,
        },
        body: JSON.stringify({ currentPassword: "secret12", confirmation: "DELETE" }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deleted: true });
      expect(deleteAccount).toHaveBeenCalledWith("user-1", {
        currentPassword: "secret12",
        confirmation: "DELETE",
      });
      expect(deleteAccount).not.toHaveBeenCalledWith("user-2", expect.anything());
    });
  });
});
