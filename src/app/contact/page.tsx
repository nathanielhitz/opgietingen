import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Neem contact op met ${site.name}: tip een opgieting aan, meld een fout of stel een vraag.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-semibold text-ink sm:text-4xl">Contact</h1>
      <p className="mt-4 leading-relaxed text-ink-soft">
        Heb je een tip voor een opgieting, zie je een fout, of wil je samenwerken? We horen graag van je.
      </p>

      <div className="mt-8 space-y-4">
        <ContactItem label="E-mail" value="hallo@opgietingen.nl" href="mailto:hallo@opgietingen.nl" />
        <ContactItem label="Voor sauna's" value="Bekijk de mogelijkheden" href="/voor-saunas" />
      </div>

      <p className="mt-8 text-sm text-ink-faint">
        Een contactformulier volgt in een latere versie. Voor nu bereik je ons het snelst via e-mail.
      </p>
    </div>
  );
}

function ContactItem({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <div className="flex items-center justify-between rounded-[--radius-card] border border-sand bg-surface px-5 py-4">
      <span className="text-sm font-medium text-ink-faint">{label}</span>
      <a href={href} className="font-medium text-ember hover:underline">
        {value}
      </a>
    </div>
  );
}
