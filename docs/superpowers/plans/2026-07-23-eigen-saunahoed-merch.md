# Eigen saunahoed (merch) — implementatieplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Een eigen merch-product (de Opgietingen.nl-saunahoed) op de site: repo-based contenttype, productpagina `/saunahoed` met drie standen (`binnenkort`/`leverbaar`/`uitverkocht`), klik-gelogde redirect `/uit/merch/[slug]` naar een Mollie-betaallink, uitgelicht blok in de saunahoed-gids, navigatielinks, `Product` JSON-LD en sitemap-opname.

**Architectuur:** Zelfde repo-based patroon als events/gidsen: MDX + frontmatter in `content/merch/`, gelezen door een kleine standalone loader (`src/lib/merch.ts`, bewust zónder imports uit andere src-modules zodat `node:test` hem direct kan laden). De pagina gaat live in `binnenkort`-stand; omschakelen naar verkoop is later één frontmatter-wijziging (`productStatus` + `betaalUrl`). Spec: `docs/superpowers/specs/2026-07-23-eigen-saunahoed-merch-design.md`.

**Tech stack:** Next.js 15 App Router, React 19 server components, TypeScript strict, Tailwind v4 themetokens, gray-matter, `node:test` via tsx.

**Conventies (verplicht):** UI-teksten/comments/commits in het Nederlands. Geen em-streepjes (—) in zichtbare tekst. Kleuren via themetokens (`bg-ember`, `text-ink`, ...). Geen `new Date()` in SSG-paden. Verifieer met `npm run build` vóór elke commit.

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `src/lib/merch.ts` | Nieuw | Merch-loader: parsen + lezen van `content/merch/*.mdx`, `isBestelbaar`, `formatEuro` |
| `scripts/lib/merch.test.ts` | Nieuw | Unit-tests voor de loader (testglob is `scripts/**/*.test.ts`) |
| `content/merch/saunahoed.mdx` | Nieuw | Het product zelf (start in `binnenkort`-stand) |
| `src/lib/clicks.ts` | Wijzigen | `kind`-union uitbreiden met `"merch"` |
| `src/app/uit/merch/[slug]/route.ts` | Nieuw | Klik-gelogde redirect naar de Mollie-betaallink |
| `src/lib/schema.ts` | Wijzigen | `merchProductSchema` (Product JSON-LD) |
| `src/components/MerchBestelKnop.tsx` | Nieuw | Client-CTA met Vercel Analytics-event |
| `src/app/saunahoed/page.tsx` | Nieuw | Productpagina met de drie standen |
| `src/components/SiteHeader.tsx` | Wijzigen | Navigatielink |
| `src/components/SiteFooter.tsx` | Wijzigen | Footerlink |
| `src/app/sitemap.ts` | Wijzigen | `/saunahoed`-entry |
| `src/lib/content.ts` | Wijzigen | `Gids.eigenProduct?`-veld |
| `src/components/EigenProductCta.tsx` | Nieuw | Uitgelicht blok voor eigen product in gidsen |
| `src/app/gids/[slug]/page.tsx` | Wijzigen | Blok renderen bij `eigenProduct` |
| `content/gidsen/beste-saunahoed-2026.mdx` | Wijzigen | `eigenProduct: saunahoed` + intro-alinea |
| `content/gidsen/wat-neem-je-mee-naar-een-opgieting.mdx` | Wijzigen | Tekstlink naar `/saunahoed` |

---

### Task 1: Merch-loader + contentbestand (TDD)

**Files:**
- Create: `scripts/lib/merch.test.ts`
- Create: `src/lib/merch.ts`
- Create: `content/merch/saunahoed.mdx`

- [ ] **Step 1: Schrijf de failende tests**

Maak `scripts/lib/merch.test.ts`. Let op: `Intl` zet een vaste spatie (U+00A0) tussen `€` en het bedrag; schrijf die in de asserts als `\u00a0`-escape, nooit als gewone spatie.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMerchProduct,
  isBestelbaar,
  getMerchProduct,
  formatEuro,
  type MerchProduct,
} from "../../src/lib/merch";

