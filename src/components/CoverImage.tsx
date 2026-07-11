import Image from "next/image";

/*
  Coverafbeelding voor event- en saunakaarten. Echte foto's gaan via next/image
  (automatische WebP + juiste formaten); zonder afbeelding valt de kaart terug
  op een warme gradient met stoomwolkje.
*/
export function CoverImage({
  src,
  alt,
  className = "",
  sizes,
}: {
  src?: string;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-wood-dark warmth-gradient ${className}`}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "100vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div aria-hidden className="grid h-full w-full place-items-center text-ember-soft/40">
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3c0 1.5-1.5 2-1.5 3.5S8 8.5 8 10" />
            <path d="M12 2.5c0 1.6-1.6 2.2-1.6 3.8S12 8.6 12 10.3" />
            <path d="M16 3c0 1.5-1.5 2-1.5 3.5S16 8.5 16 10" />
          </svg>
        </div>
      )}
    </div>
  );
}
