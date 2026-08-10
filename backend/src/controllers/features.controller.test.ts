import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";
import { featuresController } from "./features.controller";

function mockRes() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("FeaturesController.getFeatures", () => {
  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
  });

  it("returns 401 when unauthenticated", async () => {
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();

    await featuresController.getFeatures({} as Request, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  it("/api/features shape returns false when disabled", async () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    const req = { user: { id: "u1", email: "a@b.com", name: null } } as Request;

    await featuresController.getFeatures(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ smartCampaigns: false });
  });

  it("/api/features shape returns true when enabled", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const next = vi.fn() as unknown as NextFunction;
    const res = mockRes();
    const req = { user: { id: "u1", email: "a@b.com", name: null } } as Request;

    await featuresController.getFeatures(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ smartCampaigns: true });
  });
});
