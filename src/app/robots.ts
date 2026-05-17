import type { MetadataRoute } from "next";

// AlphaLog is single-user; disallow indexing of everything behind auth.
// Public pages are explicitly allowed so social previews still work.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/auth", "/auth/signup", "/auth/reset", "/health"],
        disallow: [
          "/dashboard",
          "/business",
          "/intelligence",
          "/inbox",
          "/securities",
          "/map-hot",
          "/api",
        ],
      },
    ],
    sitemap: "https://alphalog.io/sitemap.xml",
  };
}
