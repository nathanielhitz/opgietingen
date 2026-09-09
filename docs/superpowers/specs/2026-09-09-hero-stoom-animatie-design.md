# Stoomanimatie in de homepage-hero — ontwerp

Datum: 2026-09-09. Status: gebouwd op 2026-09-09; spec bijgewerkt na de bouw (reviewpunten in §8).

## 1. Aanleiding

De homepage-hero is een foto van een opgieting (saunameester met doek, gloeiende
stenen rechtsonder, stoom in de cabine) met een donkere scrim en het glazen
zoekformulier eroverheen. De foto suggereert beweging, maar staat stil. Nathaniel
wil een mooie, niet-afleidende stoomanimatie die het opgiet-gevoel geeft zonder
de kop en de zoekbalk te beconcurreren.

De site kent nog geen enkele animatie; wel een globale
`prefers-reduced-motion`-regel in `globals.css`.

## 2. Keuzes uit de brainstorm

Drie richtingen zijn als bewegende mockup over de echte herofoto beoordeeld
(nevel over de hele hero; doorlopende pluim vanaf de oven; ritmische opgieting met
piek elke 14 s). Gekozen:

- **Richting B, "Pluim":** stoom stijgt doorlopend op vanaf de saunaoven rechtsonder
  en rolt richting het raam. Eén bewegend punt in de foto, weg van kop en zoekbalk,
  zonder piekmoment.
- **Plus een ademende gloed** op de stenen: een trage puls zonder piek, die het
  "vuur onder de stoom" verklaart.
- **Ook op mobiel**, met een eigen verankering voor de staande foto.
- **Intensiteit zoals in de mockup:** duidelijk zichtbaar als je kijkt, wazig genoeg
  om niet te trekken.
- **Bouwwijze: CSS-only.** Geen canvas, geen video, geen client component.

Afgewezen: canvas-particles (client component, JS-bundel en CPU op de belangrijkste
pagina voor een effect dat je nauwelijks moet opmerken) en een transparante
video-overlay (megabytes op de LCP-pagina, aparte HEVC-variant voor Safari, schaalt
niet mee met twee foto-uitsnedes).

## 3. Architectuur

**Nieuw component** `src/components/HeroStoom.tsx` (Server Component, geen props):

```tsx
<div className="hero-stoom absolute inset-0 pointer-events-none" aria-hidden>
  <span className="stoom-wolk" style={{ "--duur": "11s",   "--start": "0s",     "--drift": "-30%" }} />
  <span className="stoom-wolk" style={{ "--duur": "13s",   "--start": "-2.2s",  "--drift": "-42%" }} />
  <span className="stoom-wolk" style={{ "--duur": "10s",   "--start": "-4.1s",  "--drift": "-18%" }} />
  <span className="stoom-wolk" style={{ "--duur": "12s",   "--start": "-6.3s",  "--drift": "-36%" }} />
  <span className="stoom-wolk" style={{ "--duur": "14s",   "--start": "-8.5s",  "--drift": "-26%" }} />
  <span className="stoom-wolk" style={{ "--duur": "11.5s", "--start": "-10.2s", "--drift": "-48%" }} />
  <span className="stoom-gloed" />
</div>
```

De zes wolken staan als vaste lijst in het component (geen config, geen loader).
De variatie per wolk zit in drie CSS-variabelen; alles verder is klasse. De
inline-style met custom properties is getypeerd als
`CSSProperties & Record<"--duur" | "--start" | "--drift", string>` (smal type
i.p.v. een brede `as CSSProperties`-cast, zodat de drie custom-property
sleutels typegecheckt blijven).

`HeroStoom.tsx` opent met twee JSX-pragma-regels (`@jsxRuntime automatic`,
`@jsxImportSource react`): de tsx-testrunner gebruikt tsconfig's
`"jsx": "preserve"`, wat `node:test` laat falen met "React is not defined";
Next (SWC) negeert deze pragma's en gebruikt zijn eigen instelling toch al.

