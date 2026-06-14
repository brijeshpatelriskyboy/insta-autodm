import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/marketing-data";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/login", "/keyword-rules"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
