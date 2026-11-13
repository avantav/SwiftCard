import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/marketing/agent-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return PUBLIC_PAGES.map((page) => ({
    url: `${origin}${page.path === "/" ? "" : page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority
  }));
}
