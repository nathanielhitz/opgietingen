import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

/*
  Default OG-image (1200×630) voor alle pagina's zonder eigen variant.
  Event- en saunapagina's hebben een eigen opengraph-image.tsx met titel/datum.
*/

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${site.name}: ${site.tagline}`;

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(135deg, #3a2718 0%, #6d4a2f 100%)",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 64 64" style={{ marginBottom: 40 }}>
          <g fill="none" stroke="#e0955f" strokeWidth="4.5" strokeLinecap="round">
            <path d="M21 16c0 5-5 6.5-5 11.5S21 34 21 39" />
            <path d="M33 13c0 5.5-5.5 7.5-5.5 13S33 33.5 33 39.5" />
            <path d="M45 16c0 5-5 6.5-5 11.5S45 34 45 39" />
          </g>
          <path d="M14 47h36" stroke="#e0955f" strokeWidth="4.5" strokeLinecap="round" />
        </svg>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#f7f2ea" }}>
          Opgietingen<span style={{ color: "#e0955f" }}>.nl</span>
        </div>
        <div style={{ display: "flex", marginTop: 24, fontSize: 34, color: "#f7f2eacc", maxWidth: 900 }}>
          {site.tagline}
        </div>
      </div>
    ),
    size,
  );
}
