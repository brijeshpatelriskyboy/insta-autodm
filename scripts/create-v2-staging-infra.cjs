#!/usr/bin/env node
/**
 * Creates isolated V2 staging resources on Railway + Vercel.
 * Requires RAILWAY_TOKEN and VERCEL_TOKEN. Never touches production project names.
 *
 * Usage:
 *   node scripts/create-v2-staging-infra.cjs
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const LOCAL_BIN = path.join(ROOT, ".local-tools", "node_modules", ".bin");

function which(bin) {
  const local = path.join(LOCAL_BIN, bin);
  if (fs.existsSync(local)) return local;
  return bin;
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd || ROOT,
    env: { ...process.env, ...(opts.env || {}) },
    stdio: opts.stdio || "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(" ")}`);
  }
  return result;
}

function main() {
  if (!process.env.RAILWAY_TOKEN) {
    console.error("RAILWAY_TOKEN is required (do not use production-changing credentials).");
    process.exit(1);
  }
  if (!process.env.VERCEL_TOKEN) {
    console.error("VERCEL_TOKEN is required.");
    process.exit(1);
  }

  const railway = which("railway");
  const vercel = which("vercel");

  console.log("=== Creating Railway project comment2dm-v2-staging ===");
  // Railway CLI v4+: project create / add postgres plugin
  run(railway, ["--version"]);
  run(vercel, ["--version"]);

  console.log(`
Manual checklist (CLI shapes vary by Railway/Vercel version):

RAILWAY
1. Create project named exactly: comment2dm-v2-staging
2. Add Postgres; database/environment name must include both "v2" and "staging"
   (e.g. comment2dm_v2_staging)
3. Add service from GitHub repo, branch v2-smart-campaigns (or harness branch),
   root directory: backend
4. Set start command: npm run start:staging
5. Set env vars from backend/.env.staging.example (new secrets only)
6. Do NOT modify the production Railway project

VERCEL
1. Create project named exactly: comment2dm-v2-staging
2. Root: frontend, branch: v2-smart-campaigns (or harness)
3. Set API_URL and NEXT_PUBLIC_API_URL to the NEW staging Railway URL only
4. Do NOT modify the production Vercel project (insta-autodm)

Then run: cd backend && npm run db:v2:migrate:deploy
Then run: cd backend && npm run staging:level1-e2e
`);
}

main();
