// scripts/lib/run-record.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { bouwRunRecord, historieVerdacht, voegRunToe, samenvatting } from "./run-record";
import { legeTeller, type MetricsBestand } from "./metrics";

const ctx = { id: "2026-08-31T06:04:12Z", workflowRun: "123", duurSeconden: 221, autopublish: true };

const metrics: MetricsBestand = {
  verify: { gecontroleerd: 41 },
  bronStatusWijzigingen: [{ id: "x", van: "actief", naar: "kapot", notitie: "DNS" }],
  bronResultaten: [
    { ...legeTeller("a"), kanaal: "website", kandidaten: 4, dedup: 2, concept: 2, afgekeurd: 1, methode: "statisch" },
    { ...legeTeller("c"), kanaal: "facebook", kandidaten: 1, gepubliceerd: 1, methode: "claude", posts: 5 },
    { ...legeTeller("onbekend"), kanaal: "mail", kandidaten: 1, concept: 1, methode: "claude" },
  ],
  events: [
    { slug: "a-1", kanaal: "website", bron: "a", status: "concept", reden: "r" },
    { slug: "a-2", kanaal: "website", bron: "a", status: "concept" },
    { slug: "c-1", kanaal: "facebook", bron: "c", status: "gepubliceerd" },
    { slug: "m-1", kanaal: "mail", bron: "onbekend", status: "concept" },
  ],
  mail: { mails: 2, onbekendeAfzenders: 1 },
};

test("bouwRunRecord groepeert per kanaal en neemt context over", () => {
  const r = bouwRunRecord(metrics, ctx);
  assert.equal(r.id, ctx.id);
  assert.equal(r.workflowRun, "123");
  assert.equal(r.backfill, false);
  assert.equal(r.fout, null);
  assert.equal(r.bronnen.gecontroleerd, 41);
  assert.equal(r.kanalen.website.bronnen.length, 1);
  assert.equal(r.kanalen.facebook.bronnen[0].posts, 5);
  assert.equal(r.kanalen.mail.mails, 2);
  assert.equal(r.events.length, 4);
  assert.equal("kanaal" in r.kanalen.website.bronnen[0], false, "kanaal-veld hoort niet in het record");
});

test("zonder metrics ontstaat een leeg record met fout 'geen metrics'", () => {
  const r = bouwRunRecord(null, ctx);
  assert.equal(r.fout, "geen metrics");
  assert.deepEqual(r.events, []);
  assert.equal(r.kanalen.mail.mails, 0);
  assert.equal(r.bronnen.gecontroleerd, null);
});

test("voegRunToe is idempotent op id en sorteert oud → nieuw", () => {
  const oud = bouwRunRecord(null, { ...ctx, id: "2026-08-24T06:00:00Z" });
  const nieuw = bouwRunRecord(metrics, ctx);
  const runs = voegRunToe([nieuw, oud], { ...nieuw, duurSeconden: 999 });
  assert.deepEqual(runs.map((r) => r.id), ["2026-08-24T06:00:00Z", "2026-08-31T06:04:12Z"]);
  assert.equal(runs[1].duurSeconden, 999);
});

test("samenvatting is de commit-regel", () => {
  // Correctie t.o.v. de opdracht: geen enkele bron in `metrics` heeft `fout`
  // gezet, dus de eerste samenvatting mag geen bronfout tellen. Het
  // "1 bronfout"-geval krijgt een eigen fixture met bron "a" op fout.
  assert.equal(samenvatting(bouwRunRecord(metrics, ctx)), "6 kandidaten, 1 gepubliceerd, 3 concept");
  assert.equal(samenvatting(bouwRunRecord(null, ctx)), "geen metrics");

  const metricsMetBronfout: MetricsBestand = {
    ...metrics,
    bronResultaten: metrics.bronResultaten.map((b) => (b.id === "a" ? { ...b, fout: "robots" } : b)),
  };
  assert.equal(
    samenvatting(bouwRunRecord(metricsMetBronfout, ctx)),
    "6 kandidaten, 1 gepubliceerd, 3 concept, 1 bronfout",
  );
});

test("historieVerdacht stopt bij een corrupt bestand, niet bij een echt lege historie", () => {
  assert.equal(historieVerdacht(null, []), false); // geen bestand → eerste run
  assert.equal(historieVerdacht('{"runs":[]}', []), false); // geldig leeg
  assert.equal(historieVerdacht('{"runs":[{"id":"x"', []), true); // afgekapte JSON
  assert.equal(historieVerdacht('{"runs":[{"id":"x"}]}', []), true); // half record, geweerd door de loader
  assert.equal(historieVerdacht('{"runs":[]}', [bouwRunRecord(null, ctx)]), false);
});
