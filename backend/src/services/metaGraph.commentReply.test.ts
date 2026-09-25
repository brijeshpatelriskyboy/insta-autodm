import { afterEach, describe, expect, it, vi } from "vitest";
import { metaGraphService } from "./metaGraph.service";

describe("metaGraphService.replyToComment", () => {
  afterEach(() => vi.restoreAllMocks());

  it("posts a public reply to the Instagram comment endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "reply-123" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(metaGraphService.replyToComment({
      commentId: "comment-456",
      accessToken: "secret-token",
      messageText: "Thanks! Check your DM.",
    })).resolves.toEqual({ replyId: "reply-123" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/comment-456/replies");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer secret-token" }));
    expect(JSON.parse(String(init?.body))).toEqual({ message: "Thanks! Check your DM." });
  });
});