**Plaatsing** in `HeroHeader.tsx`: direct ná de `<picture>` en vóór
`div.hero-overlay`. De stoom ligt dus onder de scrim en dimt mee waar tekst staat.
De sectie heeft al `relative isolate overflow-hidden`, wat de wolken binnen de
hero houdt en de `mix-blend-mode` isoleert.

**Stijl** in `src/app/globals.css`, naast `.hero-overlay`, met bestaande tokens
(wolken: cream-wit `rgba(255, 244, 234, …)`; gloed: `--color-ember-soft`). Geen
nieuwe tokens, geen nieuwe dependency, geen JavaScript.

## 4. Bewegingsspecificatie

**Wolk** (`.stoom-wolk`)

- Vorm: cirkel, `aspect-ratio: 1`, `border-radius: 50%`,
  `background: radial-gradient(closest-side, rgba(255,244,234,.95), rgba(255,244,234,.4) 45%, transparent)`,
  `filter: blur(22px)`, `mix-blend-mode: screen`.
- Verankering desktop (≥ 768 px): `width: 17%` van de hero, `right: 13%`,
  `bottom: 10%`. Verankeren met `right`/`bottom` in plaats van `left`/`top`: de
  hero-sectie wordt door zijn inhoud gemeten en de foto is `object-cover`, dus de
  exacte positie van de stenen verschuift per viewport. De oven zit in beide
  foto's rechtsonder; een pluim uit die hoek is bij elke uitsnede geloofwaardig.
- Verankering mobiel (< 768 px): `width: 30%`, `right: 6%`, `bottom: 14%`
  (de staande foto heeft de stenen groter en iets hoger in beeld), en een
  kleinere `filter: blur(14px)`: de wolken zijn op mobiel in pixels veel
  kleiner, dezelfde 22px blur zou ze bijna wegvegen.
- Animatie: `stoom-pluim var(--duur) ease-out var(--start) infinite`.

```css
@keyframes stoom-pluim {
  0%   { transform: translate(0, 0) scale(.45); opacity: 0; }
  12%  { opacity: .38; }
  60%  { opacity: .18; }
  100% { transform: translate(var(--drift), -175%) scale(1.9); opacity: 0; }
}
```

De negatieve startwaarden zorgen dat er bij het laden direct stoom staat in
plaats van een lege hero die pas na seconden begint. Cycli van 10 tot 14 s met
verschillende starttijden geven een doorlopend, niet-herhalend beeld.

**Gloed** (`.stoom-gloed`)

- Ellips over de stenen: `width: 34%`, `aspect-ratio: 1.4`, desktop `right: 4%`,
  `bottom: -8%`; mobiel `width: 60%`, `right: -6%`, `bottom: 2%`, met een
  kleinere `filter: blur(20px)` (i.p.v. 30px): dezelfde reden als bij de wolk,
  op mobiel is de ellips in pixels veel kleiner.
  `border-radius: 50%`, `mix-blend-mode: screen`,
  `background: radial-gradient(closest-side, color-mix(in srgb, var(--color-ember-soft) 85%, transparent), color-mix(in srgb, var(--color-ember-soft) 35%, transparent) 50%, transparent)`.
  Dit gebruikt het bestaande token in plaats van hardgecodeerde rgba.
- Animatie: `stoom-adem 8s ease-in-out infinite alternate`, dekking van .12
  naar .30. Geen piek; alleen ademen. (Eigen naam i.p.v. `stoom-gloed`, om
  botsing met de klassenaam `.stoom-gloed` te vermijden.)

## 5. Prestaties en toegankelijkheid

- Alleen `transform` en `opacity` worden geanimeerd: composited, geen layout of
  paint per frame. Zeven kleine elementen met blur is vergelijkbaar met wat de
  frosted-glass zoekbalk (`backdrop-blur-md`) al vraagt. Bewust geen
  `will-change`: de lopende animatie promoveert de elementen al; permanente
  lagen bovenop het LCP-element zijn ongewenst.
