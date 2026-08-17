/**
 * Shared helpers for Comment2DM V2 staging Level 1 / Level 2 E2E harnesses.
 * Never prints secrets, access tokens, or unused campaign codes.
 */
import { computeMetaWebhookSignature } from "../src/utils/metaWebhookSignature";
import { STAGING_STUB_KEY_HEADER } from "../src/middleware/stagingStubAuth";

export { STAGING_STUB_KEY_HEADER };

export type Json = Record<string, unknown>;

export type StagingHttpResult = { status: number; json: Json };

export function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

export function rejectProductionUrl(label: string, value: string): void {
  const lower = value.toLowerCase();
  if (lower.includes("insta-autodm-production")) {
    fail(`${label} points at production identifier — aborting`);
  }
}

export function requireStagingStubSecret(): string {
  const secret = process.env.STAGING_META_STUB_SECRET?.trim() ?? "";
  if (secret.length < 16) {
    fail("STAGING_META_STUB_SECRET must match staging backend (min 16 chars)");
  }
  return secret;
}

export async function stagingHttp(
  api: string,
  method: string,
  path: string,
  options: {
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
    stubSecret?: string;
    omitStubAuth?: boolean;
  } = {},
): Promise<StagingHttpResult> {
  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const isStubPath = path.startsWith("/api/staging/meta-stub");
  if (isStubPath && options.omitStubAuth !== true) {
    const secret = options.stubSecret ?? requireStagingStubSecret();
    headers[STAGING_STUB_KEY_HEADER] = secret;
  }

  const res = await fetch(`${api}${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

export function buildCommentWebhookPayload(params: {
  igUserId: string;
  mediaId: string;
  commentId: string;
  text: string;
  commenterId?: string | null;
  commenterUsername?: string;
}): Buffer {
  const from: Record<string, string> = {};
  if (params.commenterId) from.id = params.commenterId;
  if (params.commenterUsername) from.username = params.commenterUsername;

  const payload = {
    object: "instagram",
    entry: [
      {
        id: params.igUserId,
        time: Date.now(),
        changes: [
          {
            field: "comments",
            value: {
              id: params.commentId,
              text: params.text,
              media: { id: params.mediaId },
              from: Object.keys(from).length ? from : undefined,
            },
          },
        ],
      },
    ],
  };
  return Buffer.from(JSON.stringify(payload), "utf8");
}

export async function postInstagramWebhook(
  api: string,
  appSecret: string,
  raw: Buffer,
  options: { signature?: string | null } = {},
): Promise<StagingHttpResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.signature !== null) {
    headers["X-Hub-Signature-256"] =
      options.signature ?? `sha256=${computeMetaWebhookSignature(raw, appSecret)}`;
  }

  const res = await fetch(`${api}/api/webhooks/instagram`, {
    method: "POST",
    headers,
    body: new Uint8Array(raw),
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

export function jsonContainsAnyCode(payload: unknown, codes: string[]): string | null {
  const serialized = JSON.stringify(payload);
  for (const code of codes) {
    if (code && serialized.includes(code)) return code;
  }
  return null;
}
