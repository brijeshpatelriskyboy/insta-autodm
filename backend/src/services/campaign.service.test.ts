import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";
import { Prisma } from "@prisma/client";

const {
  mockCampaignFindMany,
  mockCampaignFindFirst,
  mockCampaignCreate,
  mockCampaignUpdate,
  mockCampaignCodeCreateMany,
  mockCampaignCodeCount,
  mockCampaignCodeGroupBy,
  mockCampaignCodeFindMany,
  mockCampaignCodeDeleteMany,
  mockCampaignClaimCount,
  mockCampaignClaimFindMany,
  mockKeywordRuleFindFirst,
  mockTransaction,
} = vi.hoisted(() => ({
  mockCampaignFindMany: vi.fn(),
  mockCampaignFindFirst: vi.fn(),
  mockCampaignCreate: vi.fn(),
  mockCampaignUpdate: vi.fn(),
  mockCampaignCodeCreateMany: vi.fn(),
  mockCampaignCodeCount: vi.fn(),
  mockCampaignCodeGroupBy: vi.fn(),
  mockCampaignCodeFindMany: vi.fn(),
  mockCampaignCodeDeleteMany: vi.fn(),
  mockCampaignClaimCount: vi.fn(),
  mockCampaignClaimFindMany: vi.fn(),
  mockKeywordRuleFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    campaign: {
      findMany: mockCampaignFindMany,
      findFirst: mockCampaignFindFirst,
      create: mockCampaignCreate,
      update: mockCampaignUpdate,
    },
    campaignCode: {
      createMany: mockCampaignCodeCreateMany,
      count: mockCampaignCodeCount,
      groupBy: mockCampaignCodeGroupBy,
      findMany: mockCampaignCodeFindMany,
      deleteMany: mockCampaignCodeDeleteMany,
    },
    campaignClaim: {
      count: mockCampaignClaimCount,
      findMany: mockCampaignClaimFindMany,
    },
    keywordRule: {
      findFirst: mockKeywordRuleFindFirst,
    },
    $transaction: mockTransaction,
  },
}));

import {
  CAMPAIGN_EDIT_MATRIX,
  campaignService,
  resetCampaignCodeGeneratorForTests,
  setCampaignCodeGeneratorForTests,
} from "./campaign.service";

const baseCampaign = {
  id: "camp-1",
  userId: "user-1",
  keywordRuleId: "rule-1",
  name: "Sunday Sale",
  status: "DRAFT" as const,
  startsAt: new Date("2026-01-01T00:00:00.000Z"),
  endsAt: new Date("2026-12-31T00:00:00.000Z"),
  maxClaims: 3,
  claimedCount: 0,
  dmTemplate: "Your code is {{code}}",
  soldOutMessage: "Sold out",
  alreadyClaimedMessage: "Already {{code}}",
  notStartedMessage: null,
  endedMessage: null,
  redemptionEnabled: false,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  keywordRule: { id: "rule-1", keyword: "SALE" },
};

function stubDetailCounts() {
  mockCampaignCodeGroupBy.mockResolvedValue([]);
  mockCampaignClaimCount.mockResolvedValue(0);
}

