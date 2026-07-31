import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/meta", async () => {
  const actual = await vi.importActual<typeof import("../config/meta")>("../config/meta");
  return {
    ...actual,
    getMetaGraphApiVersion: () => "v21.0",
    getInstagramAppId: () => "test-app-id",
    getInstagramAppSecret: () => "test-app-secret",
    getMetaRedirectUri: () => "https://example.com/callback",
    getCredentialDiagnostics: () => ({}),
    logOAuthClientDiagnostics: vi.fn(),
    last4: (value: string | null | undefined) => value?.slice(-4) ?? null,
  };
});

import { metaGraphService } from "./metaGraph.service";

describe("metaGraphService.subscribeAppWebhooks", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs to graph.instagram.com /{ig-user-id}/subscribed_apps with comments fields", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await metaGraphService.subscribeAppWebhooks({
      igUserId: "17841463495771314",
      accessToken: "IGAA-test-token",
    });

    expect(result).toEqual({
      success: true,
      fields: ["comments", "live_comments"],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    const calledInit = fetchMock.mock.calls[0]?.[1] as { method?: string };

    expect(calledInit.method).toBe("POST");
    expect(calledUrl).toContain(
      "https://graph.instagram.com/v21.0/17841463495771314/subscribed_apps",
    );
    expect(calledUrl).toContain("subscribed_fields=comments%2Clive_comments");
    expect(calledUrl).toContain("access_token=IGAA-test-token");
  });

  it("throws when Meta returns success=false", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    });

    await expect(
      metaGraphService.subscribeAppWebhooks({
        igUserId: "17841463495771314",
        accessToken: "IGAA-test-token",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringContaining("subscribed_apps"),
    });
  });

  it("throws when Meta returns a Graph error payload", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: "(#100) Invalid parameter",
          type: "OAuthException",
          code: 100,
        },
      }),
    });

    await expect(
      metaGraphService.subscribeAppWebhooks({
        igUserId: "17841463495771314",
        accessToken: "IGAA-test-token",
      }),
    ).rejects.toMatchObject({
      statusCode: 502,
      message: "(#100) Invalid parameter",
    });
  });
});
