#!/usr/bin/env node
/**
 * Probe Meta Graph for a Facebook Page ID linked to the stored Instagram account.
 * Prints exact response bodies (tokens redacted). Safe to run via:
 *   railway run node scripts/probe-instagram-page-id.cjs
 */
"use strict";

const path = require("path");
const crypto = require("crypto");

try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  // optional
}

const { PrismaClient } = require("@prisma/client");

const TARGET_IG_USER_ID = process.argv[2] || "17841463495771314";
const VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v21.0";
const version = VERSION.startsWith("v") ? VERSION : `v${VERSION}`;

function getEncryptionKey() {
  return crypto.createHash("sha256").update(process.env.JWT_SECRET || "").digest();
}

function decryptToken(payload) {
  const parts = payload.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function redactToken(url) {
  return url.replace(/access_token=[^&]+/g, "access_token=REDACTED");
}

async function graphGet(url) {
  const response = await fetch(url, { method: "GET" });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return {
    ok: response.ok,
    status: response.status,
    url: redactToken(url),
    body: json,
  };
}

async function main() {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET missing — cannot decrypt stored Instagram token");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing");
  }

  const prisma = new PrismaClient();
  const account = await prisma.instagramAccount.findFirst({
    where: { instagramUserId: TARGET_IG_USER_ID },
  });

  console.log(
    JSON.stringify(
      {
        step: "db_account",
        found: Boolean(account),
        instagramUserId: account?.instagramUserId ?? null,
        username: account?.username ?? null,
        storedPageId: account?.pageId ?? null,
        connectionStatus: account?.connectionStatus ?? null,
        hasEncryptedToken: Boolean(
          account?.accessTokenEncrypted &&
            account.accessTokenEncrypted !== "mock_encrypted_token_placeholder",
        ),
      },
      null,
      2,
    ),
  );

  if (!account?.accessTokenEncrypted || account.accessTokenEncrypted === "mock_encrypted_token_placeholder") {
    await prisma.$disconnect();
    process.exit(account ? 2 : 1);
  }

  const accessToken = decryptToken(account.accessTokenEncrypted);
  const igUserId = account.instagramUserId;

  const probes = [
    // Official Instagram Login /me fields (documented).
    `https://graph.instagram.com/${version}/me?fields=user_id,username,name,account_type,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
    // Ask for any page-like fields on Instagram Login host (to capture exact Graph error/response).
    `https://graph.instagram.com/${version}/me?fields=user_id,username,id,page_id,facebook_page,connected_facebook_page&access_token=${encodeURIComponent(accessToken)}`,
    `https://graph.instagram.com/${version}/${encodeURIComponent(igUserId)}?fields=user_id,username,id&access_token=${encodeURIComponent(accessToken)}`,
    // Facebook Login path endpoints with the Instagram user token — exact error if unsupported.
    `https://graph.facebook.com/${version}/me/accounts?fields=id,name,instagram_business_account&access_token=${encodeURIComponent(accessToken)}`,
    `https://graph.facebook.com/${version}/${encodeURIComponent(igUserId)}?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`,
  ];

  const results = [];
  for (const url of probes) {
    // eslint-disable-next-line no-await-in-loop
    const result = await graphGet(url);
    results.push(result);
    console.log(JSON.stringify({ step: "graph_probe", ...result }, null, 2));
  }

  const pageIdsFound = [];
  for (const result of results) {
    const body = result.body;
    if (!body || typeof body !== "object") continue;
    if (typeof body.page_id === "string") pageIdsFound.push(body.page_id);
    if (typeof body.connected_facebook_page === "string") {
      pageIdsFound.push(body.connected_facebook_page);
    }
    if (body.connected_facebook_page && typeof body.connected_facebook_page.id === "string") {
      pageIdsFound.push(body.connected_facebook_page.id);
    }
    if (Array.isArray(body.data)) {
      for (const row of body.data) {
        if (row?.instagram_business_account?.id === igUserId && typeof row.id === "string") {
          pageIdsFound.push(row.id);
        }
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        step: "summary",
        pageIdsFound: [...new Set(pageIdsFound)],
        pageIdExists: pageIdsFound.length > 0,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      step: "fatal",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
