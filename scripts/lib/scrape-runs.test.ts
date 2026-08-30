// scripts/lib/scrape-runs.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  leesScrapeRuns,
  runTotalen,
  weekTrend,
  type ScrapeRun,
} from "../../src/lib/scrape-runs";

const bron = (id: string, over: Partial<ScrapeRun["kanalen"]["website"]["bronnen"][number]> = {}) => ({
  id, kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0,
  fout: null, methode: "statisch" as const, ...over,
});

const run: ScrapeRun = {
  id: "2026-08-31T06:04:12Z",
  workflowRun: "1",
  duurSeconden: 200,
  autopublish: true,
  backfill: false,
  fout: null,
  bronnen: { gecontroleerd: 41, statusWijzigingen: [{ id: "x", van: "actief", naar: "kapot", notitie: "DNS" }] },
  kanalen: {
    website: { bronnen: [bron("a", { kandidaten: 4, dedup: 2, concept: 2, afgekeurd: 1 }), bron("b", { fout: "robots", methode: "geen" })] },
    facebook: { bronnen: [bron("c", { kandidaten: 3, dedup: 1, concept: 1, gepubliceerd: 1, methode: "claude", posts: 6 })] },
    mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] },
  },
  events: [
    { slug: "a-x-2026-09-01", kanaal: "website", bron: "a", status: "concept", reden: "r" },
    { slug: "a-y-2026-09-02", kanaal: "website", bron: "a", status: "concept" },
    { slug: "c-z-2026-09-03", kanaal: "facebook", bron: "c", status: "concept" },
    { slug: "c-w-2026-09-04", kanaal: "facebook", bron: "c", status: "gepubliceerd" },
  ],
};

test("runTotalen telt over alle kanalen en telt fouten en statuswijzigingen", () => {
  const t = runTotalen(run);
  assert.equal(t.kandidaten, 7);
  assert.equal(t.dedup, 3);
  assert.equal(t.concept, 3);
  assert.equal(t.gepubliceerd, 1);
  assert.equal(t.afgekeurd, 1);
  assert.equal(t.fouten, 2); // 1 bronfout + 1 statuswijziging
  assert.equal(t.bronnen, 3);
  assert.equal(t.perKanaal.facebook.gepubliceerd, 1);
  assert.equal(t.perKanaal.mail.kandidaten, 0);
});

test("runTotalen leidt bij backfill-records concept/gepubliceerd af uit events", () => {
  const b: ScrapeRun = { ...run, backfill: true, kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] }, mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] } } };
  const t = runTotalen(b);
  assert.equal(t.concept, 3);
  assert.equal(t.gepubliceerd, 1);
  assert.equal(t.kandidaten, null);
});

test("weekTrend geeft de laatste n runs, oud → nieuw", () => {
  const runs = [1, 2, 3].map((i) => ({ ...run, id: `2026-08-0${i}T06:00:00Z` }));
  const trend = weekTrend(runs, 2);
  assert.deepEqual(trend.map((p) => p.id), ["2026-08-02T06:00:00Z", "2026-08-03T06:00:00Z"]);
  assert.equal(trend[0].gepubliceerd, 1);
  assert.equal(trend[0].backfill, false);
});

test("leesScrapeRuns geeft [] zonder bestand en sorteert op id", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "runs-"));
  assert.deepEqual(leesScrapeRuns(path.join(tmp, "geen.json")), []);
  const p = path.join(tmp, "runs.json");
  fs.writeFileSync(p, JSON.stringify({ runs: [{ ...run, id: "2026-08-10T00:00:00Z" }, run] }));
  assert.deepEqual(leesScrapeRuns(p).map((r) => r.id), ["2026-08-10T00:00:00Z", "2026-08-31T06:04:12Z"]);
  fs.writeFileSync(p, "kapot");
  assert.deepEqual(leesScrapeRuns(p), []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("weekTrend dempt backfill-records: kandidaten null, backfill true", () => {
  const bf: ScrapeRun = {
    ...run,
    id: "2026-08-01T06:00:00Z",
    backfill: true,
    kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] }, mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] } },
  };
  const trend = weekTrend([bf, { ...run, id: "2026-08-02T06:00:00Z" }], 12);
  assert.equal(trend[0].backfill, true);
  assert.equal(trend[0].kandidaten, null);
  assert.equal(trend[0].gepubliceerd, 1); // uit events[]
  assert.equal(trend[1].kandidaten, 7);   // tellers van een echte run
});

test("leesScrapeRuns weert half geschreven records en runTotalen overleeft een lege run", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "runs-half-"));
  const p = path.join(tmp, "runs.json");
  const half = { ...run, id: "2026-08-05T00:00:00Z", kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] } } };
  const leeg: ScrapeRun = {
    ...run, id: "2026-08-06T00:00:00Z", fout: "geen metrics", events: [],
    bronnen: { gecontroleerd: null, statusWijzigingen: [] },
    kanalen: { website: { bronnen: [] }, facebook: { bronnen: [] }, mail: { mails: 0, onbekendeAfzenders: 0, bronnen: [] } },
  };
  fs.writeFileSync(p, JSON.stringify({ runs: [half, leeg] }));
  const runs = leesScrapeRuns(p);
  assert.deepEqual(runs.map((r) => r.id), ["2026-08-06T00:00:00Z"]);
  const t = runTotalen(runs[0]);
  assert.equal(t.kandidaten, 0); // lege niet-backfill-run telt 0, niet null
  assert.equal(t.fouten, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});