describe("campaignService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCampaignCodeGeneratorForTests();
    stubDetailCounts();
  });

  it("enforces keyword rule ownership on create", async () => {
    mockKeywordRuleFindFirst.mockResolvedValue(null);
    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "other-rule",
        name: "X",
        startsAt: baseCampaign.startsAt,
        endsAt: baseCampaign.endsAt,
        maxClaims: 2,
        dmTemplate: "Hi {{code}}",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "X", length: 8 },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: /Keyword rule not found/ });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects invalid maxClaims, missing {{code}}, and invalid window", async () => {
    mockKeywordRuleFindFirst.mockResolvedValue({ id: "rule-1" });

    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "rule-1",
        name: "X",
        startsAt: baseCampaign.startsAt,
        endsAt: baseCampaign.endsAt,
        maxClaims: 0,
        dmTemplate: "Hi {{code}}",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "X", length: 8 },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: /maxClaims must be greater/ });

    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "rule-1",
        name: "X",
        startsAt: baseCampaign.startsAt,
        endsAt: baseCampaign.endsAt,
        maxClaims: 10_001,
        dmTemplate: "Hi {{code}}",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "X", length: 8 },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: /cannot exceed/ });

    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "rule-1",
        name: "X",
        startsAt: baseCampaign.startsAt,
        endsAt: baseCampaign.endsAt,
        maxClaims: 2,
        dmTemplate: "Hi there",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "X", length: 8 },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: /\{\{code\}\}/ });

    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "rule-1",
        name: "X",
        startsAt: baseCampaign.endsAt,
        endsAt: baseCampaign.startsAt,
        maxClaims: 2,
        dmTemplate: "Hi {{code}}",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "X", length: 8 },
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: /startsAt must be before endsAt/ });
  });

  it("creates campaign + exact unique code pool atomically", async () => {
    mockKeywordRuleFindFirst.mockResolvedValue({ id: "rule-1" });
    setCampaignCodeGeneratorForTests(() => ["A-1", "A-2", "A-3"]);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        campaign: { create: mockCampaignCreate },
        campaignCode: { createMany: mockCampaignCodeCreateMany },
      };
      return fn(tx);
    });
    mockCampaignCreate.mockResolvedValue(baseCampaign);
    mockCampaignCodeCreateMany.mockResolvedValue({ count: 3 });

    const detail = await campaignService.create("user-1", {
      keywordRuleId: "rule-1",
      name: "Sunday Sale",
      startsAt: baseCampaign.startsAt,
      endsAt: baseCampaign.endsAt,
      maxClaims: 3,
      dmTemplate: "Your code is {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "A", length: 8 },
    });

    expect(mockCampaignCreate).toHaveBeenCalled();
    expect(mockCampaignCodeCreateMany).toHaveBeenCalledWith({
      data: [
        { campaignId: "camp-1", code: "A-1", status: "AVAILABLE" },
        { campaignId: "camp-1", code: "A-2", status: "AVAILABLE" },
        { campaignId: "camp-1", code: "A-3", status: "AVAILABLE" },
      ],
    });
    expect(detail.maxClaims).toBe(3);
    expect(detail).not.toHaveProperty("codes");
  });

  it("rolls back when code insert fails (transaction rejects; no orphan commit)", async () => {
    mockKeywordRuleFindFirst.mockResolvedValue({ id: "rule-1" });
    setCampaignCodeGeneratorForTests(() => ["A-1", "A-2"]);

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        campaign: { create: mockCampaignCreate },
        campaignCode: { createMany: mockCampaignCodeCreateMany },
      };
      return fn(tx);
    });
    mockCampaignCreate.mockResolvedValue({ ...baseCampaign, maxClaims: 2 });
    mockCampaignCodeCreateMany.mockRejectedValue(new Error("insert failed"));

    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "rule-1",
        name: "X",
        startsAt: baseCampaign.startsAt,
        endsAt: baseCampaign.endsAt,
        maxClaims: 2,
        dmTemplate: "Hi {{code}}",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "A", length: 8 },
      }),
    ).rejects.toThrow(/insert failed/);

    // Prisma $transaction would rollback; our service does not call a follow-up create outside tx.
    expect(mockCampaignUpdate).not.toHaveBeenCalled();
  });

  it("list/detail never expose unused code values", async () => {
    mockCampaignFindMany.mockResolvedValue([baseCampaign]);
    const list = await campaignService.listByUser("user-1");
    expect(JSON.stringify(list)).not.toMatch(/AVAILABLE|SUNDAY-/);
    expect(list[0]).toMatchObject({ remainingCount: 3 });

    mockCampaignFindFirst.mockResolvedValue(baseCampaign);
    mockCampaignCodeGroupBy.mockResolvedValue([
      { status: "AVAILABLE", _count: { _all: 3 } },
    ]);
    const detail = await campaignService.getById("user-1", "camp-1");
    expect(detail.codeCounts.AVAILABLE).toBe(3);
    expect(JSON.stringify(detail)).not.toContain('"codes"');
  });

  it("ownership: getById 404 for other user", async () => {
    mockCampaignFindFirst.mockResolvedValue(null);
    await expect(campaignService.getById("user-2", "camp-1")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("activate / pause / archive lifecycle + one-active conflict", async () => {
    mockCampaignFindFirst.mockResolvedValue(baseCampaign);
    mockCampaignCodeCount.mockResolvedValue(3);
    mockCampaignUpdate.mockResolvedValue({ ...baseCampaign, status: "ACTIVE" });

    await campaignService.activate("user-1", "camp-1");
    expect(mockCampaignUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } }),
    );

    // Simulate DB partial unique index conflict while still in DRAFT/PAUSED.
    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "DRAFT" });
    mockCampaignCodeCount.mockResolvedValue(3);
    mockCampaignUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(campaignService.activate("user-1", "camp-1")).rejects.toMatchObject({
      statusCode: 409,
      message: /Another active campaign/,
    });

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "ACTIVE" });
    mockCampaignUpdate.mockResolvedValue({ ...baseCampaign, status: "PAUSED" });
    await campaignService.pause("user-1", "camp-1");

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "ACTIVE" });
    await expect(campaignService.archive("user-1", "camp-1")).rejects.toMatchObject({
      statusCode: 400,
      message: /Pause the campaign before archiving/,
    });

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "PAUSED" });
    mockCampaignUpdate.mockResolvedValue({
      ...baseCampaign,
      status: "ARCHIVED",
      archivedAt: new Date(),
    });
    await campaignService.archive("user-1", "camp-1");
  });

  it("enforces edit matrix (ACTIVE cannot change keyword/maxClaims/dmTemplate)", async () => {
    expect(CAMPAIGN_EDIT_MATRIX.ACTIVE).not.toContain("dmTemplate");
    expect(CAMPAIGN_EDIT_MATRIX.ACTIVE).not.toContain("maxClaims");
    expect(CAMPAIGN_EDIT_MATRIX.PAUSED).not.toContain("maxClaims");
    expect(CAMPAIGN_EDIT_MATRIX.DRAFT).toContain("maxClaims");
    expect(CAMPAIGN_EDIT_MATRIX.ARCHIVED).toEqual([]);

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "ACTIVE" });
    await expect(
      campaignService.patch("user-1", "camp-1", { dmTemplate: "x {{code}}" }),
    ).rejects.toMatchObject({ statusCode: 400, message: /Cannot update fields/ });

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "ACTIVE" });
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 10 }),
    ).rejects.toMatchObject({ statusCode: 400, message: /Cannot update fields/ });

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "PAUSED" });
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 10 }),
    ).rejects.toMatchObject({ statusCode: 400, message: /Cannot update fields/ });

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "ENDED" });
    await expect(
      campaignService.patch("user-1", "camp-1", { name: "Nope" }),
    ).rejects.toMatchObject({ statusCode: 400, message: /read-only/ });

    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, status: "ARCHIVED" });
    await expect(
      campaignService.patch("user-1", "camp-1", { name: "Nope" }),
    ).rejects.toMatchObject({ statusCode: 400, message: /read-only/ });
  });

  it("rejects invalid DRAFT maxClaims values before resize", async () => {
    mockCampaignFindFirst.mockResolvedValue(baseCampaign);
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 0 }),
    ).rejects.toMatchObject({ statusCode: 400, message: /maxClaims must be an integer/ });
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 10_001 }),
    ).rejects.toMatchObject({ statusCode: 400, message: /cannot exceed/ });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  function mockResizeTx() {
    const tx = {
      campaignCode: {
        findMany: mockCampaignCodeFindMany,
        createMany: mockCampaignCodeCreateMany,
        deleteMany: mockCampaignCodeDeleteMany,
        count: mockCampaignCodeCount,
      },
      campaign: {
        update: mockCampaignUpdate,
      },
    };
    mockTransaction.mockImplementation(async (fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
    return tx;
  }

  it("DRAFT increase appends AVAILABLE codes and updates maxClaims", async () => {
    const draft = { ...baseCampaign, maxClaims: 3 };
    mockCampaignFindFirst.mockResolvedValue(draft);
    mockResizeTx();
    mockCampaignCodeFindMany.mockResolvedValue([
      { id: "c1", code: "SUN-AAAAAA", status: "AVAILABLE" },
      { id: "c2", code: "SUN-BBBBBB", status: "AVAILABLE" },
      { id: "c3", code: "SUN-CCCCCC", status: "AVAILABLE" },
    ]);
    setCampaignCodeGeneratorForTests(() => ["SUN-DDDDDD", "SUN-EEEEEE"]);
    mockCampaignCodeCreateMany.mockResolvedValue({ count: 2 });
    mockCampaignCodeCount.mockResolvedValue(5);
    mockCampaignUpdate.mockResolvedValue({ ...draft, maxClaims: 5 });

    const result = await campaignService.patch("user-1", "camp-1", { maxClaims: 5 });
    expect(result.maxClaims).toBe(5);
    expect(mockCampaignCodeCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ code: "SUN-DDDDDD", status: "AVAILABLE" }),
          expect.objectContaining({ code: "SUN-EEEEEE", status: "AVAILABLE" }),
        ],
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/SUN-/);
    resetCampaignCodeGeneratorForTests();
  });

  it("DRAFT decrease deletes excess AVAILABLE codes only", async () => {
    const draft = { ...baseCampaign, maxClaims: 3 };
    mockCampaignFindFirst.mockResolvedValue(draft);
    mockResizeTx();
    mockCampaignCodeFindMany.mockResolvedValue([
      { id: "c1", code: "SUN-AAAAAA", status: "AVAILABLE" },
      { id: "c2", code: "SUN-BBBBBB", status: "AVAILABLE" },
      { id: "c3", code: "SUN-CCCCCC", status: "AVAILABLE" },
    ]);
    mockCampaignCodeDeleteMany.mockResolvedValue({ count: 2 });
    mockCampaignCodeCount.mockResolvedValue(1);
    mockCampaignUpdate.mockResolvedValue({ ...draft, maxClaims: 1 });

    const result = await campaignService.patch("user-1", "camp-1", { maxClaims: 1 });
    expect(result.maxClaims).toBe(1);
    expect(mockCampaignCodeDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "AVAILABLE",
          id: { in: ["c1", "c2"] },
        }),
      }),
    );
  });

  it("rejects DRAFT decrease when any RESERVED code exists", async () => {
    mockCampaignFindFirst.mockResolvedValue(baseCampaign);
    mockResizeTx();
    mockCampaignCodeFindMany.mockResolvedValue([
      { id: "c1", code: "SUN-AAAAAA", status: "AVAILABLE" },
      { id: "c2", code: "SUN-BBBBBB", status: "RESERVED" },
      { id: "c3", code: "SUN-CCCCCC", status: "AVAILABLE" },
    ]);
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, message: /reserved/i });
    expect(mockCampaignCodeDeleteMany).not.toHaveBeenCalled();
  });

  it("rejects DRAFT resize when claimedCount > 0", async () => {
    mockCampaignFindFirst.mockResolvedValue({ ...baseCampaign, claimedCount: 1 });
    mockResizeTx();
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 1 }),
    ).rejects.toMatchObject({ statusCode: 409, message: /claims have been recorded/ });
  });

  it("rolls back DRAFT increase when generation fails", async () => {
    mockCampaignFindFirst.mockResolvedValue(baseCampaign);
    mockResizeTx();
    mockCampaignCodeFindMany.mockResolvedValue([
      { id: "c1", code: "SUN-AAAAAA", status: "AVAILABLE" },
      { id: "c2", code: "SUN-BBBBBB", status: "AVAILABLE" },
      { id: "c3", code: "SUN-CCCCCC", status: "AVAILABLE" },
    ]);
    setCampaignCodeGeneratorForTests(() => {
      throw new Error("code_generation_exhausted");
    });
    await expect(
      campaignService.patch("user-1", "camp-1", { maxClaims: 5 }),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(mockCampaignUpdate).not.toHaveBeenCalled();
    resetCampaignCodeGeneratorForTests();
  });

  it("claims endpoint returns claimed codes only (joined from claim rows)", async () => {
    mockCampaignFindFirst.mockResolvedValue(baseCampaign);
    mockCampaignClaimFindMany.mockResolvedValue([
      {
        id: "claim-1",
        instagramUsername: "creator",
        claimedAt: new Date("2026-02-01T00:00:00.000Z"),
        deliveryStatus: "SENT",
        campaignCode: { code: "SUNDAY-CLAIMED1" },
      },
    ]);
    const result = await campaignService.listClaims("user-1", "camp-1", 50);
    expect(result.claims).toEqual([
      expect.objectContaining({ code: "SUNDAY-CLAIMED1", instagramUsername: "creator" }),
    ]);
    expect(mockCampaignClaimFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campaignId: "camp-1" } }),
    );
  });

  it("maps AppError without leaking Prisma messages on create P2002", async () => {
    mockKeywordRuleFindFirst.mockResolvedValue({ id: "rule-1" });
    setCampaignCodeGeneratorForTests(() => ["A-1", "A-2"]);
    mockTransaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed on codes", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      campaignService.create("user-1", {
        keywordRuleId: "rule-1",
        name: "X",
        startsAt: baseCampaign.startsAt,
        endsAt: baseCampaign.endsAt,
        maxClaims: 2,
        dmTemplate: "Hi {{code}}",
        soldOutMessage: "gone",
        alreadyClaimedMessage: "had {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "A", length: 8 },
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