const basis = {
  naam: "Testhoed",
  prijs: 34.95,
  verzendkosten: 0,
  afbeeldingen: ["/images/merch/testhoed.jpg"],
  betaalUrl: "https://payment-links.mollie.com/payment/test",
  productStatus: "leverbaar",
  bijgewerkt: "2026-07-23",
};

test("parseMerchProduct parseert volledige frontmatter", () => {
  const product = parseMerchProduct(basis, "Het verhaal.", "testhoed");
  assert.ok(product);
  assert.equal(product.slug, "testhoed");
  assert.equal(product.naam, "Testhoed");
  assert.equal(product.prijs, 34.95);
  assert.equal(product.verzendkosten, 0);
  assert.deepEqual(product.afbeeldingen, ["/images/merch/testhoed.jpg"]);
  assert.equal(product.productStatus, "leverbaar");
  assert.equal(product.bijgewerkt, "2026-07-23");
  assert.equal(product.body, "Het verhaal.");
});

test("parseMerchProduct valt terug op binnenkort bij onbekende of ontbrekende status", () => {
  const raar = parseMerchProduct({ ...basis, productStatus: "pre-order" }, "", "x");
  assert.equal(raar?.productStatus, "binnenkort");
  const leeg = parseMerchProduct({ ...basis, productStatus: undefined }, "", "x");
  assert.equal(leeg?.productStatus, "binnenkort");
});

test("parseMerchProduct keurt af zonder naam of geldige prijs", () => {
  assert.equal(parseMerchProduct({ ...basis, naam: undefined }, "", "x"), null);
  assert.equal(parseMerchProduct({ ...basis, prijs: "gratis" }, "", "x"), null);
  assert.equal(parseMerchProduct({ ...basis, prijs: 0 }, "", "x"), null);
});

test("parseMerchProduct normaliseert een YAML-Date naar een ISO-string", () => {
  const product = parseMerchProduct(
    { ...basis, bijgewerkt: new Date(Date.UTC(2026, 6, 23)) },
    "",
    "x",
  );
  assert.equal(product?.bijgewerkt, "2026-07-23");
});

test("isBestelbaar alleen bij leverbaar met betaallink", () => {
  const leverbaar = parseMerchProduct(basis, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(leverbaar), true);
  const binnenkort = parseMerchProduct({ ...basis, productStatus: "binnenkort" }, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(binnenkort), false);
  const zonderLink = parseMerchProduct({ ...basis, betaalUrl: undefined }, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(zonderLink), false);
  const uitverkocht = parseMerchProduct({ ...basis, productStatus: "uitverkocht" }, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(uitverkocht), false);
});

test("formatEuro formatteert nl-NL met vaste spatie", () => {
  assert.equal(formatEuro(34.95), "€\u00a034,95");
  assert.equal(formatEuro(5), "€\u00a05,00");
});

test("getMerchProduct leest het echte saunahoed-bestand", () => {
  const product = getMerchProduct("saunahoed");
  assert.ok(product, "verwacht content/merch/saunahoed.mdx");
  assert.equal(product.slug, "saunahoed");
  assert.ok(product.prijs > 0);
  assert.ok(product.body.length > 50, "productverhaal mag niet leeg zijn");
});

test("getMerchProduct geeft undefined voor onbekende of onveilige slug", () => {
  assert.equal(getMerchProduct("bestaat-niet"), undefined);
  assert.equal(getMerchProduct("../saunas/thermen-bussloo"), undefined);
});
```

- [ ] **Step 2: Draai de tests en zie ze falen**

Run: `npm test`
Verwacht: FAIL — `Cannot find module '../../src/lib/merch'` (de bestaande tests blijven groen).

- [ ] **Step 3: Schrijf het contentbestand**

Maak `content/merch/saunahoed.mdx` (prijs € 34,95 is een voorlopige placeholder; zie de eindnotitie in Task 7):

```mdx
---
slug: saunahoed
naam: De Opgietingen.nl saunahoed
prijs: 34.95
verzendkosten: 0
afbeeldingen: []
# Zodra KvK + Mollie geregeld zijn: hier de Mollie-betaallink invullen en
# productStatus op "leverbaar" zetten. Meer is er niet nodig.
# betaalUrl: https://payment-links.mollie.com/payment/...
productStatus: binnenkort
bijgewerkt: 2026-07-23
---

