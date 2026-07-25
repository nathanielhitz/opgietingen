"use client";

/*
  Interactieve overzichtskaart voor /saunas (PRD §5, upgrade-pad uit MapEmbed).
  Leaflet raakt `window` aan bij import en kan dus niet mee in de SSR-pass van
  deze client component; daarom laden we het pas in useEffect via dynamic
  import. De CSS kan wél statisch mee (App Router staat globale CSS uit
  node_modules toe in components).
*/

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

export interface KaartSauna {
  slug: string;
  naam: string;
  plaats: string;
  provincie: string;
  lat: number;
  lng: number;
}

/* Druppel-pin in ember, wit hart; anker onderaan de punt. */
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40"><path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 13.2 23.6 13.8 24.2a1.7 1.7 0 0 0 2.4 0C16.8 38.6 30 25.5 30 15 30 6.7 23.3 0 15 0Z" fill="#c1592a"/><circle cx="15" cy="14.5" r="5.5" fill="#fffdf9"/></svg>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function SaunaKaart({ saunas }: { saunas: KaartSauna[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let verwijderd = false;

    async function init() {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      if (verwijderd || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        // Scrollwiel-zoom kaapt het paginascrollen; zoomen kan via de knoppen en pinch.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-bijdragers',
      }).addTo(map);

      const pin = L.divIcon({
        html: PIN_SVG,
        className: "sauna-pin",
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -36],
      });

      for (const sauna of saunas) {
        const marker = L.marker([sauna.lat, sauna.lng], {
          icon: pin,
          title: sauna.naam,
          alt: `${sauna.naam}, ${sauna.plaats}`,
        }).addTo(map);
        marker.bindPopup(
          `<strong>${escapeHtml(sauna.naam)}</strong><br/>${escapeHtml(sauna.plaats)}, ${escapeHtml(sauna.provincie)}<br/><a href="/sauna/${encodeURIComponent(sauna.slug)}">Bekijk sauna →</a>`,
        );
      }

      const bounds = L.latLngBounds(saunas.map((s) => [s.lat, s.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [32, 32] });
    }

    void init();

    return () => {
      verwijderd = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [saunas]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Kaart met alle sauna's"
      className="relative z-0 h-[26rem] w-full overflow-hidden rounded-[--radius-card] border border-sand bg-steam-tint sm:h-[30rem]"
    />
  );
}
