/**
 * Staging-only Meta private-reply stub.
 *
 * Enablement requires ALL of:
 * - META_PRIVATE_REPLY_STUB=true
 * - COMMENT2DM_DEPLOYMENT_ENV=staging
 * - COMMENT2DM_ALLOW_META_STUB=true
 * - no known production identifiers in staging-sensitive env
 *
 * Impossible to enable accidentally against production Railway / production hosts.
 * Never logs or stores access tokens / secrets.
 */

import { randomBytes } from "crypto";
import { AppError } from "../utils/errors";
import {
  KNOWN_PRODUCTION_IDENTIFIERS,
  containsKnownProductionIdentifier,
  parseDatabaseUrl,
} from "../lib/dbSafety";

export type MetaPrivateReplyStubCapture = {
  commentId: string;
  messageText: string;
  simulatedMessageId: string;
  igUserId: string;
  capturedAt: string;
  /** true when this call simulated a Meta failure */
  simulatedFailure: boolean;
};

export type MetaPrivateReplyStubSendParams = {
  igUserId: string;
  accessToken: string;
  commentId: string;
  messageText: string;
  timeoutMs?: number;
};

type StubState = {
  captures: MetaPrivateReplyStubCapture[];
  failCommentIds: Set<string>;
  failNextCount: number;
};

const state: StubState = {
  captures: [],
  failCommentIds: new Set(),
  failNextCount: 0,
};

const MAX_CAPTURES = 5000;

function collectStagingIdentityHaystack(): string {
  const pieces: string[] = [
    process.env.COMMENT2DM_DEPLOYMENT_ENV ?? "",
    process.env.RAILWAY_PUBLIC_DOMAIN ?? "",
    process.env.RAILWAY_SERVICE_NAME ?? "",
    process.env.RAILWAY_ENVIRONMENT_NAME ?? "",
    process.env.FRONTEND_URL ?? "",
    process.env.CORS_ORIGIN ?? "",
  ];

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    try {
      const parts = parseDatabaseUrl(databaseUrl);
      pieces.push(parts.hostname, parts.database);
    } catch {
      pieces.push("unparseable-database-url");
    }
  }

  return pieces.join(" ").toLowerCase();
}

/**
 * Returns true only when the stub is explicitly and safely enabled for staging.
 * Throws if stub flags are set but production identifiers are present (fail closed).
 */
export function assertMetaPrivateReplyStubMayRun(): boolean {
  const stubFlag = process.env.META_PRIVATE_REPLY_STUB === "true";
  const deployEnv = process.env.COMMENT2DM_DEPLOYMENT_ENV === "staging";
  const allowFlag = process.env.COMMENT2DM_ALLOW_META_STUB === "true";

  if (!stubFlag && !allowFlag) {
    return false;
  }

  // Any stub-related flag without full staging enablement → refuse (do not fall through to real Meta).
  if (!stubFlag || !deployEnv || !allowFlag) {
    throw new Error(
      "Meta private-reply stub misconfigured: require META_PRIVATE_REPLY_STUB=true, " +
        "COMMENT2DM_DEPLOYMENT_ENV=staging, and COMMENT2DM_ALLOW_META_STUB=true together",
    );
  }

  const haystack = collectStagingIdentityHaystack();
  for (const id of KNOWN_PRODUCTION_IDENTIFIERS) {
    if (haystack.includes(id.toLowerCase())) {
      throw new Error(
        `Meta private-reply stub refused: known production identifier "${id}" present in staging identity`,
      );
    }
  }

  if (containsKnownProductionIdentifier(haystack)) {
    throw new Error(
      "Meta private-reply stub refused: known production identifier present in staging identity",
    );
  }

  return true;
}

export function isMetaPrivateReplyStubActive(): boolean {
  try {
    return assertMetaPrivateReplyStubMayRun();
  } catch {
    return false;
  }
}

function nextSimulatedMessageId(): string {
  return `stub_mid_${randomBytes(12).toString("hex")}`;
}

/**
 * Staging-only private reply. Never uses accessToken for network I/O.
 * accessToken is accepted for API compatibility and immediately discarded (never logged/stored).
 */
export function sendStubPrivateReply(
  params: MetaPrivateReplyStubSendParams,
): { recipientId: string | null; messageId: string } {
  assertMetaPrivateReplyStubMayRun();

  // Discard token reference — never capture secrets.
  void params.accessToken;

  const shouldFail =
    state.failCommentIds.has(params.commentId) || state.failNextCount > 0;

  if (state.failNextCount > 0) {
    state.failNextCount -= 1;
  }

  const simulatedMessageId = nextSimulatedMessageId();
  const capture: MetaPrivateReplyStubCapture = {
    commentId: params.commentId,
    messageText: params.messageText,
    simulatedMessageId,
    igUserId: params.igUserId,
    capturedAt: new Date().toISOString(),
    simulatedFailure: shouldFail,
  };

  state.captures.push(capture);
  if (state.captures.length > MAX_CAPTURES) {
    state.captures.splice(0, state.captures.length - MAX_CAPTURES);
  }

  console.log("[meta-stub] private reply", {
    commentId: params.commentId,
    igUserId: params.igUserId,
    messageLength: params.messageText.length,
    simulatedFailure: shouldFail,
    simulatedMessageIdPresent: true,
    // Never log message body in full if it could contain codes at high volume —
    // capture store holds it for authenticated staging diagnostics only.
  });

  if (shouldFail) {
    throw new AppError(
      502,
      "Simulated Meta private reply failure (staging stub)",
      1,
      "Simulated Meta private reply failure (staging stub)",
    );
  }

  return {
    recipientId: `stub_recipient_${params.igUserId}`,
    messageId: simulatedMessageId,
  };
}

export function getMetaPrivateReplyStubCaptures(): MetaPrivateReplyStubCapture[] {
  assertMetaPrivateReplyStubMayRun();
  return [...state.captures];
}

export function resetMetaPrivateReplyStub(): void {
  assertMetaPrivateReplyStubMayRun();
  state.captures = [];
  state.failCommentIds.clear();
  state.failNextCount = 0;
}

export function configureMetaPrivateReplyStub(options: {
  failCommentIds?: string[];
  failNextCount?: number;
  clearCaptures?: boolean;
}): void {
  assertMetaPrivateReplyStubMayRun();
  if (options.clearCaptures) {
    state.captures = [];
  }
  if (options.failCommentIds) {
    state.failCommentIds = new Set(options.failCommentIds);
  }
  if (typeof options.failNextCount === "number") {
    state.failNextCount = Math.max(0, Math.floor(options.failNextCount));
  }
}
