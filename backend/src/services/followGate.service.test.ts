import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  account: vi.fn(), gate: vi.fn(), claim: vi.fn(), update: vi.fn(),
  profile: vi.fn(), send: vi.fn(), reserve: vi.fn(), release: vi.fn(), log: vi.fn(),
}));
vi.mock("../lib/prisma", () => ({ prisma: {
  instagramAccount: { findUnique: mocks.account },
  dmEvent: { findFirst: mocks.gate, updateMany: mocks.claim, update: mocks.update },
} }));
vi.mock("../utils/tokenCrypto", () => ({ decryptToken: () => "token" }));
vi.mock("./metaGraph.service", () => ({ metaGraphService: { getFollowerStatus: mocks.profile, sendPrivateReplyToComment: mocks.send } }));
vi.mock("./planLimits.service", () => ({ reserveMonthlyDm: mocks.reserve, releaseMonthlyDm: mocks.release }));
vi.mock("./activity.service", () => ({ activityService: { log: mocks.log } }));
import { parseFollowInteractions, processFollowInteractions } from "./followGate.service";

const payload = (event = {}) => ({ object: "instagram", entry: [{ id: "ig1", messaging: [{
  sender: { id: "person1" }, recipient: { id: "ig1" }, timestamp: Date.now(),
  postback: { payload: "C2D_FOLLOW:gate1" }, ...event,
}] }] });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.account.mockResolvedValue({ id: "account1", userId: "owner1", instagramUserId: "ig1", username: "brand", connectionStatus: "connected", accessTokenEncrypted: "encrypted" });
  mocks.gate.mockResolvedValue({ id: "gate1", ruleId: "rule1", rule: { userId: "owner1", isActive: true, requireFollow: true, dmMessage: "Secret offer" } });
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.update.mockResolvedValue({});
  mocks.profile.mockResolvedValue(true);
  mocks.reserve.mockResolvedValue({ allowed: true });
  mocks.send.mockResolvedValue({ messageId: "mid1" });
  mocks.log.mockResolvedValue({});
});

describe("follow gate", () => {
  it("releases the offer only after the verified follower check", async () => {
    await processFollowInteractions(payload());
    expect(mocks.profile).toHaveBeenCalledWith("person1", "token");
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ recipientId: "person1", messageText: "Secret offer" }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ followGateStatus: "delivered", followGateMessageId: "mid1" }) }));
  });
  it("binds callbacks to the owning account and recipient", async () => {
    mocks.gate.mockResolvedValue(null);
    await processFollowInteractions(payload());
    expect(mocks.gate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      id: "gate1", instagramAccountId: "account1", userId: "owner1", followGateRecipientId: "person1", followGateStatus: "waiting",
    }) }));
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("keeps non-followers locked and sends a new check button", async () => {
    mocks.profile.mockResolvedValue(false);
    await processFollowInteractions(payload());
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ followGatePayload: "C2D_FOLLOW:gate1" }));
    expect(mocks.send.mock.calls[0][0].messageText).not.toContain("Secret offer");
  });
  it("never releases an offer if the profile check fails", async () => {
    mocks.profile.mockRejectedValue(new Error("consent required"));
    await processFollowInteractions(payload());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.reserve).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ followGateStatus: "waiting" }) }));
  });
  it("does not send again when a duplicate or concurrent tap loses its claim", async () => {
    mocks.claim.mockResolvedValue({ count: 0 });
    await processFollowInteractions(payload());
    expect(mocks.profile).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not send a follow-up when the quota is exhausted", async () => {
    mocks.reserve.mockResolvedValue({ allowed: false });
    await processFollowInteractions(payload());
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("requires review rather than risking a duplicate after an ambiguous send", async () => {
    mocks.send.mockRejectedValue(new Error("timeout"));
    await processFollowInteractions(payload());
    expect(mocks.release).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ followGateStatus: "review_required" }) }));
  });
  it("ignores disabled rules", async () => {
    mocks.gate.mockResolvedValue({ id: "gate1", rule: { isActive: false, requireFollow: true } });
    await processFollowInteractions(payload());
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it("accepts DONE as a consent-bearing alternative to the button", () => {
    expect(parseFollowInteractions(payload({ postback: undefined, message: { text: "done" } }))).toHaveLength(1);
  });
  it("ignores stale events, echoes, unrelated messages and mismatched recipients", () => {
    expect(parseFollowInteractions(payload({ timestamp: Date.now() - 24 * 3600_000 }))).toEqual([]);
    expect(parseFollowInteractions(payload({ message: { is_echo: true } }))).toEqual([]);
    expect(parseFollowInteractions(payload({ postback: undefined, message: { text: "hello" } }))).toEqual([]);
    expect(parseFollowInteractions(payload({ recipient: { id: "other" } }))).toEqual([]);
    expect(parseFollowInteractions(null)).toEqual([]);
  });
});
