import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import {
  computeMetaWebhookSignature,
  verifyMetaWebhookSignature,
} from "../utils/metaWebhookSignature";
import { metaWebhookSignatureMiddleware } from "../middleware/metaWebhookSignature";

const APP_SECRET = "test-instagram-app-secret-for-middleware";
const PAYLOAD_OBJECT = { object: "instagram", entry: [] };
const PAYLOAD = Buffer.from(JSON.stringify(PAYLOAD_OBJECT), "utf8");

vi.mock("../config/meta", () => ({
  getInstagramAppSecret: vi.fn(() => APP_SECRET),
}));

import { getInstagramAppSecret } from "../config/meta";

function mockReq(body: Buffer, signature?: string): Request {
  return {
    body,
    headers: signature ? { "x-hub-signature-256": signature } : {},
  } as unknown as Request;
}

function runMiddleware(req: Request): Promise<{ error: unknown; body: unknown }> {
  return new Promise((resolve) => {
    const next: NextFunction = (error?: unknown) => {
      resolve({ error, body: req.body });
    };
    metaWebhookSignatureMiddleware(req, {} as Response, next);
  });
}

describe("metaWebhookSignatureMiddleware", () => {
  beforeEach(() => {
    vi.mocked(getInstagramAppSecret).mockReturnValue(APP_SECRET);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("passes through and parses JSON when signature is valid", async () => {
    const signature = `sha256=${computeMetaWebhookSignature(PAYLOAD, APP_SECRET)}`;
    const { error, body } = await runMiddleware(mockReq(PAYLOAD, signature));
    expect(error).toBeUndefined();
    expect(body).toEqual(PAYLOAD_OBJECT);
  });

  it("rejects invalid signature with HTTP 401", async () => {
    const { error } = await runMiddleware(mockReq(PAYLOAD, `sha256=${"00".repeat(32)}`));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
  });

  it("rejects missing signature with HTTP 401", async () => {
    const { error } = await runMiddleware(mockReq(PAYLOAD));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
  });

  it("rejects malformed signature with HTTP 401", async () => {
    const { error } = await runMiddleware(mockReq(PAYLOAD, "not-a-signature"));
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(401);
    // Sanity: underlying verifier agrees
    expect(verifyMetaWebhookSignature(PAYLOAD, "not-a-signature", APP_SECRET)).toBe(false);
  });
});
