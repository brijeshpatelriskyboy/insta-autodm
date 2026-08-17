import http from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STAGING_STUB_KEY_HEADER } from "../middleware/stagingStubAuth";
import { createApp } from "../app";

const ORIGINAL_ENV = {
  META_PRIVATE_REPLY_STUB: process.env.META_PRIVATE_REPLY_STUB,
  COMMENT2DM_DEPLOYMENT_ENV: process.env.COMMENT2DM_DEPLOYMENT_ENV,
  COMMENT2DM_ALLOW_META_STUB: process.env.COMMENT2DM_ALLOW_META_STUB,
  STAGING_META_STUB_SECRET: process.env.STAGING_META_STUB_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  DATABASE_URL: process.env.DATABASE_URL,
  RAILWAY_PUBLIC_DOMAIN: process.env.RAILWAY_PUBLIC_DOMAIN,
  RAILWAY_SERVICE_NAME: process.env.RAILWAY_SERVICE_NAME,
  RAILWAY_ENVIRONMENT_NAME: process.env.RAILWAY_ENVIRONMENT_NAME,
};

const STUB_SECRET = "staging-level2-stub-secret";

function restoreEnv(): void {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enableStub(): void {
  process.env.META_PRIVATE_REPLY_STUB = "true";
  process.env.COMMENT2DM_DEPLOYMENT_ENV = "staging";
  process.env.COMMENT2DM_ALLOW_META_STUB = "true";
  process.env.STAGING_META_STUB_SECRET = STUB_SECRET;
  process.env.FRONTEND_URL = "https://comment2dm-v2-staging.vercel.app";
  process.env.CORS_ORIGIN = "https://comment2dm-v2-staging.vercel.app";
  process.env.DATABASE_URL =
    "postgresql://u:p@magical.proxy.rlwy.net:5432/comment2dm_v2_staging";
  delete process.env.RAILWAY_PUBLIC_DOMAIN;
  delete process.env.RAILWAY_SERVICE_NAME;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe("staging meta-stub diagnostic routes", () => {
  beforeEach(() => {
    restoreEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("does not mount stub routes when flags are off", async () => {
    delete process.env.META_PRIVATE_REPLY_STUB;
    delete process.env.COMMENT2DM_ALLOW_META_STUB;
    delete process.env.COMMENT2DM_DEPLOYMENT_ENV;
    delete process.env.STAGING_META_STUB_SECRET;
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/staging/meta-stub/status`);
      expect(res.status).toBe(404);
    });
  });

  it("does not mount stub routes when a production identifier is present", async () => {
    enableStub();
    process.env.RAILWAY_PUBLIC_DOMAIN = "insta-autodm-production.up.railway.app";
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/staging/meta-stub/captures`, {
        headers: { [STAGING_STUB_KEY_HEADER]: STUB_SECRET },
      });
      expect(res.status).toBe(404);
    });
  });

  it("returns 503 when the stub is enabled but the diagnostic secret is missing", async () => {
    enableStub();
    delete process.env.STAGING_META_STUB_SECRET;
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/staging/meta-stub/status`);
      expect(res.status).toBe(503);
      const body = (await res.json()) as { error?: string };
      expect(JSON.stringify(body).toLowerCase()).not.toContain(STUB_SECRET.toLowerCase());
    });
  });

  it("rejects missing and wrong diagnostic keys with 401 and does not return captures", async () => {
    enableStub();
    await withServer(async (baseUrl) => {
      const unauth = await fetch(`${baseUrl}/api/staging/meta-stub/captures`);
      expect(unauth.status).toBe(401);
      const unauthBody = await unauth.json();
      expect(unauthBody).toEqual({ error: "Unauthorized" });
      expect(JSON.stringify(unauthBody)).not.toContain("captures");

      const wrong = await fetch(`${baseUrl}/api/staging/meta-stub/captures`, {
        headers: { [STAGING_STUB_KEY_HEADER]: "definitely-not-the-stub-secret" },
      });
      expect(wrong.status).toBe(401);
      expect(JSON.stringify(await wrong.json())).not.toContain("captures");
    });
  });

  it("allows status/captures/configure/reset with the matching diagnostic key", async () => {
    enableStub();
    await withServer(async (baseUrl) => {
      const headers = { [STAGING_STUB_KEY_HEADER]: STUB_SECRET };
      const status = await fetch(`${baseUrl}/api/staging/meta-stub/status`, { headers });
      expect(status.status).toBe(200);
      const statusJson = (await status.json()) as { stubActive?: boolean };
      expect(statusJson.stubActive).toBe(true);
      expect(JSON.stringify(statusJson).toLowerCase()).not.toContain(STUB_SECRET.toLowerCase());

      const reset = await fetch(`${baseUrl}/api/staging/meta-stub/reset`, {
        method: "POST",
        headers,
      });
      expect(reset.status).toBe(200);

      const captures = await fetch(`${baseUrl}/api/staging/meta-stub/captures`, { headers });
      expect(captures.status).toBe(200);
      const captureJson = (await captures.json()) as { captures?: unknown[] };
      expect(Array.isArray(captureJson.captures)).toBe(true);
      expect(JSON.stringify(captureJson)).not.toMatch(/Bearer |access_token/i);
    });
  });
});
