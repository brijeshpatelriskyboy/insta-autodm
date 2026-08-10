import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assertMetaPrivateReplyStubMayRun,
  configureMetaPrivateReplyStub,
  getMetaPrivateReplyStubCaptures,
  isMetaPrivateReplyStubActive,
  resetMetaPrivateReplyStub,
  sendStubPrivateReply,
} from "./metaPrivateReplyStub";

function enableStub() {
  process.env.META_PRIVATE_REPLY_STUB = "true";
  process.env.COMMENT2DM_DEPLOYMENT_ENV = "staging";
  process.env.COMMENT2DM_ALLOW_META_STUB = "true";
  process.env.FRONTEND_URL = "https://comment2dm-v2-staging.vercel.app";
  process.env.CORS_ORIGIN = "https://comment2dm-v2-staging.vercel.app";
  process.env.DATABASE_URL =
    "postgresql://u:p@magical.proxy.rlwy.net:5432/comment2dm_v2_staging";
  delete process.env.RAILWAY_PUBLIC_DOMAIN;
  delete process.env.RAILWAY_SERVICE_NAME;
}

describe("metaPrivateReplyStub", () => {
  function clearStubEnv() {
    delete process.env.META_PRIVATE_REPLY_STUB;
    delete process.env.COMMENT2DM_DEPLOYMENT_ENV;
    delete process.env.COMMENT2DM_ALLOW_META_STUB;
    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGIN;
    delete process.env.DATABASE_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RAILWAY_SERVICE_NAME;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;
  }

  beforeEach(() => {
    clearStubEnv();
  });

  afterEach(() => {
    clearStubEnv();
  });

  it("is inactive by default", () => {
    expect(isMetaPrivateReplyStubActive()).toBe(false);
  });

  it("refuses partial enablement", () => {
    process.env.META_PRIVATE_REPLY_STUB = "true";
    process.env.COMMENT2DM_DEPLOYMENT_ENV = "staging";
    // missing COMMENT2DM_ALLOW_META_STUB
    expect(() => assertMetaPrivateReplyStubMayRun()).toThrow(/misconfigured/);
  });

  it("refuses production identifiers", () => {
    enableStub();
    process.env.RAILWAY_PUBLIC_DOMAIN = "insta-autodm-production.up.railway.app";
    expect(() => assertMetaPrivateReplyStubMayRun()).toThrow(/production identifier/);
  });

  it("captures message without storing the access token", () => {
    enableStub();
    resetMetaPrivateReplyStub();
    const result = sendStubPrivateReply({
      igUserId: "ig-1",
      accessToken: "SECRET_TOKEN_SHOULD_NOT_APPEAR",
      commentId: "c-1",
      messageText: "Congratulations! Your unique ticket code is ABC",
    });
    expect(result.messageId.startsWith("stub_mid_")).toBe(true);
    const captures = getMetaPrivateReplyStubCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.commentId).toBe("c-1");
    expect(captures[0]?.messageText).toContain("ABC");
    expect(JSON.stringify(captures)).not.toContain("SECRET_TOKEN");
  });

  it("can simulate Meta failure for a comment id", () => {
    enableStub();
    resetMetaPrivateReplyStub();
    configureMetaPrivateReplyStub({ failCommentIds: ["c-fail"] });
    expect(() =>
      sendStubPrivateReply({
        igUserId: "ig-1",
        accessToken: "tok",
        commentId: "c-fail",
        messageText: "hello",
      }),
    ).toThrow(/Simulated Meta/);
    expect(getMetaPrivateReplyStubCaptures()[0]?.simulatedFailure).toBe(true);
  });
});
