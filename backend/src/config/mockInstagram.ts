/**
 * Mock/demo Instagram connect is a local + staging convenience only.
 * Production must never create a fake connected account.
 *
 * Allowed:
 * - NODE_ENV=development | test (and unset)
 * - COMMENT2DM_DEPLOYMENT_ENV=staging (hosted staging, even if NODE_ENV=production)
 *
 * Refused:
 * - COMMENT2DM_DEPLOYMENT_ENV=production
 * - NODE_ENV=production unless deployment env is exactly staging
 */
export function isMockInstagramConnectAllowed(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  deploymentEnv: string | undefined = process.env.COMMENT2DM_DEPLOYMENT_ENV,
): boolean {
  const deploy = (deploymentEnv ?? "").trim().toLowerCase();
  if (deploy === "production") {
    return false;
  }
  if (nodeEnv === "production" && deploy !== "staging") {
    return false;
  }
  return true;
}

export const MOCK_INSTAGRAM_PRODUCTION_REFUSED =
  "Demo Instagram connect is not available in production. Connect a real Instagram Professional account with Meta OAuth.";
