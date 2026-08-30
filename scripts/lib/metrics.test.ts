// scripts/lib/metrics.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { maakMetrics, leesMetrics, legeTeller, naarMethode, metricsBestandStatus, METRICS_BESTAND } from "./metrics";

// maakMetrics schrijft naar process.cwd()/scrape-metrics.json; de tests draaien
// in een lege tijdelijke map zodat ze het echte bestand niet raken.
function withTmpCwd(fn: () => void): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "metrics-test-"));
  const orig = process.cwd();
  process.chdir(tmp);
  try { fn(); } finally { process.chdir(orig); fs.rmSync(tmp, { recursive: true, force: true }); }
}

test("legeTeller start op nul met methode 'geen'", () => {
  assert.deepEqual(legeTeller("a"), {
    id: "a", kandidaten: 0, dedup: 0, verleden: 0, afgekeurd: 0, concept: 0, gepubliceerd: 0, fout: null, methode: "geen",
  });
});

test("naarMethode vertaalt de extractiemethode van de scraper", () => {
  assert.equal(naarMethode("plain-claude"), "statisch");
  assert.equal(naarMethode("firecrawl-json"), "firecrawl");
  assert.equal(naarMethode("claude-fallback"), "claude");
  assert.equal(naarMethode("none"), "geen");
});

test("meldingen van meerdere scripts komen samen in één bestand", () => {
  withTmpCwd(() => {
    const m1 = maakMetrics({ actief: true });
    m1.verify({ gecontroleerd: 41 });
    m1.bronStatus({ id: "x", van: "actief", naar: "kapot", notitie: "DNS" });
    m1.bron("website", { ...legeTeller("a"), kandidaten: 2, concept: 2, methode: "statisch" });
    m1.event({ slug: "a-1", kanaal: "website", bron: "a", status: "concept", reden: "r" });
    const m2 = maakMetrics({ actief: true }); // volgend script in dezelfde run
    m2.bron("facebook", { ...legeTeller("c"), posts: 3 });
    m2.mail({ mails: 2, onbekendeAfzenders: 1 });
    const data = leesMetrics();
    assert.ok(data);
    assert.equal(data.verify?.gecontroleerd, 41);
    assert.equal(data.bronStatusWijzigingen.length, 1);
    assert.deepEqual(data.bronResultaten.map((b) => [b.kanaal, b.id]), [["website", "a"], ["facebook", "c"]]);
    assert.equal(data.events.length, 1);
    assert.deepEqual(data.mail, { mails: 2, onbekendeAfzenders: 1 });
  });
});

test("inactief (dry-run) schrijft niets", () => {
  withTmpCwd(() => {
    const m = maakMetrics({ actief: false });
    m.bron("website", legeTeller("a"));
    m.event({ slug: "a-1", kanaal: "website", bron: "a", status: "concept" });
    assert.equal(fs.existsSync(METRICS_BESTAND()), false);
    assert.equal(leesMetrics(), null);
  });
});

test("een onleesbaar bestand wordt met een waarschuwing overschreven, nooit gegooid", () => {
  withTmpCwd(() => {
    fs.writeFileSync(METRICS_BESTAND(), "geen json");
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (msg: string) => { warns.push(String(msg)); };
    try {
      maakMetrics({ actief: true }).bron("website", legeTeller("a"));
    } finally { console.warn = orig; }
    assert.equal(warns.length, 1);
    assert.equal(leesMetrics()?.bronResultaten.length, 1);
  });
});

test("een schrijffout wordt geslikt", () => {
  withTmpCwd(() => {
    fs.mkdirSync(METRICS_BESTAND()); // pad is nu een map → writeFileSync faalt
    const warns: string[] = [];
    const orig = console.warn;
    console.warn = (msg: string) => { warns.push(String(msg)); };
    try {
      assert.doesNotThrow(() => maakMetrics({ actief: true }).bron("website", legeTeller("a")));
    } finally { console.warn = orig; }
    assert.ok(warns.some((w) => w.includes("niet weggeschreven")), "spec eist een console.warn bij schrijffout");
  });
});

test("een bestand met geldige JSON maar verkeerde vorm blokkeert de run niet", () => {
  withTmpCwd(() => {
    fs.writeFileSync(METRICS_BESTAND(), JSON.stringify({ bronResultaten: {}, events: null }));
    const orig = console.warn;
    console.warn = () => {};
    try {
      assert.doesNotThrow(() => maakMetrics({ actief: true }).bron("website", legeTeller("a")));
    } finally { console.warn = orig; }
    assert.equal(leesMetrics()?.bronResultaten.length, 1); // vorm hersteld, melding bewaard
  });
});

test("metricsBestandStatus onderscheidt geen bestand, onleesbaar en ok", () => {
  withTmpCwd(() => {
    assert.equal(metricsBestandStatus(), "geen");
    fs.writeFileSync(METRICS_BESTAND(), "geen json");
    assert.equal(metricsBestandStatus(), "onleesbaar");
    fs.writeFileSync(METRICS_BESTAND(), JSON.stringify({ bronResultaten: [], events: [] }));
    assert.equal(metricsBestandStatus(), "ok");
  });
});
