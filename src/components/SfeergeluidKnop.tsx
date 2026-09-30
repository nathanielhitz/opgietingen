"use client";

import { useSfeergeluid } from "@/components/SfeergeluidProvider";

/*
  Aan/uit-knop voor het sfeergeluid in de header (spec 2026-09-30). De stand en
  de speler komen uit SfeergeluidProvider; hier alleen de knop. Geen animatie:
  twee statische iconen.
*/
export function SfeergeluidKnop({ overlay }: { overlay: boolean }) {
  const { stand, zetAan, zetUit } = useSfeergeluid();
  const aan = stand === "aan";
  return (
    <button
      type="button"
      aria-pressed={aan}
      aria-label={aan ? "Sfeergeluid uit" : "Sfeergeluid aan"}
      title={aan ? "Sfeergeluid uit" : "Sfeergeluid aan"}
      onClick={aan ? zetUit : zetAan}
      className={`grid h-11 w-11 place-items-center rounded-full transition-colors ${
        overlay ? "text-white hover:bg-white/10" : "text-ink hover:bg-sand"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        {aan ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m22 9-6 6M16 9l6 6" />
        )}
      </svg>
    </button>
  );
}
