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

describe("metaGraphService.resolveLinkedFacebookPageId", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns pageId from Facebook me/accounts when IG user matches", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user_id: "17841463495771314",
          username: "demo",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "(#100) Tried accessing nonexisting field (page_id)",
            type: "OAuthException",
            code: 100,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "134895793791914",
              name: "Demo Page",
              instagram_business_account: { id: "17841463495771314" },
            },
          ],
        }),
      });

    const result = await metaGraphService.resolveLinkedFacebookPageId({
      igUserId: "17841463495771314",
      accessToken: "IGAA-test",
    });

    expect(result.pageId).toBe("134895793791914");
    expect(result.source).toBe("facebook_me_accounts");
    expect(result.probes).toHaveLength(3);
  });

  it("returns not_available when Instagram Login token cannot list Pages", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user_id: "17841463495771314",
          username: "demo",
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "(#100) Tried accessing nonexisting field (page_id)",
            type: "OAuthException",
            code: 100,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Invalid OAuth access token - Cannot parse access token",
            type: "OAuthException",
            code: 190,
          },
        }),
      });

    const result = await metaGraphService.resolveLinkedFacebookPageId({
      igUserId: "17841463495771314",
      accessToken: "IGAA-test",
    });

    expect(result.pageId).toBeNull();
    expect(result.source).toBe("not_available");
    expect(result.probes[2]?.body).toMatchObject({
      error: { code: 190 },
    });
  });
});
