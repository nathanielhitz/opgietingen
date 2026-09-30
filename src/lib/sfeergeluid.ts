// src/lib/sfeergeluid.ts
/*
  Sfeergeluid op de site (spec docs/superpowers/specs/2026-09-30-sfeergeluid-website-design.md).
  Pure delen (stand lezen/wisselen) staan los van de browser-speler, zodat ze
  met node:test te testen zijn. De speler zelf is browser-only: maak hem pas aan
  in een event-handler of effect, nooit tijdens de server-render.
*/

export const SFEERGELUID_SRC = "/audio/sfeergeluid.mp3";
export const SFEERGELUID_OPSLAG = "opgietingen:sfeergeluid";
/** 35 %: achtergrond, geen voorgrond. */
export const SFEERGELUID_VOLUME = 0.35;
export const SFEERGELUID_FADE_IN_S = 2;
export const SFEERGELUID_FADE_UIT_S = 0.8;

export type Stand = "aan" | "uit";

/** Alleen letterlijk "aan" telt; alles anders (ontbrekend, onzin) is uit. */
export function leesStand(raw: string | null | undefined): Stand {
  return raw === "aan" ? "aan" : "uit";
}

export function wissel(stand: Stand): Stand {
  return stand === "aan" ? "uit" : "aan";
}

export interface Speler {
  /** Start (met fade-in). false als de browser afspelen weigert (autoplay-beleid). */
  aan(): Promise<boolean>;
  /** Fade-out en pauze. */
  uit(): void;
}

/**
 * Browser-speler: één <audio> in een loop, pas geladen bij de eerste start
 * (preload none). Het volume loopt via een GainNode van de Web Audio API,
 * omdat iOS `HTMLMediaElement.volume` negeert; zonder AudioContext valt hij
 * terug op `volume` zonder fades.
 */
export function maakSpeler(): Speler {
  let audio: HTMLAudioElement | null = null;
  let ctx: AudioContext | null = null;
  let gain: GainNode | null = null;
  let uitTimer: ReturnType<typeof setTimeout> | null = null;

  function element(): HTMLAudioElement {
    if (audio) return audio;
    audio = new Audio(SFEERGELUID_SRC);
    audio.loop = true;
    audio.preload = "none";
    // Verborgen in de DOM: zichtbaar in devtools en voor tests, zonder UI.
    audio.hidden = true;
    audio.setAttribute("data-sfeergeluid", "");
    document.body.appendChild(audio);
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        ctx = new Ctx();
        const bron = ctx.createMediaElementSource(audio);
        gain = ctx.createGain();
        gain.gain.value = 0;
        bron.connect(gain).connect(ctx.destination);
      }
    } catch {
      ctx = null;
      gain = null;
    }
    if (!gain) audio.volume = SFEERGELUID_VOLUME;
    return audio;
  }

  return {
    async aan() {
      const a = element();
      if (uitTimer) {
        clearTimeout(uitTimer);
        uitTimer = null;
      }
      if (ctx && gain) {
        try {
          await ctx.resume();
        } catch {
          // resume faalt alleen buiten een gebruikersactie; play() geeft dan zelf uitsluitsel.
        }
        const nu = ctx.currentTime;
        gain.gain.cancelScheduledValues(nu);
        gain.gain.setValueAtTime(gain.gain.value, nu);
        gain.gain.linearRampToValueAtTime(SFEERGELUID_VOLUME, nu + SFEERGELUID_FADE_IN_S);
      }
      try {
        await a.play();
        return true;
      } catch {
        return false;
      }
    },
    uit() {
      if (!audio) return;
      const a = audio;
      if (ctx && gain) {
        const nu = ctx.currentTime;
        gain.gain.cancelScheduledValues(nu);
        gain.gain.setValueAtTime(gain.gain.value, nu);
        gain.gain.linearRampToValueAtTime(0, nu + SFEERGELUID_FADE_UIT_S);
        uitTimer = setTimeout(() => {
          a.pause();
          uitTimer = null;
        }, SFEERGELUID_FADE_UIT_S * 1000);
      } else {
        a.pause();
      }
    },
  };
}
