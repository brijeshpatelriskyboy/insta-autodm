import { afterEach, describe, expect, it, vi } from "vitest";
import { metaGraphService } from "./metaGraph.service";
afterEach(() => vi.unstubAllGlobals());
describe("Meta follow gate transport", () => {
  it("sends a branded button template as the initial private reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid" }) });
    vi.stubGlobal("fetch", fetchMock);
    await metaGraphService.sendPrivateReplyToComment({ igUserId: "ig", accessToken: "token", commentId: "comment", messageText: "Follow us", followGatePayload: "C2D_FOLLOW:gate" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      recipient: { comment_id: "comment" }, message: { attachment: { type: "template", payload: {
        template_type: "button", text: "Follow us\n\nPowered by Comment2DM",
        buttons: [{ type: "postback", title: "I've followed", payload: "C2D_FOLLOW:gate" }],
      } } },
    });
  });
  it("addresses a follow-up to the verified messaging sender", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message_id: "mid" }) });
    vi.stubGlobal("fetch", fetchMock);
    await metaGraphService.sendPrivateReplyToComment({ igUserId: "ig", accessToken: "token", recipientId: "recipient", messageText: "Offer" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).recipient).toEqual({ id: "recipient" });
  });
  it.each([true, false])("uses Meta's explicit boolean (%s) for follow status", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ is_user_follow_business: status }) }));
    expect(await metaGraphService.getFollowerStatus("recipient", "token")).toBe(status);
  });
  it.each([{}, { is_user_follow_business: "true" }, { error: { code: 230 } }])("fails closed for unavailable or invalid profile data", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
    await expect(metaGraphService.getFollowerStatus("recipient", "token")).rejects.toThrow("could not verify");
  });
});
