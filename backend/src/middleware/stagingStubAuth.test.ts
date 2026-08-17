import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";
import {
  getConfiguredStagingStubSecret,
  requireStagingStubDiagnosticAuth,
  stagingStubSecretsEqual,
} from "./stagingStubAuth";

describe("stagingStubAuth", () => {
  beforeEach(() => {
    delete process.env.STAGING_META_STUB_SECRET;
  });

  afterEach(() => {
    delete process.env.STAGING_META_STUB_SECRET;
  });

  it("rejects short or missing diagnostic secrets", () => {
    expect(getConfiguredStagingStubSecret()).toBeNull();
    expect(getConfiguredStagingStubSecret("")).toBeNull();
    expect(getConfiguredStagingStubSecret("short")).toBeNull();
    expect(getConfiguredStagingStubSecret("  short-secret  ")).toBeNull();
    expect(getConfiguredStagingStubSecret("staging-stub-secret-ok")).toBe(
      "staging-stub-secret-ok",
    );
  });

  it("compares secrets without leaking equality on length", () => {
    expect(stagingStubSecretsEqual("abc", "abc")).toBe(true);
    expect(stagingStubSecretsEqual("abc", "abd")).toBe(false);
    expect(stagingStubSecretsEqual("abc", "ab")).toBe(false);
  });

  it("returns 503 when STAGING_META_STUB_SECRET is not configured", () => {
    delete process.env.STAGING_META_STUB_SECRET;
    const next = vi.fn() as unknown as NextFunction;
    requireStagingStubDiagnosticAuth({ headers: {} } as Request, {} as Response, next);
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(503);
    expect(err.message).not.toMatch(/secret|key|token/i);
  });

  it("returns 401 when the diagnostic key is missing or wrong", () => {
    process.env.STAGING_META_STUB_SECRET = "staging-stub-secret-ok";
    const nextMissing = vi.fn() as unknown as NextFunction;
    requireStagingStubDiagnosticAuth(
      { headers: {} } as Request,
      {} as Response,
      nextMissing,
    );
    expect(
      ((nextMissing as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as AppError).statusCode,
    ).toBe(401);

    const nextWrong = vi.fn() as unknown as NextFunction;
    requireStagingStubDiagnosticAuth(
      { headers: { "x-comment2dm-stub-key": "wrong-secret-value" } } as Request,
      {} as Response,
      nextWrong,
    );
    expect(
      ((nextWrong as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as AppError).statusCode,
    ).toBe(401);
  });

  it("continues when the diagnostic key matches", () => {
    process.env.STAGING_META_STUB_SECRET = "staging-stub-secret-ok";
    const next = vi.fn() as unknown as NextFunction;
    requireStagingStubDiagnosticAuth(
      { headers: { "x-comment2dm-stub-key": "staging-stub-secret-ok" } } as Request,
      {} as Response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect((next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBeUndefined();
  });
});
