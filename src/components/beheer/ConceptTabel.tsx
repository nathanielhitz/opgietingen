import type { RunEvent } from "@/lib/scrape-runs";

export interface ConceptRij extends RunEvent {
  saunaNaam: string;
}

export function ConceptTabel({ rijen }: { rijen: ConceptRij[] }) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Te beoordelen ({rijen.length})</h2>
      {rijen.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">Niets te beoordelen uit deze run.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-semibold">Event</th>
                <th className="py-2 pr-3 font-semibold">Sauna</th>
                <th className="py-2 pr-3 font-semibold">Reden</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rijen.map((r) => (
                <tr key={r.slug} className="border-t border-sand align-top">
                  <td className="py-2 pr-3 font-medium text-ink">{r.slug}</td>
                  <td className="py-2 pr-3 text-ink-soft">{r.saunaNaam}</td>
                  <td className="py-2 pr-3 text-ink-soft">{r.reden ?? "—"}</td>
                  <td className="py-2 text-right">
                    {/* Gewone <a>: /keystatic is een client-SPA achter een catch-all; een volledige paginalaad is daar het veiligst. */}
                    <a className="font-medium text-ember underline underline-offset-2" href={`/keystatic/collection/events/item/${r.slug}`}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
