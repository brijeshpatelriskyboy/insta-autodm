import { describe, expect, it } from "vitest";
import { createMetaSignedRequestForTests, parseMetaSignedRequest } from "./metaSignedRequest";

describe("parseMetaSignedRequest", () => {
  const secret = "test-app-secret-for-signed-request";

  it("accepts a valid HMAC-SHA256 signed_request", () => {
    const signed = createMetaSignedRequestForTests(
      { algorithm: "HMAC-SHA256", user_id: "ig-user-99" },
      secret,
    );
    expect(parseMetaSignedRequest(signed, secret)).toMatchObject({ user_id: "ig-user-99" });
  });

  it("rejects a tampered payload and a wrong secret", () => {
    const signed = createMetaSignedRequestForTests({ user_id: "ig-user-99" }, secret);
    expect(parseMetaSignedRequest(`${signed}x`, secret)).toBeNull();
    expect(parseMetaSignedRequest(signed, "other-secret")).toBeNull();
    expect(parseMetaSignedRequest("not-a-signed-request", secret)).toBeNull();
  });
});
