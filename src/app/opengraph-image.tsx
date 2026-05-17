// Default Open Graph image for the root URL. Next.js auto-serves this at
// /opengraph-image and injects <meta property="og:image"> in the root layout.
// Renders dynamically via Edge — keeps the binary out of public/ and lets us
// theme it from the project palette.

import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "edge";
export const alt = "AlphaLog — Trading Intelligence Platform";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0a0e1a 0%, #0f172a 50%, #1e293b 100%)",
          color: "#e2e8f0",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Top bar with brand accent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "14px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              fontWeight: 800,
              color: "#0a0e1a",
            }}
          >
            ⚡
          </div>
          <div
            style={{
              fontSize: "20px",
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "#22d3ee",
              fontWeight: 700,
            }}
          >
            AlphaLog
          </div>
        </div>

        {/* Main headline */}
        <div
          style={{
            fontSize: "84px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: "#f8fafc",
            marginBottom: "20px",
          }}
        >
          Trading Intelligence
        </div>
        <div
          style={{
            fontSize: "84px",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            background: "linear-gradient(90deg, #22d3ee 0%, #a78bfa 100%)",
            backgroundClip: "text",
            color: "transparent",
            marginBottom: "32px",
          }}
        >
          Platform
        </div>

        {/* Subhead */}
        <div
          style={{
            fontSize: "26px",
            color: "#94a3b8",
            lineHeight: 1.4,
            maxWidth: "900px",
          }}
        >
          Bot MT5 · Terminal de análisis · TradeHub · Treasury · CyberSec Academy
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "60px",
            left: "80px",
            right: "80px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "18px",
            color: "#475569",
          }}
        >
          <span>alphalog.io</span>
          <span style={{ color: "#22d3ee" }}>v2.0</span>
        </div>
      </div>
    ),
    size,
  );
}
