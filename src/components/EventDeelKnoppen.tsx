"use client";

import { useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { utmUrl } from "@/lib/utm";

/*
  "Deel dit event": WhatsApp (het echte "ga je mee?"-kanaal), link kopiëren en
  het native deelmenu. Elke variant krijgt een eigen utm_source zodat Vercel
  Analytics laat zien welk kanaal terugkomt. De native knop verschijnt pas na
  mount: navigator.share bestaat niet op de server (geen hydration-mismatch).
*/
export function EventDeelKnoppen({ slug, titel, url }: { slug: string; titel: string; url: string }) {
  const [kanNative, setKanNative] = useState(false);
  const [gekopieerd, setGekopieerd] = useState(false);

  useEffect(() => {
    setKanNative(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const deelUrl = (source: string) => utmUrl(url, { source, medium: "deel", campaign: `event-${slug}` });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${titel} ${deelUrl("whatsapp")}`)}`;

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(deelUrl("link"));
      setGekopieerd(true);
      track("deel", { kanaal: "link", slug });
      setTimeout(() => setGekopieerd(false), 2000);
    } catch {
      // Klembord geweigerd: knop blijft staan, geen foutmelding nodig.
    }
  }

  async function deel() {
    try {
      await navigator.share({ title: titel, url: deelUrl("native") });
      track("deel", { kanaal: "native", slug });
    } catch {
      // Geannuleerd door de gebruiker.
    }
  }

  const knop =
    "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-sand bg-surface px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember";

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Deel dit event</p>
      <div className="mt-2 flex gap-2">
        <a href={whatsapp} target="_blank" rel="noopener" className={knop} onClick={() => track("deel", { kanaal: "whatsapp", slug })}>
          WhatsApp
        </a>
        <button type="button" onClick={kopieer} className={knop}>
          {gekopieerd ? "Gekopieerd" : "Link kopiëren"}
        </button>
        {kanNative && (
          <button type="button" onClick={deel} className={knop}>
            Delen
          </button>
        )}
      </div>
    </div>
  );
}
