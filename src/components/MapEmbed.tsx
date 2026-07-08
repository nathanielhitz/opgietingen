/*
  Dependency-vrije kaart via OpenStreetMap-embed (iframe). Voldoet aan "kaart
  voor saunalocaties" (PRD §5) zonder client-only Leaflet. Upgrade-pad: een
  interactieve Leaflet-overzichtskaart op /saunas in een latere sessie.
*/
export function MapEmbed({
  lat,
  lng,
  label,
  className = "",
}: {
  lat: number;
  lng: number;
  label: string;
  className?: string;
}) {
  const d = 0.008; // ~800m bbox rondom het punt
  const bbox = [lng - d, lat - d, lng + d, lat + d].join("%2C");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
  const link = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  return (
    <div className={`overflow-hidden rounded-[--radius-card] border border-sand ${className}`}>
      <iframe
        title={`Kaart: ${label}`}
        src={src}
        loading="lazy"
        className="h-56 w-full"
        style={{ border: 0 }}
      />
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-surface px-3 py-2 text-center text-xs font-medium text-ember hover:underline"
      >
        Bekijk grotere kaart op OpenStreetMap
      </a>
    </div>
  );
}
