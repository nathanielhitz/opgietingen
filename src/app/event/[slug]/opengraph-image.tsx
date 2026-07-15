import { ImageResponse } from "next/og";
import { getEventBySlug } from "@/lib/content";
import { EVENT_TYPES } from "@/lib/site";
import { formatDateRange } from "@/lib/dates";

/*
  Dynamische OG-image per event (SEO-PLAN fase 2, PRD §5): titel, datum en
  sauna op merk-achtergrond, zodat shares op WhatsApp/socials context tonen.
*/

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function EventOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getEventBySlug(slug);
  const titel = event?.titel ?? "Opgieting";
  const sub = event
    ? `${formatDateRange(event.startDatum, event.eindDatum)} · ${event.sauna.naam}, ${event.sauna.plaats}`
    : "";

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
        {event && (
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
            {EVENT_TYPES[event.type]}
          </div>
        )}
        <div
          style={{
            display: "flex",
            fontSize: titel.length > 40 ? 54 : 66,
            fontWeight: 700,
            color: "#f7f2ea",
            lineHeight: 1.15,
            maxWidth: 1000,
          }}
        >
          {titel}
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