- Geen afbeeldingen in de laag; de herofoto blijft het LCP-element en de laag
  voegt geen bytes toe aan de kritieke route. Geen client component, dus geen
  hydration en geen bundelgroei.
- `prefers-reduced-motion: reduce`: de hele laag krijgt `display: none`. De foto
  bevat al stoom; stilstaande wolken toevoegen heeft geen waarde. De bestaande
  globale reduced-motion-regel blijft ongemoeid (die zet animaties op 0,01 ms, wat
  hier tot een statische wolk zou leiden; `display: none` is netter).
- De laag is decoratief: `aria-hidden`, `pointer-events: none`, geen tekst.
  Formulier en links liggen erboven en blijven bedienbaar.

## 6. Buiten scope

- Reactie op muis of scroll, of pauzeren als de hero uit beeld is (CSS-animaties
  buiten de viewport kosten de browser nagenoeg niets).
- Andere pagina's of hero's dan de homepage.
- Een instelbare intensiteit of aan/uit-schakelaar.
- Aanpassing van de foto-uitsnede (`object-position`).

## 7. Verificatie

Eén structurele test, `scripts/lib/hero-stoom.test.ts`: zes wolken, één gloed,
`aria-hidden`, geen tekst, unieke startoffsets. Geen CSS-test: dat blijft
decoratieve stijl zonder logica. Verder:

1. `npm run lint` en `npm run build` groen.
2. Handmatig in de dev-server: desktop (stoom komt uit de oven rechtsonder, kop
   en zoekbalk blijven leesbaar), mobiel-viewport (< 768 px, verankering klopt met
   de staande foto), en met "verminder beweging" aan (geen stoomlaag).
3. Vergelijk met de mockup: variant B, inclusief pauzeer-knop en de optie om
   tekst te verbergen. Timing, schaal en dekking in §4 zijn dezelfde als in de
   mockup; de verankering is vertaald van `left`/`top` naar `right`/`bottom` en
   wordt op het oog afgestemd op de echte hero-hoogte.
4. Uitgevoerd op 2026-09-09 met headless Chrome tegen de productie-build:
   verschilbeeld tussen bewegende en reduced-motion-weergave toont de pluim uit
   de ovenhoek rechtsonder, weg van kop en zoekbalk; met reduced motion geen
   laag. Op mobiel (390 px) valt de oven door de smalle uitsnede buiten beeld;
   de pluim komt uit de hoek rechtsonder en blijft geloofwaardig. Geen
   bijstelling van de verankering nodig.

Werk in een aparte git-worktree; Nathaniel draait soms twee sessies in één
checkout.

## 8. Afwijkingen na review

- **Geen `will-change`** op `.stoom-wolk`: de lopende animatie promoveert het
  element toch al; een permanente laag boven op het LCP-element is onnodige
  overhead.
- **Animatienaam `stoom-adem` i.p.v. `stoom-gloed`**: voorkomt botsing met de
  klassenaam `.stoom-gloed`.
- **Kleinere blur op mobiel** (`blur(14px)` voor de wolk, `blur(20px)` voor de
  gloed): de wolken zijn in pixels veel kleiner op mobiel, de desktop-blur zou
  ze bijna wegvegen.
- **Kleur via `color-mix(in srgb, var(--color-ember-soft) …, transparent)`**
  i.p.v. hardgecodeerde rgba: gebruikt het bestaande themetoken in plaats van
  een losstaande kleurwaarde.
- **JSX-pragma's + smal `WolkStijl`-type**: de tsx-testrunner heeft de pragma's
  nodig om te draaien onder `"jsx": "preserve"`; het smalle type i.p.v. een
  brede `as CSSProperties`-cast houdt de drie custom-property sleutels
  typegecheckt.
