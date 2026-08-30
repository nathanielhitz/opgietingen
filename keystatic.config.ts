// keystatic.config.ts
// Schema's voor het beheerpaneel. Elke ingang is 1-op-1 op de bestaande
// frontmatter/JSON, zodat loader (src/lib/content.ts) en scripts niets merken.
// Spec: docs/superpowers/specs/2026-08-29-keystatic-beheerpaneel-design.md
import { createElement } from "react";
import { config, fields, collection, singleton } from "@keystatic/core";
import { block } from "@keystatic/core/content-components";
import { EVENT_TYPES, PROVINCES } from "./src/lib/site";

// GitHub-mode zodra de GitHub App geconfigureerd is (NEXT_PUBLIC_ zodat de
// keuze ook client-side bekend is); anders local-mode voor `npm run dev`.
// De waarde zelf wordt hier niet gebruikt: Keystatic leest de app-slug zelf uit de env; dit is alleen de aan/uit-schakelaar.
const githubAppSlug = process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG;

const alleProvincies = [...PROVINCES.NL, ...PROVINCES.BE].map((p) => ({ label: p, value: p }));

const eventTypeOpties = Object.entries(EVENT_TYPES).map(([value, label]) => ({ label, value }));

const padVeld = (label: string, voorbeeld: string) =>
  fields.text({
    label,
    description: `Pad onder public/, bv. ${voorbeeld}. Geen upload: beelden plaats je in de repo (zie docs/image-prompts.md).`,
  });

/** Velden van één bron in content/bronnen.json. Los geëxporteerd voor de dekkingstest. */
export const bronVelden = {
  id: fields.text({
    label: "Id (= saunaSlug)",
    description: "Koppelt gescrapete events aan het sauna-profiel met dezelfde slug.",
    validation: { isRequired: true },
  }),
  naam: fields.text({ label: "Naam", validation: { isRequired: true } }),
  land: fields.select({
    label: "Land",
    options: [
      { label: "Nederland", value: "NL" },
      { label: "België", value: "BE" },
      { label: "NL/BE (keten)", value: "NL/BE" },
    ],
    defaultValue: "NL",
  }),
  provincie: fields.text({ label: "Provincie" }),
  website: fields.url({ label: "Website" }),
  facebook: fields.url({
    label: "Facebook-pagina",
    description: "Matching-anker voor doorgestuurde posts én bron voor scrape-facebook.",
  }),
  agendaUrl: fields.url({
    label: "Agenda-URL",
    description: "Leeg laten bij status aanvullen/opzetten of bij een niet-website-kanaal (mail, Facebook).",
  }),
  agendaUrlVast: fields.checkbox({
    label: "Agenda-URL vast",
    description: "Aan = verify-bronnen doet geen discovery/herschrijving meer voor deze bron.",
  }),
  type: fields.select({
    label: "Type",
    options: [
      { label: "Website", value: "website" },
      { label: "Handmatig", value: "handmatig" },
      { label: "Nieuwsbrief", value: "nieuwsbrief" },
    ],
    defaultValue: "website",
  }),
  matchToken: fields.text({
    label: "Match-token",
    description: "Alleen voor het mailkanaal: e-mailadres of domein van de afzender als dat afwijkt van de website.",
  }),
  status: fields.select({
    label: "Status",
    options: [
      { label: "actief", value: "actief" },
      { label: "te-verifieren", value: "te-verifieren" },
      { label: "geen-agenda", value: "geen-agenda" },
      { label: "handmatig", value: "handmatig" },
      { label: "aanvullen", value: "aanvullen" },
      { label: "opzetten", value: "opzetten" },
      { label: "kapot", value: "kapot" },
    ],
    defaultValue: "te-verifieren",
  }),
  notities: fields.text({ label: "Notities", multiline: true }),
  laatstGecontroleerd: fields.text({
    label: "Laatst gecontroleerd",
    description: "Wordt door verify-bronnen gezet; hier alleen ter informatie, niet aanpassen.",
  }),
};

