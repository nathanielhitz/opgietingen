# Beeld-prompts voor Opgietingen.nl

Kant-en-klare prompts om via ChatGPT (of een andere image-generator) sfeerbeelden te
maken die passen bij de warme sauna-look van de site. Kopieer een blok, vul het
`[SCENE]`-deel aan en genereer.

> **Belangrijk:** houd altijd het **kleurpalet-blok** aan — dat maakt dat alle beelden
> bij elkaar én bij de site horen. Dit zijn AI-sfeerbeelden; gebruik ze niet als
> "echte foto" van een specifieke sauna (voor sauna-profielen zijn echte foto's beter
> voor vertrouwen/E-E-A-T).

## Kleurpalet (kopieer dit in elke prompt)

> Color palette: warm cream and sand backgrounds, deep warm brown wood tones, a glowing
> ember/terracotta orange accent (#c1592a) for warmth, and soft cool steam-grey
> highlights. Warm, low, golden lighting. Avoid cold blue tones, avoid neon, avoid
> oversaturation.

## Formaten

- **Event-kaart / hero op de site:** 16:9 landscape
- **Social post (feed):** 1:1 of 4:5
- **Story / vertical:** 9:16

---

## Basis-prompt (algemeen)

> Create a high-end, photorealistic horizontal image (16:9) for a sauna Aufguss-event
> website.
>
> Scene: [SCENE]
>
> Mood & style: warm, inviting, premium and editorial — like a luxury wellness magazine.
> Calm, atmospheric, slightly cinematic. Soft natural steam and warm light. Candid and
> immersive, no one looking at the camera.
>
> Color palette: warm cream and sand backgrounds, deep warm brown wood tones, a glowing
> ember/terracotta orange accent (#c1592a) for warmth, and soft cool steam-grey
> highlights. Warm, low, golden lighting. Avoid cold blue tones, avoid neon, avoid
> oversaturation.
>
> Composition: clean and uncluttered, natural depth of field, plenty of soft negative
> space so text can be overlaid later. Rule-of-thirds framing.
>
> Avoid: text, logos, watermarks, cartoon/illustration style, plastic AI-glossy skin,
> distorted hands, cheap stock-photo feel.
>
> Output: photorealistic, natural film grain, warm tones, 16:9 landscape.

---

## Per event-type

Vervang alleen de `Scene:`-regel in de basis-prompt.

### Reguliere opgieting (`type: regulier`)

> Scene: an Aufguss master swinging a towel in a dimly lit wooden sauna cabin, steam
> rising from glowing coals, warm ember light, candid mid-action moment.

Veiliger alternatief zonder mensen:

> Scene: an empty warm wooden sauna interior, a wooden ladle and water bucket on the
> bench, soft steam curling in golden backlight, ember-colored glow from the stove.

### Opgietweekend (`type: opgietweekend`)

> Scene: a cozy multi-cabin sauna resort at dusk, warm lit windows, wooden terrace and
> loungers, gentle steam in the air, inviting and relaxed atmosphere.

### Thema-event (`type: thema`)

> Scene: a themed sauna ritual with atmospheric decoration matching [THEMA, bijv.
> "citrus and herbs" / "winter forest" / "oriental spices"], scented steam, warm glowing
> light, immersive and sensory.

Winter/kerst-variant:

> Scene: a snowy sauna exterior at twilight, warm ember light glowing from within, pine
> branches and frost, calm winter evening.

### Kampioenschap (`type: kampioenschap`)

> Scene: a dramatic Aufguss championship performance, a towel spinning mid-air in dynamic
> motion, spotlight on the sauna master, audience silhouettes in warm shadow, theatrical
> energy.

---

## Losse sfeerbeelden (voor gidsen, home, achtergronden)

- **Detailshot:** *close-up of water droplets on hot sauna stones, steam bursting up,
  warm ember glow, shallow depth of field.*
- **Rust/wellness:** *a folded towel and eucalyptus branch on a warm wooden bench, soft
  window light, calm and minimal.*
- **Buitenkant/architectuur:** *a modern wooden sauna cabin by a quiet lake at golden
  hour, warm reflections, serene.*
- **Gids saunahanddoek** (`/gids/beste-saunahanddoek-2026`, bestandsnaam-suggestie
  `saunahanddoek-hamamdoek.jpg`): *a neatly rolled oversized bamboo sauna towel and a
  thin striped hammam towel side by side on a warm wooden sauna bench, soft steam in
  the background, minimal and tactile.*
- **Gids badjas** (`/gids/beste-sauna-badjas-2026`, bestandsnaam-suggestie
  `sauna-badjas-rustruimte.jpg`): *a soft waffle-cotton bathrobe hanging on a wooden
  hook next to a terry bathrobe, warm spa relaxation room with loungers softly blurred
  behind, golden light.*
- **Gids opgietset** (`/gids/beste-opgietset-2026`, bestandsnaam-suggestie
  `opgietset-emmer-lepel.jpg`): *a wooden sauna bucket with ladle resting on a sauna
  bench beside a small hourglass, a wisp of steam rising from hot stones behind,
  close-up, editorial.*
- **Gids opgietbegrippen** (`/gids/opgietbegrippen-uitgelegd`, bestandsnaam-suggestie
  `opgietbegrippen-stoom-kelle.jpg`): *a close-up of a wooden sauna ladle pouring water
  onto glowing hot stones, a dense cloud of steam rising and catching warm golden
  backlight, dark wooden sauna interior softly blurred behind, sensory and elemental.*
- **Gids Aufguss-etiquette** (`/gids/aufguss-etiquette`, bestandsnaam-suggestie
  `aufguss-etiquette-saunabanken.jpg`): *neatly spread towels on tiered wooden sauna
  benches awaiting guests, a calm and orderly sauna cabin just before an Aufguss
  session, soft steam near the stove, warm quiet anticipation, no people.*
- **Gids veilig opgieten** (`/gids/veilig-opgieten`, bestandsnaam-suggestie
  `veilig-opgieten-waterfles.jpg`): *a glass water bottle and a folded towel resting on
  a wooden bench outside a sauna cabin door, soft daylight from a window, a hint of
  steam behind the glass door, calm restorative mood.*

---

## Sauna-sfeerbeelden in bulk (20 nieuwe profielen, juli 2026)

De 20 profielen uit de uitbreiding van 25 juli tonen nu hun logo; een sfeerbeeld is
de mooiste upgrade. **Let op de kanttekening bovenaan dit document:** dit blijven
AI-sfeerimpressies, geen echte foto's van de locatie — echte (met toestemming
verkregen) foto's blijven op termijn beter voor vertrouwen/E-E-A-T. De scenes
hieronder zijn daarom sfeer-generiek gehouden, geïnspireerd op wat elke sauna
bijzonder maakt, zonder gebouwen of interieurs na te bootsen.

**Werkwijze:** plak eerst de masterprompt hieronder in ChatGPT, en vraag daarna per
beeld "generate scene 3" (of plak de scene-regel). Sla elk beeld op als
`public/images/saunas/<bestandsnaam>` (exact de naam uit de lijst) en zet daarna in
de frontmatter van het profiel: `afbeelding: /images/saunas/<bestandsnaam>`.

### Masterprompt (één keer plakken)

> You will generate a series of photorealistic horizontal images (16:9) for sauna
> profile pages on a Dutch wellness website. Every image in the series must share the
> exact same style so they feel like one collection:
>
> Mood & style: warm, inviting, premium and editorial — like a luxury wellness
> magazine. Calm, atmospheric, slightly cinematic. Soft natural steam and warm light.
> No people, or only anonymous silhouettes seen from behind.
>
> Color palette: warm cream and sand backgrounds, deep warm brown wood tones, a
> glowing ember/terracotta orange accent (#c1592a) for warmth, and soft cool
> steam-grey highlights. Warm, low, golden lighting. Avoid cold blue tones, avoid
> neon, avoid oversaturation.
>
> Composition: clean and uncluttered, natural depth of field, rule-of-thirds framing.
>
> Avoid: text, logos, watermarks, signage, cartoon/illustration style, cheap
> stock-photo feel.
>
> I will ask for one scene at a time from a numbered list.

### Scenes (bestandsnaam → scene-regel)

1. `sauna-swoll.jpg` — *a warm wooden sauna house beside a natural ecological swimming pond in an English landscape garden at golden hour, reeds and soft reflections, a wisp of steam.*
2. `sauna-zuidwolde.jpg` — *a rustic thatched farmhouse converted into a countryside sauna, warm light glowing from small windows at dusk, flat Dutch farmland behind.*
3. `thermen-bad-nieuweschans.jpg` — *a steaming outdoor mineral water bath at dusk at a spa resort, bathers' towels on the edge, soft rising vapour catching golden light.*
4. `spa-loppersum.jpg` — *a close-up of a wood-fired sauna stove with crackling logs and glowing embers, a water bucket and ladle beside it, intimate small-spa atmosphere.*
5. `zuiver-amsterdam.jpg` — *a spa sun terrace with loungers at the edge of a green forest, morning mist between the trees, towels folded on the loungers, serene urban escape.*
6. `sauna-ridderrode.jpg` — *an intimate herbal sauna room with a wooden infusion bucket at its centre, bundles of dried herbs hanging, warm candle-like light, dune landscape hinted through a small window.*
7. `thermen-holiday.jpg` — *a tall tower-like wooden sauna cabin in a themed sauna garden at dusk, playful lantern light, winding path with warm glow.*
8. `thermen-barendrecht.jpg` — *the interior of a kelo log sauna built from thick ancient pine trunks, steam rising from the stove, deep warm wood tones.*
9. `thermen-goirle.jpg` — *a large amphitheatre-style Aufguss cabin with tiered benches ready for a session, towels laid out, dramatic warm light on the central stove.*
10. `spa-wellness-venlo.jpg` — *a sauna house beside a small natural bathing pond, rose petals on a wooden tray in the foreground, soft summer evening light.*
11. `palestra.jpg` — *Lapland-style log kota cabins with softly glowing windows in a wooded holiday park at blue hour, warm lantern light on a wooden walkway.*
12. `sauna-drome.jpg` — *a small wooden boat-shaped sauna floating on calm water at golden hour, gentle smoke from its chimney, reeds and reflections.*
13. `elaisa-wellness.jpg` — *a sauna interior lined with thousands of woven willow branches, a wall of warm organic texture, view over a quiet lake through a panoramic window.*
14. `sane-thermen.jpg` — *steaming thermal pools in a modern bathing house with Roman touches, arched warm lighting, bathers as distant silhouettes in swimwear.*
15. `asanti.jpg` — *a kelo wood sauna with ritual towels folded on the bench and essential-oil bottles on a tray, terrace with pond view through the door opening.*
16. `lago-brugge.jpg` — *an outdoor barrel sauna glowing warmly on a terrace at evening, soft pool lights in the background, inviting after-swim calm.*
17. `waer-waters.jpg` — *a panoramic sauna with a wide window overlooking landscaped gardens at dusk, tiered benches in warm light, quiet luxury.*
18. `thermen-dilbeek.jpg` — *a heated outdoor pool steaming on a cold evening, warm underwater light, frost on the surrounding plants, cosy contrast of heat and cold.*
19. `thermen-londerzeel.jpg` — *a natural pond used as a cool-down bath beside a sauna house, wooden steps into dark calm water, early evening light, a hint of steam.*
20. `thermen-katara.jpg` — *a Thai-inspired sauna temple interior with carved wood details and golden accents, incense-like steam in warm light, serene and exotic.*

---

## Tips

- Vraag om varianten: voeg toe *"Give me 3 variations with different compositions."*
- Wil je tekst kunnen overlayen? Vraag om *"plenty of negative space on the [left/right]."*
- Consistentie = altijd hetzelfde kleurpalet-blok hergebruiken.
- Controleer handen/gezichten; kies bij twijfel een variant zonder mensen.
