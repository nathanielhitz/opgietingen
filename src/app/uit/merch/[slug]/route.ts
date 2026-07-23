import { NextResponse, type NextRequest } from "next/server";
import { getMerchProduct, isBestelbaar } from "@/lib/merch";
import { logClick } from "@/lib/clicks";

/*
  Redirect voor eigen merch (bv. de saunahoed) naar de Mollie-betaallink, met
  klik-logging. Zelfde principe als /uit/product/[id], maar zonder affiliate-
  wrapping: de betaalUrl uit de frontmatter is de bestemming. Onbekende of
  niet-bestelbare producten gaan terug naar de productpagina, zodat een klik
  nooit op een kapotte checkout eindigt.
*/

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getMerchProduct(slug);

  if (!product || !isBestelbaar(product) || !product.betaalUrl) {
    return NextResponse.redirect(new URL("/saunahoed", req.nextUrl.origin), 302);
  }

  logClick({
    slug,
    kind: "merch",
    destination: product.betaalUrl,
    referer: req.headers.get("referer") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  return NextResponse.redirect(product.betaalUrl, 302);
}
