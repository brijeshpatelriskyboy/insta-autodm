/**
 * "Connect (Demo)" is a local/dev convenience. Production Next.js builds
 * never offer it. Hosted staging also builds with NODE_ENV=production, so
 * the button stays hidden there; use real Meta OAuth on hosted environments.
 */
export function shouldOfferMockInstagramConnect(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== "production";
}
