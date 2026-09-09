/*
  Fonts voor satori. next/font werkt daar niet, en losse fontbestanden in de
  repo zijn overbodig: de Google Fonts CSS-API levert met een oude User-Agent
  statische TTF-instanties per gewicht. Eén keer per proces geladen.
*/
export interface SatoriFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600;
  style: "normal";
}

const OUDE_UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; nl-nl) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
const cache = new Map<string, Promise<ArrayBuffer>>();

async function laadGoogleFont(family: string, weight: number): Promise<ArrayBuffer> {
  const sleutel = `${family}:${weight}`;
  if (!cache.has(sleutel)) {
    const laden = (async () => {
      const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`, {
        headers: { "User-Agent": OUDE_UA },
        signal: AbortSignal.timeout(4000),
      }).then((r) => r.text());
      const bron = css.match(/src:\s*url\(['"]?([^)'"]+)['"]?\)\s*format\(['"](?:truetype|opentype)['"]\)/);
      if (!bron) throw new Error(`Geen TTF-bron voor ${sleutel}`);
      const res = await fetch(bron[1], { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`Font ${sleutel}: HTTP ${res.status}`);
      return res.arrayBuffer();
    })();
    // Alleen opruimen als de entry nog van deze poging is; een nieuwere mag blijven staan.
    laden.catch(() => {
      if (cache.get(sleutel) === laden) cache.delete(sleutel);
    });
    cache.set(sleutel, laden);
  }
  return cache.get(sleutel)!;
}

/** Fraunces 600 (koppen) en Inter 400/500 (tekst); undefined als het laden faalt zodat een render nooit op fonts stukloopt. */
export async function socialFonts(): Promise<SatoriFont[] | undefined> {
  try {
    const [fraunces, inter400, inter500] = await Promise.all([
      laadGoogleFont("Fraunces", 600),
      laadGoogleFont("Inter", 400),
      laadGoogleFont("Inter", 500),
    ]);
    return [
      { name: "Fraunces", data: fraunces, weight: 600, style: "normal" },
      { name: "Inter", data: inter400, weight: 400, style: "normal" },
      { name: "Inter", data: inter500, weight: 500, style: "normal" },
    ];
  } catch (err) {
    console.warn("social-fonts: fallback op standaardfont:", (err as Error).message);
    return undefined;
  }
}
