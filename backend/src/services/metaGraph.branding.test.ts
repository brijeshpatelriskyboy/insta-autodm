import { afterEach, describe, expect, it, vi } from "vitest";
import { metaGraphService } from "./metaGraph.service";
import { brandDm, DM_BODY_MAX_LENGTH } from "../utils/dmBranding";

afterEach(() => vi.unstubAllGlobals());

describe("automated DM branding", () => {
  it("includes the footer in the actual private reply request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ message_id: "mid_test", recipient_id: "recipient_test" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await metaGraphService.sendPrivateReplyToComment({ igUserId: "ig_test",
      accessToken: "test_token", commentId: "comment_test",
      messageText: "Here is your offer: https://example.com",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      recipient: { comment_id: "comment_test" },
      message: { text: "Here is your offer: https://example.com\n\nPowered by Comment2DM" },
    });
  });

  it("does not duplicate an existing footer when retried", () => {
    const message = brandDm("Hello 👋");
    expect(brandDm(message)).toBe(message);
  });

  it("keeps the complete message within the existing size budget", () => {
    expect(brandDm("x".repeat(DM_BODY_MAX_LENGTH)).length).toBe(1000);
    expect(() => brandDm("x".repeat(1000))).toThrow("Shorten the DM message");
  });

  it("leaves public comment replies unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ id: "reply_test" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await metaGraphService.replyToComment({ commentId: "comment_test",
      accessToken: "test_token", messageText: "Check your inbox!",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: "Check your inbox!" });
  });
});