Wie vaak bij opgietingen zit, weet het: je hoofd krijgt de volle laag. Een
saunahoed van wolvilt isoleert je hoofdhuid en haar, zodat je de mooiste
sessies tot de laatste zwaai comfortabel uitzit.

Daarom maken we hem nu zelf. De Opgietingen.nl saunahoed is een klassiek model
van 100% wolvilt, one-size, met een subtiel geborduurd stoomwolkje en
opgietingen.nl op de rand. Gemaakt in een kleine oplage, geborduurd in
Nederland.

## Specificaties

- 100% wolvilt, stevig model dat zijn vorm houdt
- One-size (past vrijwel elk hoofd)
- Geborduurd logo, geen print
- Handwas koud, in vorm laten drogen

## Verzending

We versturen per brievenbuspakket binnen Nederland en Belgie. De verzendkosten
zitten bij de prijs in.
```

- [ ] **Step 4: Schrijf de loader**

Maak `src/lib/merch.ts`. Belangrijk: **geen imports uit andere src-modules** (geen `@/`-alias, geen react `cache`) — de tests draaien onder kale `node --import tsx` waar de alias en react-context niet beschikbaar zijn. Merch is één klein bestand per build; memoization is niet nodig.

```ts
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

const MERCH_STATUSSEN: readonly string[] = ["binnenkort", "leverbaar", "uitverkocht"];

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
    productStatus: MERCH_STATUSSEN.includes(status as string)
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
```

- [ ] **Step 5: Draai de tests en zie ze slagen**

Run: `npm test`
Verwacht: PASS, alle nieuwe merch-tests groen, bestaande tests onveranderd groen.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/merch.test.ts src/lib/merch.ts content/merch/saunahoed.mdx
git commit -m "feat(merch): merch-loader + saunahoed-content (binnenkort-stand)"
```

---

### Task 2: Klik-logging + redirect `/uit/merch/[slug]`

**Files:**
- Modify: `src/lib/clicks.ts:16`
- Create: `src/app/uit/merch/[slug]/route.ts`

- [ ] **Step 1: Breid het klik-type uit**

In `src/lib/clicks.ts`, wijzig in `ClickEntry`:

```ts
  kind: "event" | "sauna" | "product" | "merch";
```

- [ ] **Step 2: Maak de redirect-route**

Maak `src/app/uit/merch/[slug]/route.ts` (patroon van `src/app/uit/product/[id]/route.ts`; `robots.ts` disallow't `/uit/` al, dus ook dit pad):

```ts
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
```

- [ ] **Step 3: Verifieer handmatig**

Run: `npm run dev` en daarna in een tweede terminal:
`curl -sI http://localhost:3000/uit/merch/saunahoed | grep -i location`
Verwacht: `location: http://localhost:3000/saunahoed` (product staat op `binnenkort`, dus niet bestelbaar).
`curl -sI http://localhost:3000/uit/merch/bestaat-niet | grep -i location`
Verwacht: zelfde redirect naar `/saunahoed`. Stop de dev-server daarna.

- [ ] **Step 4: Commit**

```bash
git add src/lib/clicks.ts src/app/uit/merch
git commit -m "feat(merch): klik-gelogde redirect /uit/merch/[slug] naar betaallink"
```

---

### Task 3: `Product` JSON-LD in schema.ts

**Files:**
- Modify: `src/lib/schema.ts` (onderaan toevoegen + import bovenaan)

- [ ] **Step 1: Voeg de schema-functie toe**

Bovenaan `src/lib/schema.ts` de type-import toevoegen:

```ts
import type { MerchProduct, MerchStatus } from "@/lib/merch";
```

Onderaan het bestand toevoegen:

```ts
/** Availability-mapping voor eigen merch: de productStatus is de bron van waarheid. */
const MERCH_AVAILABILITY: Record<MerchStatus, string> = {
  binnenkort: "https://schema.org/PreOrder",
  leverbaar: "https://schema.org/InStock",
  uitverkocht: "https://schema.org/OutOfStock",
};

/** schema.org Product JSON-LD voor eigen merch (bv. /saunahoed). */
export function merchProductSchema(product: MerchProduct) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.naam,
    description: plainSummary(product.body, 300),
    ...(product.afbeeldingen.length > 0 ? { image: product.afbeeldingen.map(absoluteUrl) } : {}),
    url: absoluteUrl(`/${product.slug}`),
    brand: { "@type": "Brand", name: site.name },
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/${product.slug}`),
      price: product.prijs,
      priceCurrency: "EUR",
      availability: MERCH_AVAILABILITY[product.productStatus],
    },
  };
}
```

(`plainSummary`, `absoluteUrl` en `site` zijn al aanwezig in dit bestand.)

- [ ] **Step 2: Verifieer met de build**

Run: `npm run build`
Verwacht: build slaagt zonder type-fouten.

- [ ] **Step 3: Commit**

```bash
git add src/lib/schema.ts
git commit -m "feat(merch): Product JSON-LD met status-gestuurde availability"
```

---

### Task 4: Productpagina `/saunahoed`

**Files:**
- Create: `src/components/MerchBestelKnop.tsx`
- Create: `src/app/saunahoed/page.tsx`

- [ ] **Step 1: Maak de bestelknop (client component)**

Maak `src/components/MerchBestelKnop.tsx`. Geen `rel="sponsored"`: dit is een eigen product, geen affiliate-relatie.

```tsx
"use client";

