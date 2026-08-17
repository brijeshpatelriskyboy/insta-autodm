/**
 * Level 2 staging E2E harness for Comment2DM V2 Smart Campaigns.
 *
 * Meta-free: signed webhook fixtures + staging private-reply stub.
 * Covers operator/lifecycle/isolation/security P0 contracts.
 *
 * Required env: same as Level 1 plus STAGING_META_STUB_SECRET.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient, type CampaignCode } from "@prisma/client";
import { assertSafeV2DatabaseUrl } from "../src/lib/dbSafety";
import { encryptToken } from "../src/utils/tokenCrypto";
import {
  assert,
  buildCommentWebhookPayload,
  fail,
  jsonContainsAnyCode,
  postInstagramWebhook,
  rejectProductionUrl,
  requireStagingStubSecret,
  stagingHttp,
  type Json,
} from "./staging-e2e-shared";

const API = (process.env.STAGING_API_URL ?? "").replace(/\/$/, "");
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET?.trim() || "";
const PASSWORD_A = process.env.STAGING_E2E_PASSWORD_A ?? `l2a_${randomBytes(8).toString("hex")}`;
const PASSWORD_B = process.env.STAGING_E2E_PASSWORD_B ?? `l2b_${randomBytes(8).toString("hex")}`;
const EMAIL_A = "staging-level2-a@comment2dm-v2.staging";
const EMAIL_B = "staging-level2-b@comment2dm-v2.staging";
const IG_A = "staging_ig_user_v2_l2_a";
const IG_B = "staging_ig_user_v2_l2_b";
const MEDIA_A = "staging_media_v2_l2_a";
const MEDIA_B = "staging_media_v2_l2_b";

const trackedCampaignIds: string[] = [];

async function http(
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
    omitStubAuth?: boolean;
  } = {},
): Promise<{ status: number; json: Json }> {
  return stagingHttp(API, method, path, {
    ...options,
    stubSecret: requireStagingStubSecret(),
  });
}

async function postComment(params: {
  igUserId: string;
  mediaId: string;
  commentId: string;
  text: string;
  commenterId?: string | null;
  commenterUsername?: string;
}): Promise<Json> {
  const raw = buildCommentWebhookPayload(params);
  const result = await postInstagramWebhook(API, APP_SECRET, raw);
  assert(result.status === 200, `webhook HTTP ${result.status} for ${params.commentId}`);
  return result.json;
}

async function captureFor(commentId: string): Promise<{ messageText: string } | undefined> {
  const res = await http("GET", "/api/staging/meta-stub/captures");
  const captures = (res.json.captures as Array<{ commentId: string; messageText: string }>) ?? [];
  return captures.find((row) => row.commentId === commentId);
}

function campaignPayload(
  keywordRuleId: string,
  name: string,
  prefix: string,
  extras: Record<string, unknown> = {},
): Record<string, unknown> {
  const now = Date.now();
  return {
    keywordRuleId,
    name,
    startsAt: new Date(now - 60_000).toISOString(),
    endsAt: new Date(now + 24 * 60 * 60_000).toISOString(),
    maxClaims: 5,
    dmTemplate: "Congratulations! Your unique ticket code is {{code}}",
    alreadyClaimedMessage: "You already claimed your ticket. Your code is {{code}}",
    soldOutMessage: "All free tickets have now been claimed.",
    notStartedMessage: "L2 campaign has not started yet.",
    endedMessage: "L2 campaign has ended.",
    codeGeneration: { mode: "AUTO", prefix, length: 8 },
    ...extras,
  };
}

async function createRule(
  token: string,
  keyword: string,
  dmMessage: string,
): Promise<string> {
  const res = await http("POST", "/api/keyword-rules", {
    token,
    body: { keyword, dmMessage, isActive: true },
  });
  assert(res.status === 201 || res.status === 200, `create rule ${keyword} failed`);
  const id = String((res.json as { id?: string }).id ?? "");
  assert(id, `missing rule id for ${keyword}`);
  return id;
}

async function createCampaign(
  token: string,
  body: Record<string, unknown>,
): Promise<{ id: string; json: Json }> {
  const res = await http("POST", "/api/campaigns", { token, body });
  assert(res.status === 201, `campaign create failed: ${JSON.stringify(res.json)}`);
  const id = String((res.json as { id?: string }).id ?? "");
  assert(id, "missing campaign id");
  trackedCampaignIds.push(id);
  return { id, json: res.json };
}

async function login(email: string, password: string): Promise<string> {
  const res = await http("POST", "/api/auth/login", { body: { email, password } });
  assert(res.status === 200, `login failed for ${email}: ${JSON.stringify(res.json)}`);
  const token = String((res.json as { token?: string }).token ?? "");
  assert(token, `missing auth token for ${email}`);
  return token;
}

async function deleteUserTree(prisma: PrismaClient, userId: string): Promise<void> {
  await prisma.campaignClaim.deleteMany({ where: { campaign: { userId } } });
  await prisma.campaignCode.deleteMany({ where: { campaign: { userId } } });
  await prisma.campaign.deleteMany({ where: { userId } });
  await prisma.dmEvent.deleteMany({ where: { userId } });
  await prisma.activityEvent.deleteMany({ where: { userId } });
  await prisma.keywordRule.deleteMany({ where: { userId } });
  await prisma.instagramAccount.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

async function assertCampaignInvariants(
  prisma: PrismaClient,
  campaignId: string,
  label: string,
): Promise<void> {
  const camp = await prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const claims = await prisma.campaignClaim.findMany({
    where: { campaignId },
    include: { campaignCode: true },
  });
  const codes = await prisma.campaignCode.findMany({ where: { campaignId } });

  assert(
    claims.length === camp.claimedCount,
    `${label}: claimedCount ${camp.claimedCount} != claim rows ${claims.length}`,
  );
  assert(
    codes.length === camp.maxClaims,
    `${label}: code count ${codes.length} != maxClaims ${camp.maxClaims}`,
  );
  assert(
    camp.claimedCount <= camp.maxClaims,
    `${label}: claimedCount ${camp.claimedCount} exceeds maxClaims ${camp.maxClaims}`,
  );

  const commentIds = claims.map((row) => row.sourceCommentId);
  assert(
    new Set(commentIds).size === commentIds.length,
    `${label}: duplicate sourceCommentId allocation`,
  );
  const commenters = claims
    .map((row) => row.instagramCommenterId)
    .filter((id): id is string => Boolean(id));
  assert(
    new Set(commenters).size === commenters.length,
    `${label}: duplicate commenter allocation`,
  );
  const codeValues = claims.map((row) => row.campaignCode.code);
  assert(new Set(codeValues).size === codeValues.length, `${label}: duplicate code allocation`);

  for (const claim of claims) {
    if (claim.deliveryStatus === "FAILED" || claim.deliveryStatus === "EXHAUSTED") {
      assert(
        claim.campaignCode.status === "RESERVED",
        `${label}: failed/exhausted code status ${claim.campaignCode.status}`,
      );
      assert(
        claim.campaignCode.status !== "AVAILABLE",
        `${label}: failed reservation returned to AVAILABLE`,
      );
    }
  }
}

async function assertNoUnusedCodesInProductJson(
  token: string,
  campaignId: string,
  unusedCodes: string[],
  label: string,
): Promise<void> {
  const detail = await http("GET", `/api/campaigns/${campaignId}`, { token });
  assert(detail.status === 200, `${label}: get campaign failed`);
  const leakedDetail = jsonContainsAnyCode(detail.json, unusedCodes);
  assert(!leakedDetail, `${label}: unused code leaked in GET campaign (${leakedDetail})`);

  const list = await http("GET", "/api/campaigns", { token });
  assert(list.status === 200, `${label}: list campaigns failed`);
  const leakedList = jsonContainsAnyCode(list.json, unusedCodes);
  assert(!leakedList, `${label}: unused code leaked in list (${leakedList})`);
}

async function seedUser(
  prisma: PrismaClient,
  params: { email: string; password: string; name: string; igUserId: string; username: string },
): Promise<{ id: string; token: string }> {
  const passwordHash = await bcrypt.hash(params.password, 10);
  const encryptedToken = encryptToken("staging-stub-token-not-a-real-meta-token");
  const user = await prisma.user.create({
    data: {
      email: params.email,
      name: params.name,
      passwordHash,
    },
  });
  await prisma.instagramAccount.create({
    data: {
      userId: user.id,
      instagramUserId: params.igUserId,
      username: params.username,
      accountType: "BUSINESS",
      accessTokenEncrypted: encryptedToken,
      connectionStatus: "connected",
      connectedAt: new Date(),
    },
  });
  const token = await login(params.email, params.password);
  return { id: user.id, token };
}

async function main(): Promise<void> {
  console.log("=== Comment2DM V2 Staging Level 2 E2E ===");

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

  // --- P0-1 HMAC ---
  const hmacPayload = buildCommentWebhookPayload({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-hmac-probe",
    text: "hmac probe",
    commenterId: "hmac-user",
    commenterUsername: "hmac_user",
  });
  const missingSig = await postInstagramWebhook(API, APP_SECRET, hmacPayload, {
    signature: null,
  });
  assert(missingSig.status === 401, `P0-1 missing HMAC expected 401 got ${missingSig.status}`);
  const invalidSig = await postInstagramWebhook(API, APP_SECRET, hmacPayload, {
    signature: "sha256=0000000000000000000000000000000000000000000000000000000000000000",
  });
  assert(invalidSig.status === 401, `P0-1 invalid HMAC expected 401 got ${invalidSig.status}`);
  const validSig = await postInstagramWebhook(API, APP_SECRET, hmacPayload);
  assert(validSig.status === 200, `P0-1 valid HMAC expected 200 got ${validSig.status}`);
  console.log("[ok] P0-1 HMAC reject/accept");

  const unauthStub = await http("GET", "/api/staging/meta-stub/captures", {
    omitStubAuth: true,
  });
  assert(unauthStub.status === 401, `stub captures unauth expected 401 got ${unauthStub.status}`);
  assert(
    !JSON.stringify(unauthStub.json).includes("captures") || unauthStub.status === 401,
    "unauthenticated stub captures must not return capture list",
  );

  const stubStatus = await http("GET", "/api/staging/meta-stub/status");
  assert(stubStatus.status === 200 && stubStatus.json.stubActive === true, "meta stub not active");
  await http("POST", "/api/staging/meta-stub/reset");
  console.log("[ok] stub diagnostics require key; stub active");

  const prisma = new PrismaClient();

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: [EMAIL_A, EMAIL_B] } },
    select: { id: true },
  });
  const existingIg = await prisma.instagramAccount.findMany({
    where: { instagramUserId: { in: [IG_A, IG_B] } },
    select: { userId: true },
  });
  const cleanupIds = new Set<string>([
    ...existingUsers.map((row) => row.id),
    ...existingIg.map((row) => row.userId),
  ]);
  for (const userId of cleanupIds) {
    await deleteUserTree(prisma, userId);
  }

  const userA = await seedUser(prisma, {
    email: EMAIL_A,
    password: PASSWORD_A,
    name: "Staging Level2 A",
    igUserId: IG_A,
    username: "staging_v2_l2_a",
  });
  const userB = await seedUser(prisma, {
    email: EMAIL_B,
    password: PASSWORD_B,
    name: "Staging Level2 B",
    igUserId: IG_B,
    username: "staging_v2_l2_b",
  });

  await http("POST", "/api/staging/meta-stub/configure", { body: { clearCaptures: true } });

  // --- P0-2 cross-user isolation ---
  const isoRule = await createRule(userA.token, "L2ISO", "fallback iso A");
  const isoCamp = await createCampaign(
    userA.token,
    campaignPayload(isoRule, "L2 Isolation A", "L2I"),
  );
  const bGet = await http("GET", `/api/campaigns/${isoCamp.id}`, { token: userB.token });
  assert(bGet.status === 404, `P0-2 GET expected 404 got ${bGet.status}`);
  const bPatch = await http("PATCH", `/api/campaigns/${isoCamp.id}`, {
    token: userB.token,
    body: { soldOutMessage: "hijack" },
  });
  assert(bPatch.status === 404, `P0-2 PATCH expected 404 got ${bPatch.status}`);
  const bClaims = await http("GET", `/api/campaigns/${isoCamp.id}/claims`, { token: userB.token });
  assert(bClaims.status === 404, `P0-2 claims expected 404 got ${bClaims.status}`);
  const unauthClaims = await http("GET", `/api/campaigns/${isoCamp.id}/claims`);
  assert(
    unauthClaims.status === 401 || unauthClaims.status === 403,
    `P0-2 unauth claims expected 401/403 got ${unauthClaims.status}`,
  );
  console.log("[ok] P0-2 cross-user GET/PATCH/claims isolation");

  // --- P0-3 two users, same keyword text ---
  const sameRuleA = await createRule(userA.token, "L2SAME", "fallback same A — should not send");
  const sameRuleB = await createRule(userB.token, "L2SAME", "fallback same B — should not send");
  const sameCampA = await createCampaign(
    userA.token,
    campaignPayload(sameRuleA, "L2 Same Keyword A", "L2X", { maxClaims: 2 }),
  );
  const sameCampB = await createCampaign(
    userB.token,
    campaignPayload(sameRuleB, "L2 Same Keyword B", "L2Y", { maxClaims: 2 }),
  );
  assert(
    (await http("POST", `/api/campaigns/${sameCampA.id}/activate`, { token: userA.token }))
      .status === 200,
    "activate same A failed",
  );
  assert(
    (await http("POST", `/api/campaigns/${sameCampB.id}/activate`, { token: userB.token }))
      .status === 200,
    "activate same B failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-same-a-1",
    text: "I want L2SAME",
    commenterId: "shared-commenter-id",
    commenterUsername: "shared_user",
  });
  await postComment({
    igUserId: IG_B,
    mediaId: MEDIA_B,
    commentId: "l2-same-b-1",
    text: "I want L2SAME",
    commenterId: "shared-commenter-id",
    commenterUsername: "shared_user",
  });
  const claimSameA = await prisma.campaignClaim.findFirst({
    where: { campaignId: sameCampA.id, sourceCommentId: "l2-same-a-1" },
    include: { campaignCode: true },
  });
  const claimSameB = await prisma.campaignClaim.findFirst({
    where: { campaignId: sameCampB.id, sourceCommentId: "l2-same-b-1" },
    include: { campaignCode: true },
  });
  assert(claimSameA?.deliveryStatus === "SENT", "P0-3 A claim not SENT");
  assert(claimSameB?.deliveryStatus === "SENT", "P0-3 B claim not SENT");
  assert(claimSameA.campaignCode.code !== claimSameB.campaignCode.code, "P0-3 codes must differ");
  assert(
    !(await prisma.campaignClaim.findFirst({
      where: { campaignId: sameCampA.id, campaignCode: { code: claimSameB.campaignCode.code } },
    })),
    "P0-3 B code appeared in A pool",
  );
  await assertCampaignInvariants(prisma, sameCampA.id, "P0-3 A");
  await assertCampaignInvariants(prisma, sameCampB.id, "P0-3 B");
  console.log("[ok] P0-3 two-user same keyword isolated pools");

  // --- P0-4 one user, two campaigns, two keywords ---
  const ruleOne = await createRule(userA.token, "L2ONE", "fallback one");
  const ruleTwo = await createRule(userA.token, "L2TWO", "fallback two");
  const campOne = await createCampaign(
    userA.token,
    campaignPayload(ruleOne, "L2 Campaign One", "L21", { maxClaims: 2 }),
  );
  const campTwo = await createCampaign(
    userA.token,
    campaignPayload(ruleTwo, "L2 Campaign Two", "L22", { maxClaims: 2 }),
  );
  assert(
    (await http("POST", `/api/campaigns/${campOne.id}/activate`, { token: userA.token })).status ===
      200,
    "activate one failed",
  );
  assert(
    (await http("POST", `/api/campaigns/${campTwo.id}/activate`, { token: userA.token })).status ===
      200,
    "activate two failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-one-c1",
    text: "L2ONE please",
    commenterId: "dual-commenter",
    commenterUsername: "dual_user",
  });
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-two-c1",
    text: "L2TWO please",
    commenterId: "dual-commenter",
    commenterUsername: "dual_user",
  });
  const claimOne = await prisma.campaignClaim.findFirst({
    where: { campaignId: campOne.id, instagramCommenterId: "dual-commenter" },
    include: { campaignCode: true },
  });
  const claimTwo = await prisma.campaignClaim.findFirst({
    where: { campaignId: campTwo.id, instagramCommenterId: "dual-commenter" },
    include: { campaignCode: true },
  });
  assert(claimOne?.deliveryStatus === "SENT" && claimTwo?.deliveryStatus === "SENT", "P0-4 claims");
  assert(claimOne.campaignCode.code !== claimTwo.campaignCode.code, "P0-4 codes must be independent");
  await assertCampaignInvariants(prisma, campOne.id, "P0-4 one");
  await assertCampaignInvariants(prisma, campTwo.id, "P0-4 two");
  console.log("[ok] P0-4 one user two campaigns independent claims");

  // --- P0-5 DRAFT → Standard DM ---
  const draftRule = await createRule(
    userA.token,
    "L2DRAFT",
    "STANDARD_DRAFT_FALLBACK_L2",
  );
  const draftCamp = await createCampaign(
    userA.token,
    campaignPayload(draftRule, "L2 Draft Fallback", "L2D", {
      dmTemplate: "CAMPAIGN_DRAFT_SHOULD_NOT_SEND {{code}}",
    }),
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-draft-c1",
    text: "please send L2DRAFT",
    commenterId: "draft-commenter",
    commenterUsername: "draft_user",
  });
  const draftCap = await captureFor("l2-draft-c1");
  assert(
    draftCap?.messageText === "STANDARD_DRAFT_FALLBACK_L2",
    `P0-5 expected standard DM got ${draftCap?.messageText}`,
  );
  assert(
    (await prisma.campaignClaim.count({ where: { campaignId: draftCamp.id } })) === 0,
    "P0-5 DRAFT created a campaign claim",
  );
  await assertCampaignInvariants(prisma, draftCamp.id, "P0-5");
  console.log("[ok] P0-5 DRAFT matching comment → Standard DM, zero claims");

  // --- P0-6 ARCHIVED → Standard DM ---
  const archRule = await createRule(
    userA.token,
    "L2ARCH",
    "STANDARD_ARCHIVED_FALLBACK_L2",
  );
  const archCamp = await createCampaign(
    userA.token,
    campaignPayload(archRule, "L2 Archive Fallback", "L2H", {
      endedMessage: "CAMPAIGN_ENDED_SHOULD_NOT_SEND",
    }),
  );
  assert(
    (await http("POST", `/api/campaigns/${archCamp.id}/activate`, { token: userA.token })).status ===
      200,
    "archive campaign activate failed",
  );
  assert(
    (await http("POST", `/api/campaigns/${archCamp.id}/pause`, { token: userA.token })).status ===
      200,
    "archive campaign pause failed",
  );
  assert(
    (await http("POST", `/api/campaigns/${archCamp.id}/archive`, { token: userA.token })).status ===
      200,
    "archive failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-arch-c1",
    text: "L2ARCH please",
    commenterId: "arch-commenter",
    commenterUsername: "arch_user",
  });
  const archCap = await captureFor("l2-arch-c1");
  assert(
    archCap?.messageText === "STANDARD_ARCHIVED_FALLBACK_L2",
    `P0-6 expected standard DM got ${archCap?.messageText}`,
  );
  assert(
    archCap?.messageText !== "CAMPAIGN_ENDED_SHOULD_NOT_SEND",
    "P0-6 sent archived campaign template",
  );
  await assertCampaignInvariants(prisma, archCamp.id, "P0-6");
  console.log("[ok] P0-6 ARCHIVED matching comment → Standard DM");

  // --- P0-7 pause remaining inventory, resume ---
  const pauseRule = await createRule(userA.token, "L2PAUSE", "fallback pause");
  const pauseCamp = await createCampaign(
    userA.token,
    campaignPayload(pauseRule, "L2 Pause Resume", "L2P", { maxClaims: 3 }),
  );
  assert(
    (await http("POST", `/api/campaigns/${pauseCamp.id}/activate`, { token: userA.token }))
      .status === 200,
    "pause campaign activate failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-pause-first",
    text: "L2PAUSE",
    commenterId: "pause-first",
    commenterUsername: "pause_first",
  });
  assert(
    (await prisma.campaignClaim.findFirst({
      where: { campaignId: pauseCamp.id, sourceCommentId: "l2-pause-first" },
    }))?.deliveryStatus === "SENT",
    "P0-7 first claim not SENT",
  );
  assert(
    (await http("POST", `/api/campaigns/${pauseCamp.id}/pause`, { token: userA.token })).status ===
      200,
    "pause failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-pause-held",
    text: "L2PAUSE",
    commenterId: "pause-held",
    commenterUsername: "pause_held",
  });
  const pausedCap = await captureFor("l2-pause-held");
  assert(
    pausedCap?.messageText === "This campaign is temporarily unavailable.",
    `P0-7 paused message got ${pausedCap?.messageText}`,
  );
  assert(
    !(await prisma.campaignClaim.findFirst({
      where: { campaignId: pauseCamp.id, sourceCommentId: "l2-pause-held" },
    })),
    "P0-7 claim created while paused",
  );
  assert(
    (await http("POST", `/api/campaigns/${pauseCamp.id}/activate`, { token: userA.token }))
      .status === 200,
    "resume failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-pause-resume",
    text: "L2PAUSE",
    commenterId: "pause-held",
    commenterUsername: "pause_held",
  });
  const resumed = await prisma.campaignClaim.findFirst({
    where: { campaignId: pauseCamp.id, sourceCommentId: "l2-pause-resume" },
    include: { campaignCode: true },
  });
  assert(resumed?.deliveryStatus === "SENT", "P0-7 resume did not allocate");
  assert(
    (await prisma.campaign.findUniqueOrThrow({ where: { id: pauseCamp.id } })).claimedCount === 2,
    "P0-7 claimedCount after resume",
  );
  await assertCampaignInvariants(prisma, pauseCamp.id, "P0-7");
  console.log("[ok] P0-7 pause remaining inventory then resume allocation");

  // --- P0-8 ACTIVE allowed message PATCH ---
  const msgRule = await createRule(userA.token, "L2MSG", "fallback msg");
  const msgCamp = await createCampaign(
    userA.token,
    campaignPayload(msgRule, "L2 Message Patch", "L2M", {
      maxClaims: 1,
      soldOutMessage: "ORIGINAL_SOLD_OUT_L2",
    }),
  );
  assert(
    (await http("POST", `/api/campaigns/${msgCamp.id}/activate`, { token: userA.token })).status ===
      200,
    "message campaign activate failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-msg-take",
    text: "L2MSG",
    commenterId: "msg-taker",
    commenterUsername: "msg_taker",
  });
  const patched = await http("PATCH", `/api/campaigns/${msgCamp.id}`, {
    token: userA.token,
    body: { soldOutMessage: "UPDATED_SOLD_OUT_L2" },
  });
  assert(patched.status === 200, `P0-8 patch failed: ${JSON.stringify(patched.json)}`);
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-msg-sold",
    text: "L2MSG",
    commenterId: "msg-late",
    commenterUsername: "msg_late",
  });
  const soldCap = await captureFor("l2-msg-sold");
  assert(
    soldCap?.messageText === "UPDATED_SOLD_OUT_L2",
    `P0-8 expected updated sold-out got ${soldCap?.messageText}`,
  );
  await assertCampaignInvariants(prisma, msgCamp.id, "P0-8");
  console.log("[ok] P0-8 ACTIVE message PATCH used on next webhook");

  // --- P0-9 ACTIVE forbidden PATCH ---
  const forbidMax = await http("PATCH", `/api/campaigns/${msgCamp.id}`, {
    token: userA.token,
    body: { maxClaims: 99 },
  });
  assert(forbidMax.status === 400, `P0-9 maxClaims expected 400 got ${forbidMax.status}`);
  const forbidTpl = await http("PATCH", `/api/campaigns/${msgCamp.id}`, {
    token: userA.token,
    body: { dmTemplate: "Nope {{code}}" },
  });
  assert(forbidTpl.status === 400, `P0-9 dmTemplate expected 400 got ${forbidTpl.status}`);
  const forbidName = await http("PATCH", `/api/campaigns/${msgCamp.id}`, {
    token: userA.token,
    body: { name: "Hijacked" },
  });
  assert(forbidName.status === 400, `P0-9 name expected 400 got ${forbidName.status}`);
  const afterForbid = await prisma.campaign.findUniqueOrThrow({ where: { id: msgCamp.id } });
  assert(afterForbid.maxClaims === 1, "P0-9 maxClaims mutated");
  assert(afterForbid.name === "L2 Message Patch", "P0-9 name mutated");
  console.log("[ok] P0-9 ACTIVE forbidden PATCH fields rejected");

  // --- P0-10 DRAFT resize 50→3→10 ---
  const resizeRule = await createRule(userA.token, "L2RESIZE", "fallback resize");
  const resizeCamp = await createCampaign(
    userA.token,
    campaignPayload(resizeRule, "L2 Draft Resize", "L2R", { maxClaims: 50 }),
  );
  const codes50 = await prisma.campaignCode.findMany({ where: { campaignId: resizeCamp.id } });
  assert(codes50.length === 50, `P0-10 expected 50 codes got ${codes50.length}`);
  await assertNoUnusedCodesInProductJson(
    userA.token,
    resizeCamp.id,
    codes50.map((row) => row.code),
    "P0-10 after create",
  );

  const to3 = await http("PATCH", `/api/campaigns/${resizeCamp.id}`, {
    token: userA.token,
    body: { maxClaims: 3 },
  });
  assert(to3.status === 200, `P0-10 resize 3 failed: ${JSON.stringify(to3.json)}`);
  const codes3 = await prisma.campaignCode.findMany({ where: { campaignId: resizeCamp.id } });
  assert(codes3.length === 3, `P0-10 expected 3 codes got ${codes3.length}`);
  assert(
    codes3.every((row: CampaignCode) => row.status === "AVAILABLE"),
    "P0-10 resize 3 left non-AVAILABLE codes",
  );

  const to10 = await http("PATCH", `/api/campaigns/${resizeCamp.id}`, {
    token: userA.token,
    body: { maxClaims: 10 },
  });
  assert(to10.status === 200, `P0-10 resize 10 failed: ${JSON.stringify(to10.json)}`);
  const codes10 = await prisma.campaignCode.findMany({ where: { campaignId: resizeCamp.id } });
  assert(codes10.length === 10, `P0-10 expected 10 codes got ${codes10.length}`);
  const camp10 = await prisma.campaign.findUniqueOrThrow({ where: { id: resizeCamp.id } });
  assert(camp10.maxClaims === 10, "P0-10 maxClaims not 10");
  await assertNoUnusedCodesInProductJson(
    userA.token,
    resizeCamp.id,
    codes10.map((row) => row.code),
    "P0-10 after resize 10",
  );

  assert(
    (await http("POST", `/api/campaigns/${resizeCamp.id}/activate`, { token: userA.token }))
      .status === 200,
    "P0-10 activate after resize failed",
  );
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-resize-c1",
    text: "L2RESIZE",
    commenterId: "resize-user",
    commenterUsername: "resize_user",
  });
  const resizeClaim = await prisma.campaignClaim.findFirst({
    where: { campaignId: resizeCamp.id, sourceCommentId: "l2-resize-c1" },
    include: { campaignCode: true },
  });
  assert(resizeClaim?.deliveryStatus === "SENT", "P0-10 allocation after resize failed");
  await assertCampaignInvariants(prisma, resizeCamp.id, "P0-10");
  console.log("[ok] P0-10 DRAFT resize 50→3→10 then activate+allocate");

  // --- P0-11 second ACTIVE on same keyword rule ---
  const dupRule = await createRule(userA.token, "L2DUP", "fallback dup");
  const dupFirst = await createCampaign(
    userA.token,
    campaignPayload(dupRule, "L2 Dup First", "L2F", { maxClaims: 2 }),
  );
  const dupSecond = await createCampaign(
    userA.token,
    campaignPayload(dupRule, "L2 Dup Second", "L2S", { maxClaims: 2 }),
  );
  assert(
    (await http("POST", `/api/campaigns/${dupFirst.id}/activate`, { token: userA.token })).status ===
      200,
    "P0-11 first activate failed",
  );
  const secondActivate = await http("POST", `/api/campaigns/${dupSecond.id}/activate`, {
    token: userA.token,
  });
  assert(secondActivate.status === 409, `P0-11 expected 409 got ${secondActivate.status}`);
  assert(
    String(secondActivate.json.error ?? "").toLowerCase().includes("active campaign"),
    `P0-11 unexpected 409 body: ${JSON.stringify(secondActivate.json)}`,
  );
  const secondRow = await prisma.campaign.findUniqueOrThrow({ where: { id: dupSecond.id } });
  assert(secondRow.status === "DRAFT", "P0-11 second campaign left ACTIVE");
  console.log("[ok] P0-11 second ACTIVE on same keyword rule → 409");

  // --- P0-12 failed delivery then NEW comment same commenter ---
  const failRule = await createRule(userA.token, "L2FAIL", "fallback fail");
  const failCamp = await createCampaign(
    userA.token,
    campaignPayload(failRule, "L2 Fail Then New Comment", "L2E", { maxClaims: 3 }),
  );
  assert(
    (await http("POST", `/api/campaigns/${failCamp.id}/activate`, { token: userA.token })).status ===
      200,
    "fail campaign activate failed",
  );
  await http("POST", "/api/staging/meta-stub/configure", {
    body: { failCommentIds: ["l2-fail-c1"], clearCaptures: true },
  });
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-fail-c1",
    text: "L2FAIL",
    commenterId: "fail-then-new",
    commenterUsername: "fail_then_new",
  });
  const failedClaim = await prisma.campaignClaim.findFirst({
    where: { campaignId: failCamp.id, sourceCommentId: "l2-fail-c1" },
    include: { campaignCode: true },
  });
  assert(failedClaim?.deliveryStatus === "FAILED", `P0-12 first delivery ${failedClaim?.deliveryStatus}`);
  assert(failedClaim.campaignCode.status === "RESERVED", "P0-12 code should stay RESERVED");
  const reservedCode = failedClaim.campaignCode.code;
  const claimedAfterFail = (
    await prisma.campaign.findUniqueOrThrow({ where: { id: failCamp.id } })
  ).claimedCount;

  await http("POST", "/api/staging/meta-stub/configure", { body: { failCommentIds: [] } });
  await postComment({
    igUserId: IG_A,
    mediaId: MEDIA_A,
    commentId: "l2-fail-c2",
    text: "L2FAIL again",
    commenterId: "fail-then-new",
    commenterUsername: "fail_then_new",
  });
  const reminder = await captureFor("l2-fail-c2");
  assert(reminder?.messageText.includes(reservedCode), "P0-12 reminder missing original code");
  assert(
    (await prisma.campaignClaim.count({ where: { campaignId: failCamp.id } })) === 1,
    "P0-12 created a second claim",
  );
  assert(
    !(await prisma.campaignClaim.findFirst({
      where: { campaignId: failCamp.id, sourceCommentId: "l2-fail-c2" },
    })),
    "P0-12 second comment allocated a claim",
  );
  const originalAfter = await prisma.campaignClaim.findFirstOrThrow({
    where: { campaignId: failCamp.id, sourceCommentId: "l2-fail-c1" },
    include: { campaignCode: true },
  });
  assert(originalAfter.deliveryStatus === "FAILED", "P0-12 original claim mutated off FAILED");
  assert(originalAfter.campaignCode.status === "RESERVED", "P0-12 code left RESERVED");
  assert(originalAfter.campaignCode.status !== "AVAILABLE", "P0-12 code returned AVAILABLE");
  assert(
    (await prisma.campaign.findUniqueOrThrow({ where: { id: failCamp.id } })).claimedCount ===
      claimedAfterFail,
    "P0-12 claimedCount changed on reminder",
  );
  await assertCampaignInvariants(prisma, failCamp.id, "P0-12");
  console.log("[ok] P0-12 failed then new comment → already-claimed, no second allocation");

  // --- P0-13 product APIs unused codes + claims auth (also covered earlier) ---
  const unused = (
    await prisma.campaignCode.findMany({
      where: { campaignId: resizeCamp.id, status: "AVAILABLE" },
    })
  ).map((row) => row.code);
  await assertNoUnusedCodesInProductJson(userA.token, resizeCamp.id, unused, "P0-13");
  const ownerClaims = await http("GET", `/api/campaigns/${resizeCamp.id}/claims`, {
    token: userA.token,
  });
  assert(ownerClaims.status === 200, "P0-13 owner claims");
  const claimedCode = resizeClaim?.campaignCode.code;
  if (claimedCode) {
    assert(
      JSON.stringify(ownerClaims.json).includes(claimedCode),
      "P0-13 owner claims missing allocated code",
    );
  }
  const otherClaims = await http("GET", `/api/campaigns/${resizeCamp.id}/claims`, {
    token: userB.token,
  });
  assert(otherClaims.status === 404, `P0-13 other-user claims expected 404 got ${otherClaims.status}`);
  const anonClaims = await http("GET", `/api/campaigns/${resizeCamp.id}/claims`);
  assert(anonClaims.status === 401 || anonClaims.status === 403, "P0-13 claims must require auth");
  console.log("[ok] P0-13 unused codes hidden; claims authenticated");

  // --- P0-14 invariants across all tracked campaigns ---
  for (const campaignId of trackedCampaignIds) {
    await assertCampaignInvariants(prisma, campaignId, `P0-14 ${campaignId}`);
  }
  console.log("[ok] P0-14 database invariants");

  const healthLeak = JSON.stringify(health.json);
  assert(!healthLeak.toLowerCase().includes("postgresql://"), "health leaked DB url");
  const capturesBody = JSON.stringify((await http("GET", "/api/staging/meta-stub/captures")).json);
  assert(!capturesBody.includes("staging-stub-token"), "captures leaked token");
  assert(!capturesBody.includes("Bearer "), "captures leaked bearer");
  assert(!capturesBody.toLowerCase().includes(requireStagingStubSecret().toLowerCase()), "captures leaked stub secret");

  await prisma.$disconnect();
  console.log("=== Level 2 E2E PASSED ===");
  console.log(
    JSON.stringify(
      {
        hmacAlgo: "sha256",
        scenarios: 14,
        trackedCampaigns: trackedCampaignIds.length,
        note: "no secrets printed",
      },
      null,
      2,
    ),
  );
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
