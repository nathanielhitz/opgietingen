import { NextResponse, type NextRequest } from "next/server";
import { getEventBySlug, getSaunaBySlug } from "@/lib/content";
import { logClick } from "@/lib/clicks";

/*
  Affiliate-redirect met klik-tracking. Zoekt eerst een event (ticketUrl),
  valt anders terug op een sauna (affiliateUrl). Zo werkt zowel /uit/<event>
  als /uit/<sauna>. Bij ontbreken: terug naar de agenda.
*/
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let destination: string | undefined;
  let kind: "event" | "sauna" | undefined;

  const event = getEventBySlug(slug);
  if (event?.ticketUrl) {
    destination = event.ticketUrl;
    kind = "event";
  } else {
    // Sauna-slug, of event zonder eigen ticketUrl -> val terug op de sauna.
    const sauna = getSaunaBySlug(slug) ?? event?.sauna;
    if (sauna?.affiliateUrl) {
      destination = sauna.affiliateUrl;
      kind = "sauna";
    }
  }

  if (!destination || !kind) {
    return NextResponse.redirect(new URL("/agenda", req.nextUrl.origin), 302);
  }

  logClick({
    slug,
    kind,
    destination,
    referer: req.headers.get("referer") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.redirect(destination, 302);
}
