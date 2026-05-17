import type { MetadataRoute } from "next";

// Sitemap of the few public routes — the rest of the app is auth-walled and
// shouldn't appear in search engines.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://alphalog.io";
  const now = new Date();

  return [
    { url: `${base}/`,             lastModified: now, changeFrequency: "monthly", priority: 1.0 },
    { url: `${base}/auth`,         lastModified: now, changeFrequency: "yearly",  priority: 0.8 },
    { url: `${base}/auth/signup`,  lastModified: now, changeFrequency: "yearly",  priority: 0.7 },
    { url: `${base}/auth/reset`,   lastModified: now, changeFrequency: "yearly",  priority: 0.5 },
    { url: `${base}/health`,       lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