export default config({
  storage: githubAppSlug
    ? { kind: "github", repo: "nathanielhitz/opgietingen" }
    : { kind: "local" },

  ui: {
    brand: {
      // Kort, want het merkteken (links ervan) is de enige plek voor een link
      // terug naar het dashboard (/beheer): Keystatic's UI is niet uitbreidbaar
      // met eigen pagina's. Samen leest het als "← Dashboard  Beheer". Gewone
      // <a>, geen JSX: dit bestand is .ts en wordt ook door tsx-tests geladen.
      name: "Beheer",
      mark: () =>
        createElement(
          "a",
          {
            href: "/beheer",
            // "Runs", niet "Dashboard": Keystatic's eigen startpagina heet al zo.
            title: "Naar het scrape-dashboard (/beheer)",
            style: { fontSize: 12, fontWeight: 600, textDecoration: "none", color: "currentColor", opacity: 0.75, whiteSpace: "nowrap" },
          },
          "← Runs",
        ),
    },
    navigation: {
      Content: ["events", "saunas", "gidsen"],
      Scraper: ["bronnen"],
    },
  },

  collections: {
    events: collection({
      label: "Events",
      path: "content/events/*",
      slugField: "titel",
      format: { contentField: "body" },
      columns: ["titel", "saunaSlug", "startDatum", "status"],
      schema: {
        titel: fields.slug({
          name: { label: "Titel", validation: { isRequired: true } },
          slug: {
            label: "Slug (bestandsnaam)",
            description: "Scraper-conventie: <sauna>-<titel>-<startdatum>. Niet wijzigen bij bestaande events (URL).",
          },
        }),
        slug: fields.ignored(),
        saunaSlug: fields.relationship({
          label: "Sauna",
          collection: "saunas",
          validation: { isRequired: true },
        }),
        type: fields.select({ label: "Type", options: eventTypeOpties, defaultValue: "thema" }),
        startDatum: fields.date({ label: "Startdatum", validation: { isRequired: true } }),
        eindDatum: fields.date({ label: "Einddatum" }),
        tijden: fields.text({ label: "Tijden", description: "Bv. 10:00–22:00" }),
        prijsIndicatie: fields.text({ label: "Prijsindicatie", description: "Bv. Vanaf € 49,50" }),
        ticketUrl: fields.url({
          label: "Ticket-URL",
          description: "Bezoekers gaan hierheen via /uit/<slug>. Gebruik deze link ook om het event zelf te controleren.",
        }),
        afbeelding: padVeld("Afbeelding", "/images/events/naam.jpg"),
        status: fields.select({
          label: "Status",
          description: "Alleen 'gepubliceerd' is zichtbaar op de site. Afwijzen = op concept laten of op afgelopen zetten; niet verwijderen (de scraper maakt het anders opnieuw aan).",
          options: [
            { label: "Concept (onzichtbaar)", value: "concept" },
            { label: "Gepubliceerd", value: "gepubliceerd" },
            { label: "Afgelopen", value: "afgelopen" },
          ],
          defaultValue: "concept",
        }),
        bron: fields.select({
          label: "Bron",
          options: [
            { label: "Scraper", value: "scraper" },
            { label: "Handmatig", value: "handmatig" },
          ],
          defaultValue: "handmatig",
        }),
        keurNotitie: fields.text({
          label: "Keurnotitie (kwaliteitspoort)",
          multiline: true,
          description: "Waarom de scraper dit event als concept liet staan. Laat staan als historie; publiceren doe je via Status.",
        }),
        body: fields.mdx({ label: "Beschrijving / programma" }),
      },
    }),

    saunas: collection({
      label: "Sauna's",
      path: "content/saunas/*",
      slugField: "naam",
      format: { contentField: "body" },
      columns: ["naam", "plaats", "provincie", "roosterGecheckt"],
      schema: {
        naam: fields.slug({
          name: { label: "Naam", validation: { isRequired: true } },
          slug: { label: "Slug (bestandsnaam)", description: "Niet wijzigen bij bestaande sauna's: events koppelen hierop." },
        }),
        slug: fields.ignored(),
        land: fields.select({
          label: "Land",
          options: [
            { label: "Nederland", value: "NL" },
            { label: "België", value: "BE" },
          ],
          defaultValue: "NL",
        }),
        provincie: fields.select({ label: "Provincie", options: alleProvincies, defaultValue: "Gelderland" }),
        plaats: fields.text({ label: "Plaats", validation: { isRequired: true } }),
        adres: fields.text({ label: "Adres", validation: { isRequired: true } }),
        lat: fields.number({ label: "Latitude", validation: { isRequired: true, min: 49, max: 54 } }),
        lng: fields.number({ label: "Longitude", validation: { isRequired: true, min: 2, max: 8 } }),
        faciliteiten: fields.array(fields.text({ label: "Faciliteit" }), {
          label: "Faciliteiten",
          itemLabel: (props) => props.value,
        }),
        website: fields.url({ label: "Website" }),
        affiliateUrl: fields.url({
          label: "Affiliate-URL",
          description: "Doel van /uit/<slug>. Nooit direct vanaf de site linken.",
          validation: { isRequired: true },
        }),
        sponsored: fields.checkbox({ label: "Gesponsord" }),
        afbeelding: padVeld("Afbeelding", "/images/saunas/naam.jpg"),
        logo: padVeld("Logo", "/images/logos/naam.png"),
        logoAchtergrond: fields.select({
          label: "Logo-achtergrond",
          description: "Witte logovarianten hebben 'donker' nodig.",
          options: [
            { label: "Licht", value: "licht" },
            { label: "Donker", value: "donker" },
          ],
          defaultValue: "licht",
        }),
        opgietRooster: fields.array(
          fields.object({
            dag: fields.text({ label: "Dag", description: "Bv. 'za & zo' of 'dagelijks'" }),
            tijden: fields.text({ label: "Tijden", description: "Letterlijk zoals op de sauna-website." }),
          }),
          { label: "Vast opgietrooster", itemLabel: (props) => props.fields.dag.value },
        ),
        roosterGecheckt: fields.date({
          label: "Rooster gecheckt op",
          description: "Wordt door check-roosters bijgewerkt; handmatig zetten na een eigen controle mag.",
        }),
        roosterBron: fields.url({
          label: "Rooster-bron",
          description: "Pagina waar het rooster letterlijk staat, als dat niet de agenda-URL is.",
        }),
        body: fields.mdx({ label: "Beschrijving" }),
      },
    }),

    gidsen: collection({
      label: "Gidsen",
      path: "content/gidsen/*",
      slugField: "titel",
      format: { contentField: "body" },
      columns: ["titel", "bijgewerkt"],
      // Long-form artikel: editor centraal, metadata in de zijbalk.
      entryLayout: "content",
      schema: {
        titel: fields.slug({
          name: { label: "Titel", validation: { isRequired: true } },
          slug: { label: "Slug (URL)", description: "Niet wijzigen bij bestaande gidsen." },
        }),
        slug: fields.ignored(),
        samenvatting: fields.text({ label: "Samenvatting", multiline: true, validation: { isRequired: true } }),
        afbeelding: padVeld("Afbeelding", "/images/gidsen/naam.jpg"),
        bijgewerkt: fields.date({ label: "Bijgewerkt op" }),
        eigenProduct: fields.text({
          label: "Eigen product (merch-slug)",
          description: "Slug uit content/merch, bv. 'saunahoed'. Wordt bovenaan uitgelicht.",
        }),
        producten: fields.array(
          fields.object({
            id: fields.text({
              label: "Id",
              description: "Globaal uniek over alle gidsen heen; gebruikt in /uit/product/<id>.",
              validation: { isRequired: true },
            }),
            naam: fields.text({ label: "Naam", validation: { isRequired: true } }),
            bolUrl: fields.url({
              label: "bol.com-URL",
              description:
                "Gewone bol.com-productlink volstaat: /uit/product/<id> maakt er automatisch een partner-link van (site-ID) en logt de klik.",
              validation: { isRequired: true },
            }),
            afbeelding: fields.url({ label: "Afbeelding (media.s-bol.com)" }),
            prijsIndicatie: fields.text({ label: "Prijsindicatie" }),
            beschrijving: fields.text({ label: "Beschrijving", multiline: true }),
          }),
          { label: "Affiliate-producten", itemLabel: (props) => props.fields.naam.value },
        ),
        body: fields.mdx({
          label: "Artikel",
          components: {
            Product: block({
              label: "Product",
              schema: { id: fields.text({ label: "Product-id", validation: { isRequired: true } }) },
            }),
            ProductGrid: block({ label: "Alle producten (grid)", schema: {} }),
          },
        }),
      },
    }),
  },

  singletons: {
    bronnen: singleton({
      label: "Scraper-bronnen",
      path: "content/bronnen",
      format: { data: "json" },
      schema: {
        $comment: fields.ignored(),
        laatstBijgewerkt: fields.ignored(),
        bronnen: fields.array(fields.object(bronVelden), {
          label: "Bronnen",
          itemLabel: (props) => `${props.fields.naam.value} · ${props.fields.status.value}`,
        }),
      },
    }),
  },
});
