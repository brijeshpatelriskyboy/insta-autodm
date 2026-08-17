import http from "http";
import type { AddressInfo } from "net";
import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_RATE_LIMITS, AUTH_RATE_LIMIT_MESSAGE, GENERIC_FORGOT_PASSWORD_MESSAGE } from "../config/authSecurity";
import { resetAuthRateLimitForTests } from "../middleware/authRateLimit";

const {
  login,
  register,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile,
} = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  getProfile: vi.fn(),
}));

vi.mock("../services/auth.service", () => ({
  authService: {
    login,
    register,
    forgotPassword,
    resetPassword,
    changePassword,
    getProfile,
    createResetTokenForTests: vi.fn(),
  },
  AuthService: vi.fn(),
  GENERIC_FORGOT_RESPONSE: { message: GENERIC_FORGOT_PASSWORD_MESSAGE },
  resetTokenInternalsForTests: { hashResetToken: vi.fn(), generateResetToken: vi.fn() },
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

describe("auth routes", () => {
  beforeEach(() => {
    resetAuthRateLimitForTests();
    login.mockReset();
    register.mockReset();
    forgotPassword.mockReset();
    resetPassword.mockReset();
    changePassword.mockReset();
    getProfile.mockReset();
    login.mockResolvedValue({ token: "jwt", user: { id: "u", email: "a@b.c", name: null } });
    register.mockResolvedValue({ token: "jwt", user: { id: "u", email: "a@b.c", name: null } });
    forgotPassword.mockResolvedValue({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    resetPassword.mockResolvedValue({ message: "Password updated" });
    changePassword.mockResolvedValue({ message: "Password updated" });
  });

  afterEach(() => {
    resetAuthRateLimitForTests();
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_SERVICE_ID;
  });

  it("rejects register without consent before calling the service", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "password12",
        }),
      });
      expect(res.status).toBe(400);
      expect(register).not.toHaveBeenCalled();
    });
  });

  it("registers when consent is true", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "ada@example.com",
          password: "password12",
          acceptedTerms: true,
          acceptedPrivacy: true,
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.user.email).toBe("a@b.c");
      expect(JSON.stringify(body)).not.toContain("passwordHash");
      expect(register).toHaveBeenCalled();
    });
  });

  it("forgot-password returns the generic message and no token fields", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ada@example.com" }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
      expect(Object.keys(body)).toEqual(["message"]);
    });
  });

  it("change-password requires auth and succeeds with a JWT", async () => {
    await withServer(async (baseUrl) => {
      const unauth = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: "old-password-9", newPassword: "new-password-9" }),
      });
      expect(unauth.status).toBe(401);

      const res = await fetch(`${baseUrl}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${signToken()}`,
        },
        body: JSON.stringify({ currentPassword: "old-password-9", newPassword: "new-password-9" }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ message: "Password updated" });
    });
  });

  it("reset-password rejects invalid tokens with a generic 400", async () => {
    const { AppError } = await import("../utils/errors");
    resetPassword.mockRejectedValueOnce(new AppError(400, "Invalid or expired reset token"));
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "not-a-real-token", newPassword: "new-password-9" }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(JSON.stringify(body)).not.toMatch(/not-a-real-token|passwordHash|tokenHash/i);
    });
  });

  it("rate-limits forgot-password with 429", async () => {
    await withServer(async (baseUrl) => {
      for (let i = 0; i < AUTH_RATE_LIMITS.forgotPassword.max; i += 1) {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "ada@example.com" }),
        });
        expect(res.status).toBe(200);
      }
      const limited = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "nobody@example.com" }),
      });
      expect(limited.status).toBe(429);
      expect(await limited.json()).toEqual({ error: AUTH_RATE_LIMIT_MESSAGE });
    });
  });

  it("rate-limits login with 429 and ignores spoofed X-Forwarded-For locally", async () => {
    await withServer(async (baseUrl) => {
      for (let i = 0; i < AUTH_RATE_LIMITS.login.max; i += 1) {
        const res = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `203.0.113.${i}`,
          },
          body: JSON.stringify({ email: "ada@example.com", password: "password12" }),
        });
        expect(res.status).toBe(200);
      }

      const limited = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "203.0.113.99",
        },
        body: JSON.stringify({ email: "ada@example.com", password: "password12" }),
      });
      expect(limited.status).toBe(429);
      const body = await limited.json();
      expect(body).toEqual({ error: AUTH_RATE_LIMIT_MESSAGE });
      expect(limited.headers.get("retry-after")).toBeTruthy();
    });
  });
});
