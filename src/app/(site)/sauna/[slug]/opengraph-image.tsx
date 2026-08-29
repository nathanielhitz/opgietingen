import { ImageResponse } from "next/og";
import { getSaunaBySlug } from "@/lib/content";
import { COUNTRY_LABELS } from "@/lib/site";

/*
  Dynamische OG-image per sauna (SEO-PLAN fase 2): naam en plaats op
  merk-achtergrond voor herkenbare shares.
*/

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function SaunaOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sauna = getSaunaBySlug(slug);
  const naam = sauna?.naam ?? "Sauna";
  const sub = sauna ? `${sauna.plaats}, ${sauna.provincie} · ${COUNTRY_LABELS[sauna.land]}` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: 72,
          background: "linear-gradient(135deg, #3a2718 0%, #6d4a2f 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "10px 24px",
            borderRadius: 999,
            background: "#c1592a",
            color: "#f7f2ea",
            fontSize: 26,
            marginBottom: 28,
          }}
        >
          Opgietingen &amp; Aufguss
        </div>
        <div
          style={{
            display: "flex",
            fontSize: naam.length > 30 ? 56 : 68,
            fontWeight: 700,
            color: "#f7f2ea",
            lineHeight: 1.15,
            maxWidth: 1000,
          }}
        >
          {naam}
        </div>
        {sub && (
          <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "#e0955f" }}>{sub}</div>
        )}
        <div style={{ display: "flex", marginTop: 40, fontSize: 26, color: "#f7f2ea99" }}>
          Opgietingen.nl · Dé agenda voor opgiet-evenementen
        </div>
      </div>
    ),
    size,
  );
}
