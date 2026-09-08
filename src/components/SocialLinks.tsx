import { socials, type SocialId } from "@/lib/site";

/*
  Volg-links naar de sociale kanalen. Inline SVG (geen icon-bibliotheek),
  rel="me" markeert de kanalen als eigen profielen. Twee varianten:
  iconen (footer, /links) en tekst (lopende zin op /over).
*/

const ICONEN: Record<SocialId, string> = {
  instagram:
    "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7Zm5 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM17.5 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z",
  facebook:
    "M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.2v2.3H7.4V14h2.8v8h3.3Z",
  tiktok:
    "M16.5 2c.3 2.3 1.6 3.7 3.9 3.9v3.2c-1.5 0-2.8-.4-3.9-1.2v6.6c0 3.7-2.7 6.1-6 5.9-3-.2-5.1-2.6-5.1-5.5 0-3.3 2.9-5.9 6.4-5.5v3.3c-1.7-.4-3.2.7-3.2 2.3 0 1.2.9 2.2 2.1 2.3 1.4.1 2.5-.9 2.5-2.4V2h3.3Z",
};

export function SocialLinks({ variant = "iconen", className = "" }: { variant?: "iconen" | "tekst"; className?: string }) {
  if (variant === "tekst") {
    return (
      <span className={className}>
        {socials.map((s, i) => (
          <span key={s.id}>
            {i > 0 && (i === socials.length - 1 ? " en " : ", ")}
            <a href={s.url} target="_blank" rel="me noopener" className="font-medium text-ember hover:underline">
              {s.label}
            </a>
          </span>
        ))}
      </span>
    );
  }
  return (
    <ul className={`flex items-center gap-3 ${className}`} aria-label="Volg Opgietingen.nl">
      {socials.map((s) => (
        <li key={s.id}>
          <a
            href={s.url}
            target="_blank"
            rel="me noopener"
            aria-label={`Opgietingen.nl op ${s.label}`}
            title={s.label}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-sand bg-surface text-ink-soft transition-colors hover:border-ember hover:text-ember"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" fillRule="evenodd" aria-hidden="true">
              <path d={ICONEN[s.id]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
