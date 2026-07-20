import { NextResponse, type NextRequest } from "next/server";
import { getProductById } from "@/lib/content";
import { logClick } from "@/lib/clicks";

/*
  Affiliate-redirect voor bol.com-producten uit gidsartikelen, met klik-tracking.
  Analoog aan /uit/[slug] voor events/sauna's, maar op een eigen sub-pad zodat
  product-ids nooit botsen met event-/sauna-slugs. Bij een bol.com-bestemming
  hangen we een subid (de gids-slug) aan, zodat je in de bol-statistieken ziet
  welke gids de klik opleverde. Onbekend id -> terug naar het gidsoverzicht.

  Een `bolUrl` in de content mag twee vormen hebben:
  - een kant-en-klare partner-deeplink (partner.bol.com/click/...) -> ongemoeid;
  - een gewone bol.com-productlink -> wordt hier in het partner-clickformat
    gewikkeld met het site-ID, zodat de commissie aan ons gekoppeld wordt.
  Zo blijft de content leesbaar en staat het site-ID op één centrale plek.
*/

/** bol.com partner site-ID (staat sowieso in elke publieke link; env overschrijft). */
const BOL_SITE_ID = process.env.BOL_SITE_ID ?? "1533193";

function toBolAffiliateUrl(bolUrl: string): string {
  // Al een partner-deeplink? Niet dubbel inpakken.
  if (bolUrl.includes("partner.bol.com")) return bolUrl;
  try {
    const parsed = new URL(bolUrl);
    // Alleen echte bol.com-productlinks inpakken; overige URL's ongemoeid laten.
    if (!/(^|\.)bol\.com$/.test(parsed.hostname)) return bolUrl;
    const click = new URL("https://partner.bol.com/click/click");
    click.searchParams.set("p", "2");
    click.searchParams.set("t", "url");
    click.searchParams.set("s", BOL_SITE_ID);
    click.searchParams.set("f", "TXL");
    click.searchParams.set("url", bolUrl);
    return click.toString();
  } catch {
    return bolUrl;
  }
}

function withSubId(url: string, subId: string): string {
  try {
    const parsed = new URL(url);
    if (/(^|\.)bol\.com$/.test(parsed.hostname) && !parsed.searchParams.has("subid")) {
      parsed.searchParams.set("subid", subId);
      return parsed.toString();
    }
    return url;
  } catch {
    // Ongeldige URL: laat de redirect het afhandelen (best-effort).
    return url;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = getProductById(id);

  if (!match) {
    return NextResponse.redirect(new URL("/gids", req.nextUrl.origin), 302);
  }

  const destination = withSubId(toBolAffiliateUrl(match.product.bolUrl), `gids-${match.gidsSlug}`);

  logClick({
    slug: id,
    kind: "product",
    destination,
    referer: req.headers.get("referer") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.redirect(destination, 302);
}
