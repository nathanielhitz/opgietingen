import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/*
  Merch-loader (fase 1): leest eigen producten uit content/merch/<slug>.mdx.
  Bewust standalone (geen react-cache of @-alias) zodat node:test dit bestand
  rechtstreeks kan laden; het gaat om een handvol reads per build.
*/

const MERCH_DIR = path.join(process.cwd(), "content", "merch");

export type MerchStatus = "binnenkort" | "leverbaar" | "uitverkocht";

const MERCH_STATUSSEN: readonly MerchStatus[] = ["binnenkort", "leverbaar", "uitverkocht"];

export interface MerchProduct {
  slug: string;
  naam: string;
  /** Verkoopprijs in euro's, incl. BTW. */
  prijs: number;
  /** 0 = verzending inbegrepen. */
  verzendkosten: number;
  afbeeldingen: string[];
  /** Mollie-betaallink; pas gevuld zodra het product leverbaar is. */
  betaalUrl?: string;
  productStatus: MerchStatus;
  bijgewerkt?: string;
  /** Rauwe MDX-body (productverhaal). */
  body: string;
}

/** YAML parseert kale datums als Date-objecten; wij willen ISO-strings. */
function toISODate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function parseMerchProduct(
  data: Record<string, unknown>,
  body: string,
  fallbackSlug: string,
): MerchProduct | null {
  const naam = data.naam as string | undefined;
  const prijs = Number(data.prijs);
  // Zonder naam of geldige prijs is een product niet toonbaar.
  if (!naam || !Number.isFinite(prijs) || prijs <= 0) return null;

  const verzendkosten = Number(data.verzendkosten);
  const status = data.productStatus;

  return {
    slug: (data.slug as string) ?? fallbackSlug,
    naam,
    prijs,
    verzendkosten: Number.isFinite(verzendkosten) && verzendkosten > 0 ? verzendkosten : 0,
    afbeeldingen: Array.isArray(data.afbeeldingen)
      ? data.afbeeldingen.filter((a): a is string => typeof a === "string" && a !== "")
      : [],
    betaalUrl: (data.betaalUrl as string) || undefined,
    // Onbekende/ontbrekende status -> veiligste stand (geen bestelknop).
    productStatus:
      typeof status === "string" && MERCH_STATUSSEN.includes(status as MerchStatus)
        ? (status as MerchStatus)
        : "binnenkort",
    bijgewerkt: toISODate(data.bijgewerkt),
    body,
  };
}

/** Alleen leverbaar met betaallink is echt te bestellen. */
export function isBestelbaar(product: MerchProduct): boolean {
  return product.productStatus === "leverbaar" && Boolean(product.betaalUrl);
}

/** Bedrag als "€ 34,95" (nl-NL, met vaste spatie). */
export function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(bedrag);
}

export function getMerchProduct(slug: string): MerchProduct | undefined {
  // Slug komt ook uit de URL (redirect-route): alleen veilige tekens toestaan.
  if (!/^[a-z0-9-]+$/.test(slug)) return undefined;
  const file = path.join(MERCH_DIR, `${slug}.mdx`);
  if (!fs.existsSync(file)) return undefined;
  const { data, content } = matter(fs.readFileSync(file, "utf-8"));
  return parseMerchProduct(data as Record<string, unknown>, content.trim(), slug) ?? undefined;
}
