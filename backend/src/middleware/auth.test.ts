import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
const { findUser } = vi.hoisted(() => ({ findUser: vi.fn() }));
vi.mock("../lib/prisma", () => ({ prisma: { user: { findUnique: findUser } } }));
import { authenticate } from "./auth";

function fixture(authorization?: string) {
  const req = { headers: { authorization } } as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn();
  return { req, res, next };
}
function token() { return jwt.sign({ userId: "old-user", email: "test@example.invalid", name: "Test" }, process.env.JWT_SECRET!); }
describe("authentication account existence", () => {
  beforeEach(() => vi.resetAllMocks());
  it("rejects a signed session when its user was deleted", async () => {
    findUser.mockResolvedValue(null);
    const f = fixture(`Bearer ${token()}`);
    await authenticate(f.req, f.res, f.next);
    expect(f.res.status).toHaveBeenCalledWith(401);
    expect(f.res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "SESSION_INVALID" }));
    expect(f.next).not.toHaveBeenCalled();
    expect(f.req.user).toBeUndefined();
  });
  it("permits an existing user's valid session", async () => {
    findUser.mockResolvedValue({ id: "old-user" });
    const f = fixture(`Bearer ${token()}`);
    await authenticate(f.req, f.res, f.next);
    expect(f.req.user?.id).toBe("old-user");
    expect(f.next).toHaveBeenCalledWith();
  });
  it("rejects invalid tokens without querying the database", async () => {
    const f = fixture("Bearer invalid-token");
    await authenticate(f.req, f.res, f.next);
    expect(f.next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(findUser).not.toHaveBeenCalled();
  });
  it("does not turn a database outage into an invalid-session response", async () => {
    const error = new Error("Database unavailable");
    findUser.mockRejectedValue(error);
    const f = fixture(`Bearer ${token()}`);
    await authenticate(f.req, f.res, f.next);
    expect(f.next).toHaveBeenCalledWith(error);
    expect(f.res.json).not.toHaveBeenCalled();
  });
});
