import { describe, expect, it } from "vitest";
import { getClientIp } from "./clientIp";
import type { Request } from "express";

function fakeRequest(overrides: {
  remoteAddress?: string;
  forwardedFor?: string | string[];
}): Request {
  return {
    socket: { remoteAddress: overrides.remoteAddress ?? "127.0.0.1" },
    headers: overrides.forwardedFor
      ? { "x-forwarded-for": overrides.forwardedFor }
      : {},
  } as unknown as Request;
}

describe("getClientIp", () => {
  it("uses the socket address locally and ignores spoofed X-Forwarded-For", () => {
    const previousRailway = process.env.RAILWAY_ENVIRONMENT;
    const previousService = process.env.RAILWAY_SERVICE_ID;
    delete process.env.RAILWAY_ENVIRONMENT;
    delete process.env.RAILWAY_SERVICE_ID;

    expect(
      getClientIp(
        fakeRequest({ remoteAddress: "10.0.0.8", forwardedFor: "203.0.113.9" }),
      ),
    ).toBe("10.0.0.8");

    if (previousRailway === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT;
    } else {
      process.env.RAILWAY_ENVIRONMENT = previousRailway;
    }
    if (previousService === undefined) {
      delete process.env.RAILWAY_SERVICE_ID;
    } else {
      process.env.RAILWAY_SERVICE_ID = previousService;
    }
  });

  it("uses the first X-Forwarded-For hop on Railway", () => {
    process.env.RAILWAY_ENVIRONMENT = "staging";
    expect(
      getClientIp(
        fakeRequest({
          remoteAddress: "10.0.0.8",
          forwardedFor: "203.0.113.9, 10.0.0.1",
        }),
      ),
    ).toBe("203.0.113.9");
    delete process.env.RAILWAY_ENVIRONMENT;
  });
});
