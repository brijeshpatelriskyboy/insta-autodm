export function getSiteUrl(): string {
  // Prefer env in production. Fallback keeps OG/canonical URLs on the live Vercel host.
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://insta-autodm-three.vercel.app";
}