import { track } from "@vercel/analytics";

/*
  Bestelknop voor eigen merch. Linkt via /uit/merch/<slug> zodat de klik
  serverside gelogd wordt (zelfde principe als AffiliateButton), plus een
  Vercel Analytics-event. Geen rel="sponsored": eigen product.
*/
export function MerchBestelKnop({ slug, label }: { slug: string; label: string }) {
  return (
    <a
      href={`/uit/merch/${slug}`}
      onClick={() => track("uit-merch-klik", { slug })}
      className="inline-flex items-center justify-center gap-2 rounded-full bg-ember px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ember/90"
    >
      {label}
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
  );
}
```

- [ ] **Step 2: Maak de pagina**

Maak `src/app/saunahoed/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMerchProduct, isBestelbaar, formatEuro } from "@/lib/merch";
import { formatDate } from "@/lib/dates";
import { plainSummary } from "@/lib/text";
import { merchProductSchema, absoluteUrl } from "@/lib/schema";
import { JsonLd } from "@/components/JsonLd";
import { CoverImage } from "@/components/CoverImage";
import { Mdx } from "@/components/Mdx";
import { Breadcrumb } from "@/components/Breadcrumb";
import { MerchBestelKnop } from "@/components/MerchBestelKnop";

export const revalidate = 3600;

const SLUG = "saunahoed";

export function generateMetadata(): Metadata {
  const product = getMerchProduct(SLUG);
  if (!product) return {};
  const description = plainSummary(product.body);
  return {
    title: `${product.naam} kopen`,
    description,
    alternates: { canonical: `/${SLUG}` },
    openGraph: {
      type: "website",
      title: product.naam,
      description,
      url: absoluteUrl(`/${SLUG}`),
      ...(product.afbeeldingen[0]
        ? { images: [{ url: absoluteUrl(product.afbeeldingen[0]) }] }
        : {}),
    },
  };
}

