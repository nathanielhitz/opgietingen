"use client";

import { useEffect, useRef, useState } from "react";
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
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setKanNative(typeof navigator.share === "function");
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const deelUrl = (source: string) => utmUrl(url, { source, medium: "deel", campaign: `event-${slug}` });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${titel} ${deelUrl("whatsapp")}`)}`;

  async function kopieer() {
    try {
      await navigator.clipboard.writeText(deelUrl("link"));
      window.clearTimeout(timer.current);
      setGekopieerd(true);
      track("deel", { kanaal: "link", slug });
      timer.current = window.setTimeout(() => setGekopieerd(false), 2000);
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
    "flex min-h-11 basis-[calc(50%-0.25rem)] items-center justify-center whitespace-nowrap rounded-lg border border-sand bg-surface px-3 text-sm font-medium text-ink-soft transition-colors hover:border-ember hover:text-ember";

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Deel dit event</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={whatsapp} target="_blank" rel="noopener" className={knop} onClick={() => track("deel", { kanaal: "whatsapp", slug })}>
          WhatsApp
        </a>
        <button type="button" onClick={kopieer} className={knop}>
          Link kopiëren
          <span role="status" aria-live="polite" className="sr-only">
            {gekopieerd ? "Link gekopieerd" : ""}
          </span>
        </button>
        {kanNative && (
          <button type="button" onClick={deel} className={knop}>
            Delen
          </button>
        )}
      </div>
      {gekopieerd && (
        <p className="mt-2 text-xs text-ink-faint" aria-hidden="true">
          Link gekopieerd.
        </p>
      )}
    </div>
  );
}
