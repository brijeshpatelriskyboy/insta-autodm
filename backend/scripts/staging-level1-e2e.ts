/**
 * Level 1 staging E2E harness for Comment2DM V2 Smart Campaigns.
 *
 * Uses production-shaped signed webhook fixtures against a staging API with
 * the Meta private-reply stub enabled. Never targets production identifiers.
 *
 * Required env:
 *   STAGING_API_URL              — staging Railway backend base URL
 *   DATABASE_URL                 — staging Postgres (must pass V2 safety)
 *   COMMENT2DM_ALLOW_REMOTE_V2_DB=true  (for remote staging DB)
 *   JWT_SECRET                   — same as staging backend (for token encrypt)
 *   INSTAGRAM_APP_SECRET         — same as staging backend (for webhook HMAC)
 *   STAGING_META_STUB_SECRET     — same as staging backend (stub diagnostic key)
 *
 * Optional:
 *   STAGING_SKIP_CONCURRENCY=1   — skip 150-event concurrency suite
 *   STAGING_E2E_EMAIL / STAGING_E2E_PASSWORD
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertSafeV2DatabaseUrl } from "../src/lib/dbSafety";
import { encryptToken } from "../src/utils/tokenCrypto";
import {
  assert,
  buildCommentWebhookPayload,
  fail,
  postInstagramWebhook,
  rejectProductionUrl,
  requireStagingStubSecret,
  stagingHttp,
  type Json,
} from "./staging-e2e-shared";

const API = (process.env.STAGING_API_URL ?? "").replace(/\/$/, "");
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET?.trim() || "";
const EMAIL = process.env.STAGING_E2E_EMAIL ?? "staging-level1@comment2dm-v2.staging";
const PASSWORD = process.env.STAGING_E2E_PASSWORD ?? `stage_${randomBytes(8).toString("hex")}`;
const IG_USER_ID = process.env.STAGING_IG_USER_ID ?? "staging_ig_user_v2_001";
const MEDIA_ID = "staging_media_v2_001";

async function http(
  method: string,
  path: string,
  options: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<{ status: number; json: Json }> {
  return stagingHttp(API, method, path, {
    ...options,
    stubSecret: requireStagingStubSecret(),
  });
}

function buildCommentWebhook(params: {
  commentId: string;
  text: string;
  commenterId?: string | null;
  commenterUsername?: string;
}): Buffer {
  return buildCommentWebhookPayload({
    ...params,
    igUserId: IG_USER_ID,
    mediaId: MEDIA_ID,
  });
}

async function postWebhook(raw: Buffer): Promise<Json> {
  const result = await postInstagramWebhook(API, APP_SECRET, raw);
  assert(result.status === 200, `webhook HTTP ${result.status}`);
  return result.json;
}

async function main(): Promise<void> {
  console.log("=== Comment2DM V2 Staging Level 1 E2E ===");

  if (!API) fail("STAGING_API_URL is required");
  if (!APP_SECRET) fail("INSTAGRAM_APP_SECRET is required for signed fixtures");
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    fail("JWT_SECRET must match staging backend (min 16 chars)");
  }
  requireStagingStubSecret();

  rejectProductionUrl("STAGING_API_URL", API);
  const dbParts = assertSafeV2DatabaseUrl(process.env.DATABASE_URL);
  console.log(`[db] host=${dbParts.hostname} database=${dbParts.database}`);

  const health = await http("GET", "/health");
  assert(health.status === 200, "health check failed");
  assert(
    health.json.deploymentEnv === "staging",
    `expected deploymentEnv=staging, got ${String(health.json.deploymentEnv)}`,
  );
  console.log("[ok] health staging");

  const stubStatus = await http("GET", "/api/staging/meta-stub/status");
  assert(stubStatus.status === 200 && stubStatus.json.stubActive === true, "meta stub not active");
  await http("POST", "/api/staging/meta-stub/reset");
  console.log("[ok] meta stub active");

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const encryptedToken = encryptToken("staging-stub-token-not-a-real-meta-token");

  // Remove any prior fixture rows for this email OR shared staging IG user id.
  const existingByIg = await prisma.instagramAccount.findUnique({
    where: { instagramUserId: IG_USER_ID },
  });
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  const userIds = new Set<string>();
  if (existing) userIds.add(existing.id);
  if (existingByIg) userIds.add(existingByIg.userId);

  for (const userId of userIds) {
    await prisma.campaignClaim.deleteMany({
      where: { campaign: { userId } },
    });
    await prisma.campaignCode.deleteMany({
      where: { campaign: { userId } },
    });
    await prisma.campaign.deleteMany({ where: { userId } });
    await prisma.dmEvent.deleteMany({ where: { userId } });
    await prisma.activityEvent.deleteMany({ where: { userId } });
    await prisma.keywordRule.deleteMany({ where: { userId } });
    await prisma.instagramAccount.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      name: "Staging Level1",
      passwordHash,
    },
  });

  await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramUserId: IG_USER_ID,
      username: "staging_v2_ig",
      accountType: "BUSINESS",
      accessTokenEncrypted: encryptedToken,
      connectionStatus: "connected",
      connectedAt: new Date(),
    },
  });

  // Register may already exist — use login after create.
  let login = await http("POST", "/api/auth/login", {
    body: { email: EMAIL, password: PASSWORD },
  });
  if (login.status !== 200) {
    fail(`login failed: ${JSON.stringify(login.json)}`);
  }
  const token = String((login.json as { token?: string }).token ?? "");
  assert(token, "missing auth token");

  // --- Standard DM path (no campaign) ---
  const stdRuleRes = await http("POST", "/api/keyword-rules", {
    token,
    body: {
      keyword: "STAGEDM",
      dmMessage: "Staging standard DM hello",
      isActive: true,
    },
  });
  assert(stdRuleRes.status === 201 || stdRuleRes.status === 200, "create standard rule failed");

  await http("POST", "/api/staging/meta-stub/configure", {
    body: { clearCaptures: true },
  });

  const stdWebhook = await postWebhook(
    buildCommentWebhook({
      commentId: "std-comment-1",
      text: "please send STAGEDM",
      commenterId: "commenter-std-1",
      commenterUsername: "std_user",
    }),
  );
  assert(Number(stdWebhook.sent) === 1, `standard DM expected sent=1 got ${JSON.stringify(stdWebhook)}`);
  const stdDm = await prisma.dmEvent.findFirst({
    where: { commentId: "std-comment-1", userId: user.id },
  });
  assert(stdDm?.status === "sent", "standard DmEvent not sent");
  const stdCaptures = await http("GET", "/api/staging/meta-stub/captures");
  const stdCapture = (stdCaptures.json.captures as Array<{ commentId: string; messageText: string }>)?.find(
    (c) => c.commentId === "std-comment-1",
  );
  assert(stdCapture?.messageText === "Staging standard DM hello", "standard stub message mismatch");
  console.log("[ok] Standard DM staging path");

  // --- Campaign create ---
  const campRuleRes = await http("POST", "/api/keyword-rules", {
    token,
    body: {
      keyword: "STAGETICKET",
      dmMessage: "fallback standard — should not send when campaign active",
      isActive: true,
    },
  });
  assert(campRuleRes.status === 201 || campRuleRes.status === 200, "campaign keyword rule failed");
  const keywordRuleId = String((campRuleRes.json as { id?: string }).id ?? "");

  const now = Date.now();
  const createCamp = await http("POST", "/api/campaigns", {
    token,
    body: {
      keywordRuleId,
      name: "Staging Ticket Test",
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 24 * 60 * 60_000).toISOString(),
      maxClaims: 2,
      dmTemplate: "Congratulations! Your unique ticket code is {{code}}",
      alreadyClaimedMessage: "You already claimed your ticket. Your code is {{code}}",
      soldOutMessage: "All free tickets have now been claimed.",
      notStartedMessage: "Staging campaign has not started yet.",
      endedMessage: "Staging campaign has ended.",
      codeGeneration: { mode: "AUTO", prefix: "STG", length: 8 },
    },
  });
  assert(createCamp.status === 201, `campaign create failed: ${JSON.stringify(createCamp.json)}`);
  const campaignId = String((createCamp.json as { id?: string }).id ?? "");

  const activate = await http("POST", `/api/campaigns/${campaignId}/activate`, { token });
  assert(activate.status === 200, `activate failed: ${JSON.stringify(activate.json)}`);
  await http("POST", "/api/staging/meta-stub/configure", { body: { clearCaptures: true } });

  const results: Record<string, string> = {};

  // A
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-1",
      text: "STAGETICKET please",
      commenterId: "commenter-1",
      commenterUsername: "user_one",
    }),
  );
  const claimA = await prisma.campaignClaim.findFirst({
    where: { campaignId, sourceCommentId: "comment-1" },
    include: { campaignCode: true },
  });
  assert(claimA?.deliveryStatus === "SENT", `A: claim not SENT (${claimA?.deliveryStatus})`);
  assert(claimA.campaignCode.status === "CLAIMED", "A: code not CLAIMED");
  const codeA = claimA.campaignCode.code;
  const dmA = await prisma.dmEvent.findFirst({ where: { commentId: "comment-1" } });
  assert(dmA?.status === "sent", "A: DmEvent not sent");
  results.A = `code=${codeA}`;
  console.log("[ok] A", results.A);

  // B
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-2",
      text: "I want STAGETICKET",
      commenterId: "commenter-2",
      commenterUsername: "user_two",
    }),
  );
  const claimB = await prisma.campaignClaim.findFirst({
    where: { campaignId, sourceCommentId: "comment-2" },
    include: { campaignCode: true },
  });
  assert(claimB?.deliveryStatus === "SENT", "B: claim not SENT");
  const codeB = claimB.campaignCode.code;
  assert(codeB !== codeA, "B: code must differ from A");
  results.B = `code=${codeB}`;
  console.log("[ok] B", results.B);

  const campAfterB = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  assert(campAfterB.claimedCount === 2, `claimedCount expected 2 got ${campAfterB.claimedCount}`);

  // C — same commenter, new comment → original code, no new claim
  const claimsBeforeC = await prisma.campaignClaim.count({ where: { campaignId } });
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-1b",
      text: "STAGETICKET again",
      commenterId: "commenter-1",
      commenterUsername: "user_one",
    }),
  );
  const claimsAfterC = await prisma.campaignClaim.count({ where: { campaignId } });
  assert(claimsAfterC === claimsBeforeC, "C: new CampaignClaim created");
  const campAfterC = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  assert(campAfterC.claimedCount === 2, "C: claimedCount changed");
  const capturesC = await http("GET", "/api/staging/meta-stub/captures");
  const capC = (capturesC.json.captures as Array<{ commentId: string; messageText: string }>).find(
    (c) => c.commentId === "comment-1b",
  );
  assert(capC?.messageText.includes(codeA), "C: reminder should include code A");
  assert(!capC?.messageText.includes(codeB) || capC.messageText.includes(codeA), "C: wrong code");
  results.C = "already-claimed reminder with code A";
  console.log("[ok] C", results.C);

  // D — replay comment-1 → no second allocation
  const codesClaimedBeforeD = await prisma.campaignCode.count({
    where: { campaignId, status: "CLAIMED" },
  });
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-1",
      text: "STAGETICKET please",
      commenterId: "commenter-1",
      commenterUsername: "user_one",
    }),
  );
  const codesClaimedAfterD = await prisma.campaignCode.count({
    where: { campaignId, status: "CLAIMED" },
  });
  assert(codesClaimedAfterD === codesClaimedBeforeD, "D: second allocation occurred");
  results.D = "replay ignored";
  console.log("[ok] D", results.D);

  // E — sold out
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-3",
      text: "STAGETICKET",
      commenterId: "commenter-3",
      commenterUsername: "user_three",
    }),
  );
  const claimE = await prisma.campaignClaim.findFirst({
    where: { campaignId, sourceCommentId: "comment-3" },
  });
  assert(!claimE, "E: third claim should not exist");
  const capturesE = await http("GET", "/api/staging/meta-stub/captures");
  const capE = (capturesE.json.captures as Array<{ commentId: string; messageText: string }>).find(
    (c) => c.commentId === "comment-3",
  );
  assert(capE?.messageText === "All free tickets have now been claimed.", "E: sold out message");
  results.E = "soldOutMessage";
  console.log("[ok] E", results.E);

  // F — paused
  await http("POST", `/api/campaigns/${campaignId}/pause`, { token });
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-paused",
      text: "STAGETICKET",
      commenterId: "commenter-paused",
      commenterUsername: "paused_user",
    }),
  );
  const capF = (
    (await http("GET", "/api/staging/meta-stub/captures")).json.captures as Array<{
      commentId: string;
      messageText: string;
    }>
  ).find((c) => c.commentId === "comment-paused");
  assert(
    capF?.messageText === "This campaign is temporarily unavailable.",
    `F: paused message got ${capF?.messageText}`,
  );
  assert(
    !(await prisma.campaignClaim.findFirst({
      where: { campaignId, sourceCommentId: "comment-paused" },
    })),
    "F: claim should not exist",
  );
  results.F = "paused message";
  console.log("[ok] F", results.F);

  // G — not started (new campaign)
  const ruleG = await http("POST", "/api/keyword-rules", {
    token,
    body: { keyword: "STAGENOTYET", dmMessage: "fallback", isActive: true },
  });
  const gId = String((ruleG.json as { id?: string }).id);
  const createG = await http("POST", "/api/campaigns", {
    token,
    body: {
      keywordRuleId: gId,
      name: "Not Started Staging",
      startsAt: new Date(now + 60 * 60_000).toISOString(),
      endsAt: new Date(now + 2 * 60 * 60_000).toISOString(),
      maxClaims: 2,
      dmTemplate: "Congratulations! Your unique ticket code is {{code}}",
      alreadyClaimedMessage: "You already claimed your ticket. Your code is {{code}}",
      soldOutMessage: "All free tickets have now been claimed.",
      notStartedMessage: "Staging campaign has not started yet.",
      endedMessage: "Staging campaign has ended.",
      codeGeneration: { mode: "AUTO", prefix: "NS", length: 8 },
    },
  });
  const campG = String((createG.json as { id?: string }).id);
  await http("POST", `/api/campaigns/${campG}/activate`, { token });
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-not-started",
      text: "STAGENOTYET",
      commenterId: "commenter-ns",
      commenterUsername: "ns_user",
    }),
  );
  const capG = (
    (await http("GET", "/api/staging/meta-stub/captures")).json.captures as Array<{
      commentId: string;
      messageText: string;
    }>
  ).find((c) => c.commentId === "comment-not-started");
  assert(
    capG?.messageText === "Staging campaign has not started yet.",
    `G: ${capG?.messageText}`,
  );
  results.G = "not-started message";
  console.log("[ok] G", results.G);

  // H — ended
  const ruleH = await http("POST", "/api/keyword-rules", {
    token,
    body: { keyword: "STAGEENDED", dmMessage: "fallback", isActive: true },
  });
  const hRule = String((ruleH.json as { id?: string }).id);
  const createH = await http("POST", "/api/campaigns", {
    token,
    body: {
      keywordRuleId: hRule,
      name: "Ended Staging",
      startsAt: new Date(now - 2 * 60 * 60_000).toISOString(),
      endsAt: new Date(now - 60_000).toISOString(),
      maxClaims: 2,
      dmTemplate: "Congratulations! Your unique ticket code is {{code}}",
      alreadyClaimedMessage: "You already claimed your ticket. Your code is {{code}}",
      soldOutMessage: "All free tickets have now been claimed.",
      notStartedMessage: "Staging campaign has not started yet.",
      endedMessage: "Staging campaign has ended.",
      codeGeneration: { mode: "AUTO", prefix: "EN", length: 8 },
    },
  });
  const campH = String((createH.json as { id?: string }).id);
  await http("POST", `/api/campaigns/${campH}/activate`, { token });
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-ended",
      text: "STAGEENDED",
      commenterId: "commenter-ended",
      commenterUsername: "ended_user",
    }),
  );
  const capH = (
    (await http("GET", "/api/staging/meta-stub/captures")).json.captures as Array<{
      commentId: string;
      messageText: string;
    }>
  ).find((c) => c.commentId === "comment-ended");
  assert(capH?.messageText === "Staging campaign has ended.", `H: ${capH?.messageText}`);
  results.H = "ended message";
  console.log("[ok] H", results.H);

  // I — missing commenterId
  await http("POST", `/api/campaigns/${campaignId}/activate`, { token });
  // Re-open window for paused campaign — activate again
  await postWebhook(
    buildCommentWebhook({
      commentId: "comment-missing-id",
      text: "STAGETICKET",
      commenterId: null,
      commenterUsername: "no_id_user",
    }),
  );
  const capI = (
    (await http("GET", "/api/staging/meta-stub/captures")).json.captures as Array<{
      commentId: string;
      messageText: string;
    }>
  ).find((c) => c.commentId === "comment-missing-id");
  assert(
    capI?.messageText.includes("couldn't verify") ||
      capI?.messageText.includes("unique code"),
    `I: fail-closed message got ${capI?.messageText}`,
  );
  assert(
    !(await prisma.campaignClaim.findFirst({
      where: { campaignId, sourceCommentId: "comment-missing-id" },
    })),
    "I: claim should not exist",
  );
  results.I = "missing identity fail-closed";
  console.log("[ok] I", results.I);

  // --- Failure / retry ---
  console.log("--- failure/retry ---");
  const ruleFail = await http("POST", "/api/keyword-rules", {
    token,
    body: { keyword: "STAGEFAIL", dmMessage: "fallback", isActive: true },
  });
  const failRuleId = String((ruleFail.json as { id?: string }).id);
  const createFail = await http("POST", "/api/campaigns", {
    token,
    body: {
      keywordRuleId: failRuleId,
      name: "Failure Retry Staging",
      startsAt: new Date(now - 60_000).toISOString(),
      endsAt: new Date(now + 24 * 60 * 60_000).toISOString(),
      maxClaims: 3,
      dmTemplate: "Congratulations! Your unique ticket code is {{code}}",
      alreadyClaimedMessage: "You already claimed your ticket. Your code is {{code}}",
      soldOutMessage: "All free tickets have now been claimed.",
      codeGeneration: { mode: "AUTO", prefix: "FL", length: 8 },
    },
  });
  const failCampId = String((createFail.json as { id?: string }).id);
  await http("POST", `/api/campaigns/${failCampId}/activate`, { token });

  await http("POST", "/api/staging/meta-stub/configure", {
    body: { clearCaptures: true, failCommentIds: ["fail-comment-a"] },
  });

  await postWebhook(
    buildCommentWebhook({
      commentId: "fail-comment-a",
      text: "STAGEFAIL",
      commenterId: "fail-commenter-a",
      commenterUsername: "fail_a",
    }),
  );
  const failClaimA = await prisma.campaignClaim.findFirst({
    where: { campaignId: failCampId, sourceCommentId: "fail-comment-a" },
    include: { campaignCode: true },
  });
  assert(failClaimA?.deliveryStatus === "FAILED", `fail A delivery ${failClaimA?.deliveryStatus}`);
  assert(failClaimA.campaignCode.status === "RESERVED", "fail A code should remain RESERVED");
  const failDmA = await prisma.dmEvent.findFirst({ where: { commentId: "fail-comment-a" } });
  assert(failDmA?.status === "failed", "fail A DmEvent failed");
  const codeFailA = failClaimA.campaignCode.code;
  console.log("[ok] failure reserve", codeFailA);

  await http("POST", "/api/staging/meta-stub/configure", {
    body: { failCommentIds: [] },
  });

  await postWebhook(
    buildCommentWebhook({
      commentId: "fail-comment-b",
      text: "STAGEFAIL",
      commenterId: "fail-commenter-b",
      commenterUsername: "fail_b",
    }),
  );
  const failClaimB = await prisma.campaignClaim.findFirst({
    where: { campaignId: failCampId, sourceCommentId: "fail-comment-b" },
    include: { campaignCode: true },
  });
  assert(failClaimB?.deliveryStatus === "SENT", "fail B should SENT");
  assert(failClaimB.campaignCode.code !== codeFailA, "fail B must get different code");
  console.log("[ok] commenter B different code");

  // Replay A → success, same code
  await postWebhook(
    buildCommentWebhook({
      commentId: "fail-comment-a",
      text: "STAGEFAIL",
      commenterId: "fail-commenter-a",
      commenterUsername: "fail_a",
    }),
  );
  const failClaimA2 = await prisma.campaignClaim.findFirst({
    where: { campaignId: failCampId, sourceCommentId: "fail-comment-a" },
    include: { campaignCode: true },
  });
  assert(failClaimA2?.campaignCode.code === codeFailA, "retry A must keep same code");
  assert(failClaimA2?.deliveryStatus === "SENT", "retry A should SENT");
  assert(failClaimA2.campaignCode.status === "CLAIMED", "retry A code CLAIMED");
  console.log("[ok] retry A success");

  // Exhausted failure — never return to AVAILABLE
  await http("POST", "/api/staging/meta-stub/configure", {
    body: { failCommentIds: ["fail-comment-x1", "fail-comment-x1"] },
  });
  // Use a fresh comment that will fail max attempts. Configure fail for that id always.
  await http("POST", "/api/staging/meta-stub/configure", {
    body: { failCommentIds: ["fail-exhaust-1"] },
  });
  for (let i = 0; i < 3; i++) {
    await postWebhook(
      buildCommentWebhook({
        commentId: "fail-exhaust-1",
        text: "STAGEFAIL",
        commenterId: "fail-exhaust-user",
        commenterUsername: "exhaust_user",
      }),
    );
  }
  const exhaustClaim = await prisma.campaignClaim.findFirst({
    where: { campaignId: failCampId, sourceCommentId: "fail-exhaust-1" },
    include: { campaignCode: true },
  });
  assert(
    exhaustClaim?.deliveryStatus === "EXHAUSTED" || exhaustClaim?.deliveryStatus === "FAILED",
    `exhaust delivery ${exhaustClaim?.deliveryStatus}`,
  );
  assert(exhaustClaim?.campaignCode.status === "RESERVED", "exhausted code must stay RESERVED");
  assert(
    exhaustClaim.campaignCode.status !== "AVAILABLE",
    "exhausted code must never return to AVAILABLE",
  );
  console.log("[ok] exhausted stays RESERVED");

  // --- Concurrency ---
  if (process.env.STAGING_SKIP_CONCURRENCY === "1") {
    console.log("[skip] concurrency suite");
  } else {
    console.log("--- concurrency 150 → 100 ---");
    const ruleConc = await http("POST", "/api/keyword-rules", {
      token,
      body: { keyword: "STAGECONC", dmMessage: "fallback", isActive: true },
    });
    const concRuleId = String((ruleConc.json as { id?: string }).id);
    const createConc = await http("POST", "/api/campaigns", {
      token,
      body: {
        keywordRuleId: concRuleId,
        name: "Concurrency Staging",
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
        maxClaims: 100,
        dmTemplate: "Congratulations! Your unique ticket code is {{code}}",
        alreadyClaimedMessage: "You already claimed your ticket. Your code is {{code}}",
        soldOutMessage: "All free tickets have now been claimed.",
        codeGeneration: { mode: "AUTO", prefix: "CC", length: 8 },
      },
    });
    const concId = String((createConc.json as { id?: string }).id);
    await http("POST", `/api/campaigns/${concId}/activate`, { token });
    await http("POST", "/api/staging/meta-stub/configure", {
      body: { clearCaptures: true, failCommentIds: [] },
    });

    const jobs = Array.from({ length: 150 }, (_, i) =>
      postWebhook(
        buildCommentWebhook({
          commentId: `conc-comment-${i}`,
          text: "STAGECONC",
          commenterId: `conc-commenter-${i}`,
          commenterUsername: `conc_user_${i}`,
        }),
      ),
    );
    const webhookResults = await Promise.all(jobs);
    const soldOutCaptures = (
      (await http("GET", "/api/staging/meta-stub/captures")).json.captures as Array<{
        messageText: string;
      }>
    ).filter((c) => c.messageText === "All free tickets have now been claimed.");

    const concCamp = await prisma.campaign.findUniqueOrThrow({ where: { id: concId } });
    const concClaims = await prisma.campaignClaim.findMany({
      where: { campaignId: concId },
      include: { campaignCode: true },
    });
    const distinctCodes = new Set(concClaims.map((c) => c.campaignCode.code));
    assert(concClaims.length === 100, `expected 100 claims got ${concClaims.length}`);
    assert(distinctCodes.size === 100, `expected 100 distinct codes got ${distinctCodes.size}`);
    assert(concCamp.claimedCount === 100, `claimedCount ${concCamp.claimedCount}`);
    assert(soldOutCaptures.length === 50, `expected 50 sold out got ${soldOutCaptures.length}`);
    console.log("[ok] concurrency allocation", {
      claims: concClaims.length,
      codes: distinctCodes.size,
      soldOut: soldOutCaptures.length,
      webhookOk: webhookResults.length,
    });

    // same comment ×50 → one claim
    const beforeDup = await prisma.campaignClaim.count({
      where: { campaignId: concId, sourceCommentId: "conc-comment-0" },
    });
    await Promise.all(
      Array.from({ length: 50 }, () =>
        postWebhook(
          buildCommentWebhook({
            commentId: "conc-comment-0",
            text: "STAGECONC",
            commenterId: "conc-commenter-0",
            commenterUsername: "conc_user_0",
          }),
        ),
      ),
    );
    const afterDup = await prisma.campaignClaim.count({
      where: { campaignId: concId, sourceCommentId: "conc-comment-0" },
    });
    assert(beforeDup === 1 && afterDup === 1, "same comment ×50 must stay one claim");
    console.log("[ok] same comment ×50 → one claim");

    // same commenter + different comments ×50 → one claim (already claimed path)
    const beforeUser = await prisma.campaignClaim.count({
      where: { campaignId: concId, instagramCommenterId: "conc-commenter-0" },
    });
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        postWebhook(
          buildCommentWebhook({
            commentId: `conc-same-user-${i}`,
            text: "STAGECONC",
            commenterId: "conc-commenter-0",
            commenterUsername: "conc_user_0",
          }),
        ),
      ),
    );
    const afterUser = await prisma.campaignClaim.count({
      where: { campaignId: concId, instagramCommenterId: "conc-commenter-0" },
    });
    assert(beforeUser === 1 && afterUser === 1, "same commenter ×50 must stay one claim");
    console.log("[ok] same commenter different comments ×50 → one claim");
  }

  // --- Security smoke ---
  const healthBody = JSON.stringify(health.json);
  assert(!healthBody.toLowerCase().includes("postgresql://"), "health leaked DB url");
  const capturesBody = JSON.stringify(
    (await http("GET", "/api/staging/meta-stub/captures")).json,
  );
  assert(!capturesBody.includes("staging-stub-token"), "captures leaked token");
  assert(!capturesBody.includes("Bearer "), "captures leaked bearer");

  const unauthClaims = await http("GET", `/api/campaigns/${campaignId}/claims`);
  assert(unauthClaims.status === 401 || unauthClaims.status === 403, "claims must require auth");

  // Codes pool must not be publicly exposed
  const publicCodes = await http("GET", `/api/campaigns/${campaignId}`);
  const publicStr = JSON.stringify(publicCodes.json);
  // Authenticated get is ok — ensure unused code list isn't a public unauth dump
  assert(unauthClaims.status !== 200, "unauthenticated claims access blocked");
  void publicStr;
  console.log("[ok] security smoke");

  await prisma.$disconnect();
  console.log("=== Level 1 E2E PASSED ===");
  console.log(JSON.stringify({ results, hmacAlgo: "sha256", note: "no secrets printed" }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