export default function SaunahoedPage() {
  const product = getMerchProduct(SLUG);
  if (!product) notFound();

  const bestelbaar = isBestelbaar(product);

  return (
    <article className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd data={merchProductSchema(product)} />

      <Breadcrumb items={[{ label: product.naam }]} />

      <header className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-ember">Eigen product</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-4xl">
          {product.naam}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">
          <span className="font-semibold text-ink">{formatEuro(product.prijs)}</span>
          {product.verzendkosten === 0
            ? " incl. verzending (NL & BE)"
            : ` + ${formatEuro(product.verzendkosten)} verzendkosten`}
        </p>
        {product.bijgewerkt && (
          <p className="mt-2 text-xs text-ink-faint">Bijgewerkt op {formatDate(product.bijgewerkt)}</p>
        )}
      </header>

      {product.afbeeldingen[0] && (
        <div className="relative mt-5 overflow-hidden rounded-[--radius-card]">
          <CoverImage
            src={product.afbeeldingen[0]}
            alt={product.naam}
            className="aspect-[16/9] sm:aspect-[2/1]"
            sizes="(max-width: 896px) 100vw, 896px"
          />
        </div>
      )}

      <div className="mt-6">
        {bestelbaar ? (
          <MerchBestelKnop slug={product.slug} label={`Bestel voor ${formatEuro(product.prijs)}`} />
        ) : product.productStatus === "uitverkocht" ? (
          <div className="rounded-[--radius-card] border border-sand bg-surface p-5">
            <p className="font-semibold text-ink">Tijdelijk uitverkocht</p>
            <p className="mt-1 text-sm text-ink-soft">
              We laten een nieuwe oplage maken. Wil je bericht zodra de hoed er weer is?{" "}
              <a
                href="mailto:info@opgietingen.nl?subject=Saunahoed weer leverbaar"
                className="font-medium text-ember hover:underline"
              >
                Stuur ons een mailtje
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="rounded-[--radius-card] border border-sand bg-surface p-5">
            <p className="font-semibold text-ink">Binnenkort beschikbaar</p>
            <p className="mt-1 text-sm text-ink-soft">
              De eerste oplage wordt nu gemaakt. Wil je bericht bij de lancering?{" "}
              <a
                href="mailto:info@opgietingen.nl?subject=Houd mij op de hoogte van de saunahoed"
                className="font-medium text-ember hover:underline"
              >
                Stuur ons een mailtje
              </a>
              .
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 min-w-0">
        <Mdx source={product.body} />
      </div>

      {product.afbeeldingen.length > 1 && (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {product.afbeeldingen.slice(1).map((src) => (
            <div key={src} className="relative overflow-hidden rounded-[--radius-card]">
              <CoverImage
                src={src}
                alt={product.naam}
                className="aspect-[4/3]"
                sizes="(max-width: 640px) 100vw, 440px"
              />
            </div>
          ))}
        </div>
      )}

      <nav aria-label="Meer op Opgietingen.nl" className="mt-10 flex flex-wrap gap-2 text-sm font-medium">
        <Link
          href="/gids/beste-saunahoed-2026"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Saunahoeden vergelijken
        </Link>
        <Link
          href="/agenda"
          className="rounded-full border border-sand bg-surface px-4 py-2 text-ink-soft transition-colors hover:border-ember hover:text-ember"
        >
          Bekijk de agenda
        </Link>
      </nav>
    </article>
  );
}
```

- [ ] **Step 3: Verifieer in de dev-server**

Run: `npm run dev`, open `http://localhost:3000/saunahoed`.
Verwacht: pagina rendert met "Eigen product"-label, prijs, het "Binnenkort beschikbaar"-blok (geen bestelknop) en het productverhaal. Test daarna de andere standen door in `content/merch/saunahoed.mdx` tijdelijk `productStatus: uitverkocht` en daarna `productStatus: leverbaar` + `betaalUrl: https://example.com/test` te zetten (uitverkocht-melding resp. bestelknop zichtbaar). **Zet de frontmatter terug naar `productStatus: binnenkort` zonder actieve betaalUrl.**

- [ ] **Step 4: Commit**

```bash
git add src/components/MerchBestelKnop.tsx src/app/saunahoed
git commit -m "feat(merch): productpagina /saunahoed met binnenkort/leverbaar/uitverkocht"
```

---

### Task 5: Navigatie + sitemap

**Files:**
- Modify: `src/components/SiteHeader.tsx:7-14`
- Modify: `src/components/SiteFooter.tsx:23-31`
- Modify: `src/app/sitemap.ts:23-39`

- [ ] **Step 1: Headerlink**

In `src/components/SiteHeader.tsx`, voeg in `navItems` een item toe na de Gids-regel:

```ts
const navItems = [
  { href: "/agenda", label: "Agenda" },
  { href: "/saunas", label: "Sauna's" },
  { href: "/gids", label: "Gids" },
  { href: "/saunahoed", label: "Saunahoed" },
  { href: "/wat-is-een-opgieting", label: "Wat is een opgieting?" },
  { href: "/over", label: "Over" },
  { href: "/voor-saunas", label: "Voor sauna's" },
];
```

- [ ] **Step 2: Footerlink**

In `src/components/SiteFooter.tsx`, voeg in de kolom "Ontdekken" een regel toe na de Saunagids-link:

```tsx
          <FooterLink href="/gids">Saunagids</FooterLink>
          <FooterLink href="/saunahoed">Onze saunahoed</FooterLink>
```

- [ ] **Step 3: Sitemap-entry**

In `src/app/sitemap.ts`, voeg in de `statics`-array een regel toe na de `/gids`-regel:

```ts
    { url: u("/gids"), changeFrequency: "weekly", priority: 0.6 },
    { url: u("/saunahoed"), changeFrequency: "weekly", priority: 0.7 },
```

- [ ] **Step 4: Verifieer met de build**

Run: `npm run build`
Verwacht: build slaagt; `/saunahoed` verschijnt in de route-lijst van de build-output.

- [ ] **Step 5: Commit**

```bash
git add src/components/SiteHeader.tsx src/components/SiteFooter.tsx src/app/sitemap.ts
git commit -m "feat(merch): saunahoed in navigatie, footer en sitemap"
```

---

### Task 6: Gids-integratie (blok + tekstlinks)

**Files:**
- Modify: `src/lib/content.ts:78-87` (Gids-interface) en `src/lib/content.ts:269-281` (`getAllGidsen`)
- Create: `src/components/EigenProductCta.tsx`
- Modify: `src/app/gids/[slug]/page.tsx`
- Modify: `content/gidsen/beste-saunahoed-2026.mdx`
- Modify: `content/gidsen/wat-neem-je-mee-naar-een-opgieting.mdx`

- [ ] **Step 1: `eigenProduct`-veld in de content-loader**

In `src/lib/content.ts`, voeg aan de `Gids`-interface toe (na `producten: GidsProduct[];`):

```ts
  /** Slug van een eigen merch-product (content/merch) dat bovenaan de gids uitgelicht wordt. */
  eigenProduct?: string;
```

En in `getAllGidsen`, in de map-functie (na `producten: parseProducten(data.producten),`):

```ts
      eigenProduct: data.eigenProduct as string | undefined,
```

- [ ] **Step 2: Maak het uitgelichte blok**

Maak `src/components/EigenProductCta.tsx` (server component):

```tsx
import Link from "next/link";
import { CoverImage } from "@/components/CoverImage";
import { formatEuro, isBestelbaar, type MerchProduct } from "@/lib/merch";

/*
  Uitgelicht blok voor een eigen merch-product bovenaan een gidsartikel.
  Duidelijk gelabeld als eigen product: dit is geen affiliate-aanbeveling en
  valt dus buiten de affiliate-disclosure van de gids.
*/
export function EigenProductCta({ product }: { product: MerchProduct }) {
  const statusLabel = isBestelbaar(product)
    ? null
    : product.productStatus === "uitverkocht"
      ? "Tijdelijk uitverkocht"
      : "Binnenkort beschikbaar";

  return (
    <Link
      href={`/${product.slug}`}
      className="group mt-6 flex flex-col overflow-hidden rounded-[--radius-card] border border-ember/30 bg-ember-tint shadow-sm transition-shadow hover:shadow-md sm:flex-row"
    >
      {product.afbeeldingen[0] && (
        <div className="relative sm:w-56 sm:flex-none">
          <CoverImage
            src={product.afbeeldingen[0]}
            alt={product.naam}
            className="aspect-[4/3] h-full"
            sizes="(max-width: 640px) 100vw, 224px"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ember">Ons eigen product</p>
        <h2 className="mt-1 font-display text-lg font-semibold text-ink">{product.naam}</h2>
        {statusLabel && <p className="mt-1 text-sm text-ink-soft">{statusLabel}</p>}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink">{formatEuro(product.prijs)}</span>
          <span className="inline-flex items-center rounded-full bg-ember px-3.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-ember/90">
            Bekijken
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Render het blok op de gidspagina**

In `src/app/gids/[slug]/page.tsx`:

Imports toevoegen:

```ts
import { getMerchProduct } from "@/lib/merch";
import { EigenProductCta } from "@/components/EigenProductCta";
```

Na `if (!gids) notFound();` toevoegen:

```ts
  const eigenProduct = gids.eigenProduct ? getMerchProduct(gids.eigenProduct) : undefined;
```

Direct na de sluitende `</header>`-tag (vóór het `{gids.afbeelding && ...}`-blok) toevoegen:

```tsx
      {eigenProduct && <EigenProductCta product={eigenProduct} />}
```

- [ ] **Step 4: Content-edits in beide gidsen**

In `content/gidsen/beste-saunahoed-2026.mdx`:
1. Voeg in de frontmatter na de `bijgewerkt:`-regel toe: `eigenProduct: saunahoed` en zet `bijgewerkt:` op `2026-07-23`.
2. Voeg direct onder de eerste alinea van de body een nieuwe alinea toe:

```markdown
Goed nieuws voor wie het liefst iets met een verhaal draagt: we brengen
binnenkort [onze eigen Opgietingen.nl saunahoed](/saunahoed) uit, een klassiek
wolvilten model met geborduurd logo, gemaakt in kleine oplage.
```

In `content/gidsen/wat-neem-je-mee-naar-een-opgieting.mdx`:
1. Voeg direct onder de regel `<Product id="saunahoed-vilt" />` een nieuwe alinea toe:

```markdown
Liever een hoed met een verhaal? Binnenkort verkopen we
[onze eigen Opgietingen.nl saunahoed](/saunahoed): geborduurd wolvilt in een
kleine oplage.
```

2. Zet in de frontmatter `bijgewerkt:` op `2026-07-23` (voeg de regel toe als die ontbreekt).

- [ ] **Step 5: Verifieer in de dev-server**

Run: `npm run dev`, open `http://localhost:3000/gids/beste-saunahoed-2026`.
Verwacht: het "Ons eigen product"-blok staat direct onder de header met label "Binnenkort beschikbaar", prijs en Bekijken-knop; klik leidt naar `/saunahoed`. De affiliate-producten en disclosure eronder zijn onveranderd. Controleer ook `http://localhost:3000/gids/wat-neem-je-mee-naar-een-opgieting` op de nieuwe tekstlink.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content.ts src/components/EigenProductCta.tsx "src/app/gids/[slug]/page.tsx" content/gidsen/beste-saunahoed-2026.mdx content/gidsen/wat-neem-je-mee-naar-een-opgieting.mdx
git commit -m "feat(merch): eigen-product-blok in gidsen + tekstlinks naar /saunahoed"
```

---

### Task 7: Eindverificatie

**Files:** geen nieuwe wijzigingen (alleen controleren).

- [ ] **Step 1: Volledige verificatie**

```bash
npm run lint && npm test && npm run build
```

Verwacht: alle drie slagen. In de build-output staan `/saunahoed` en `/uit/merch/[slug]` als routes.

- [ ] **Step 2: Push**

```bash
git push
```

(Vercel deployt automatisch; de pagina gaat live in de `binnenkort`-stand.)

- [ ] **Step 3: Meld de openstaande punten aan Nathaniel**

Rapporteer expliciet deze punten die buiten de code liggen:

1. **Prijs is een placeholder:** € 34,95 staat nu op de live pagina. Aanpassen kan in `content/merch/saunahoed.mdx` (`prijs:`).
2. **Foto's ontbreken nog:** `afbeeldingen: []` is leeg; de pagina rendert zonder beeld. Productfoto's toevoegen onder `public/images/merch/` en de paden in de frontmatter zetten.
3. **Omschakelen naar verkoop (over 3-4 weken, na KvK + Mollie):** `betaalUrl:` invullen met de Mollie-betaallink en `productStatus: leverbaar` zetten. **Verifieer dan eerst of een Mollie-betaallink het verzendadres uitvraagt** (spec-aanname); zo niet, dan is een minimaal bestelformulier de fallback (aparte taak).
4. **Bij uitverkocht:** `productStatus: uitverkocht` zetten.
