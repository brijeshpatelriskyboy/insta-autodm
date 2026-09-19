import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";
import {
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_TTL_MS,
} from "../config/authSecurity";

const {
  mockUserFindUnique,
  mockUserCreate,
  mockUserUpdate,
  mockTokenCreate,
  mockTokenFindUnique,
  mockTokenUpdateMany,
  mockTransaction,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserCreate: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockTokenCreate: vi.fn(),
  mockTokenFindUnique: vi.fn(),
  mockTokenUpdateMany: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
      create: mockUserCreate,
      update: mockUserUpdate,
    },
    passwordResetToken: {
      create: mockTokenCreate,
      findUnique: mockTokenFindUnique,
      updateMany: mockTokenUpdateMany,
    },
    $transaction: mockTransaction,
  },
}));

import { authService, resetTokenInternalsForTests } from "./auth.service";
import {
  getMemoryEmailProvider,
  resetEmailProviderForTests,
  setEmailProviderForTests,
} from "../email/emailService";
import { EmailDeliveryError } from "../email/types";

const userRow = {
  id: "user-1",
  email: "ada@example.com",
  name: "Ada",
  passwordHash: "",
};

describe("authService", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetEmailProviderForTests();
    process.env.FRONTEND_URL = "https://app.example.test";
    const bcrypt = await import("bcryptjs");
    userRow.passwordHash = await bcrypt.hash("old-password-9", 10);
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        passwordResetToken: { updateMany: mockTokenUpdateMany },
        user: { update: mockUserUpdate },
      }),
    );
  });

  it("register without consent is rejected", async () => {
    await expect(
      authService.register("ada@example.com", "password12", {
        acceptedTerms: false,
        acceptedPrivacy: true,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("register with consent stores acceptance timestamps and does not return hashes", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockUserCreate.mockResolvedValue({ id: "user-1", email: "ada@example.com", name: "Ada" });

    const result = await authService.register("ada@example.com", "password12", {
      name: "Ada",
      acceptedTerms: true,
      acceptedPrivacy: true,
    });

    expect(mockUserCreate).toHaveBeenCalledTimes(1);
    const data = mockUserCreate.mock.calls[0]?.[0]?.data;
    expect(data.termsAcceptedAt).toBeInstanceOf(Date);
    expect(data.privacyAcceptedAt).toBeInstanceOf(Date);
    expect(data.passwordHash).toEqual(expect.any(String));
    expect(data.passwordHash).not.toBe("password12");
    expect(JSON.stringify(result)).not.toContain("passwordHash");
    expect(result.user.email).toBe("ada@example.com");
    expect(result.token).toEqual(expect.any(String));
  });

  it("forgotPassword returns the same payload for known and unknown emails", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "user-1", email: "ada@example.com" });
    mockTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockResolvedValue({ id: "tok-1" });

    const known = await authService.forgotPassword("ada@example.com");

    mockUserFindUnique.mockResolvedValueOnce(null);
    const unknown = await authService.forgotPassword("nobody@example.com");

    expect(known).toEqual({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    expect(unknown).toEqual(known);
    expect(JSON.stringify(known)).not.toMatch(/token/i);
    expect(JSON.stringify(known)).not.toContain("reset-password");
    expect(mockTokenCreate).toHaveBeenCalledTimes(1);
    expect(getMemoryEmailProvider().sent).toHaveLength(1);
  });

  it("sends one reset email for an existing account using FRONTEND_URL", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "ada@example.com" });
    mockTokenUpdateMany.mockResolvedValue({ count: 0 });
    mockTokenCreate.mockResolvedValue({ id: "tok-1" });

    const result = await authService.forgotPassword("ada@example.com");
    const sent = getMemoryEmailProvider().sent;
    expect(sent).toHaveLength(1);
    expect(sent[0]?.kind).toBe("password_reset");
    expect(sent[0]?.to).toBe("ada@example.com");
    expect(sent[0]?.text).toMatch(/https:\/\/app\.example\.test\/reset-password\?token=/);
    expect(sent[0]?.text).toMatch(/45 minutes/);
    const created = mockTokenCreate.mock.calls[0]?.[0]?.data;
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now() + 44 * 60 * 1000);
    expect(created.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + PASSWORD_RESET_TTL_MS + 1000);
    expect(result).toEqual({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    expect(JSON.stringify(result)).not.toContain("reset-password");

    const tokenMatch = sent[0]?.text.match(/token=([A-Za-z0-9_-]+)/);
    const plaintext = tokenMatch?.[1] ?? "";
    expect(plaintext.length).toBeGreaterThan(8);
    const logged = info.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).not.toContain(plaintext);
    expect(logged).not.toContain("/reset-password?");
    expect(logged).not.toContain("re_");
    info.mockRestore();
  });

  it("does not send email for an unknown address", async () => {
    mockUserFindUnique.mockResolvedValue(null);
    const result = await authService.forgotPassword("nobody@example.com");
    expect(result).toEqual({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    expect(getMemoryEmailProvider().sent).toHaveLength(0);
    expect(mockTokenCreate).not.toHaveBeenCalled();
  });

  it("invalidates the token and keeps the generic response when the provider fails", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    setEmailProviderForTests({
      name: "failing",
      send: async () => {
        throw new EmailDeliveryError("provider_failed", 403);
      },
    });
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "ada@example.com" });
    mockTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockTokenCreate.mockResolvedValue({ id: "tok-1" });

    const result = await authService.forgotPassword("ada@example.com");
    expect(result).toEqual({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
    expect(JSON.stringify(result)).not.toContain("403");
    expect(JSON.stringify(result)).not.toContain("Resend");
    expect(mockTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
    const logged = info.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).toMatch(/failed/);
    expect(logged).not.toContain("/reset-password?");
    info.mockRestore();
  });

  it("fails safely in production when email config is missing and invalidates the token", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    mockUserFindUnique.mockResolvedValue({ id: "user-1", email: "ada@example.com" });
    mockTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockTokenCreate.mockResolvedValue({ id: "tok-1" });

    try {
      const result = await authService.forgotPassword("ada@example.com");
      expect(result).toEqual({ message: GENERIC_FORGOT_PASSWORD_MESSAGE });
      expect(getMemoryEmailProvider().sent).toHaveLength(0);
      expect(mockTokenUpdateMany).toHaveBeenCalled();
      const logged = info.mock.calls.map((call) => JSON.stringify(call)).join("\n");
      expect(logged).toMatch(/skipped/);
      expect(logged).not.toContain("/reset-password?");
    } finally {
      process.env.NODE_ENV = previous;
      info.mockRestore();
    }
  });

  it("valid reset consumes the token and updates the password hash", async () => {
    const plaintext = await authService.createResetTokenForTests("user-1");
    const tokenHash = resetTokenInternalsForTests.hashResetToken(plaintext);

    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      userId: "user-1",
      tokenHash,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      usedAt: null,
    });
    mockTokenUpdateMany.mockResolvedValue({ count: 1 });
    mockUserUpdate.mockResolvedValue({ id: "user-1" });

    const result = await authService.resetPassword(plaintext, "new-password-9");
    expect(result).toEqual({ message: "Password updated" });
    expect(mockTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "tok-1", usedAt: null }),
        data: expect.objectContaining({ usedAt: expect.any(Date) }),
      }),
    );
    expect(mockUserUpdate.mock.calls[0]?.[0]?.data.passwordHash).not.toBe("new-password-9");
    expect(JSON.stringify(result)).not.toContain(plaintext);
  });

  it("rejects invalid, expired, and already-used reset tokens", async () => {
    mockTokenFindUnique.mockResolvedValue(null);
    await expect(authService.resetPassword("nope", "new-password-9")).rejects.toMatchObject({
      statusCode: 400,
      message: INVALID_RESET_TOKEN_MESSAGE,
    });

    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      userId: "user-1",
      tokenHash: "x",
      expiresAt: new Date(Date.now() - 1000),
      usedAt: null,
    });
    await expect(authService.resetPassword("expired", "new-password-9")).rejects.toMatchObject({
      statusCode: 400,
      message: INVALID_RESET_TOKEN_MESSAGE,
    });

    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      userId: "user-1",
      tokenHash: "x",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });
    await expect(authService.resetPassword("used", "new-password-9")).rejects.toMatchObject({
      statusCode: 400,
      message: INVALID_RESET_TOKEN_MESSAGE,
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("changePassword succeeds with the current password and rejects a wrong one", async () => {
    mockUserFindUnique.mockResolvedValue({ id: "user-1", passwordHash: userRow.passwordHash });
    mockUserUpdate.mockResolvedValue({ id: "user-1" });

    const ok = await authService.changePassword("user-1", "old-password-9", "new-password-9");
    expect(ok).toEqual({ message: "Password updated" });
    expect(JSON.stringify(ok)).not.toContain("passwordHash");

    await expect(
      authService.changePassword("user-1", "wrong-password", "new-password-9"),
    ).rejects.toMatchObject({ statusCode: 401, message: "Current password is incorrect" });
  });

  it("rejects a token that was already consumed atomically", async () => {
    const plaintext = await authService.createResetTokenForTests("user-1");
    mockTokenFindUnique.mockResolvedValue({
      id: "tok-1",
      userId: "user-1",
      tokenHash: resetTokenInternalsForTests.hashResetToken(plaintext),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      usedAt: null,
    });
    mockTokenUpdateMany.mockResolvedValue({ count: 0 });

    await expect(authService.resetPassword(plaintext, "new-password-9")).rejects.toMatchObject({
      statusCode: 400,
      message: INVALID_RESET_TOKEN_MESSAGE,
    });
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("createResetTokenForTests is blocked in production", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await expect(authService.createResetTokenForTests("user-1")).rejects.toThrow(
        /not available in production/i,
      );
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
