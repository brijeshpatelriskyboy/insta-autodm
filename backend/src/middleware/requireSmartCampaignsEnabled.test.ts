import type { NextFunction, Request, Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";
import { requireSmartCampaignsEnabled } from "./requireSmartCampaignsEnabled";

describe("requireSmartCampaignsEnabled", () => {
  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
  });

  it("returns 404 via AppError when disabled and does not continue", () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    const next = vi.fn() as unknown as NextFunction;
    const handler = vi.fn();

    requireSmartCampaignsEnabled({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ statusCode: 404, message: "Not found" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 404 when SMART_CAMPAIGNS_ENABLED is false", () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "false";
    const next = vi.fn() as unknown as NextFunction;

    requireSmartCampaignsEnabled({} as Request, {} as Response, next);

    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
  });

  it("allows continuation when SMART_CAMPAIGNS_ENABLED is true", () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const next = vi.fn() as unknown as NextFunction;

    requireSmartCampaignsEnabled({} as Request, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBeUndefined();
  });
});
