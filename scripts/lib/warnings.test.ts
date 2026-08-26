import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendScrapeWarnings } from "./warnings";

// appendScrapeWarnings schrijft naar process.cwd()/scrape-warnings.json; de
// tests draaien tijdelijk in een lege map zodat ze het echte bestand niet raken.
function withTmpCwd(fn: () => void): void {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "warnings-test-"));
  const origCwd = process.cwd();
  process.chdir(tmp);
  try {
    fn();
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test("appendScrapeWarnings maakt het bestand aan als het nog niet bestaat", () => {
  withTmpCwd(() => {
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna A", melding: "test" }]);
    const data = JSON.parse(fs.readFileSync("scrape-warnings.json", "utf-8"));
    assert.equal(data.run, "2026-08-26");
    assert.deepEqual(data.warnings, [{ bron: "Sauna A", melding: "test" }]);
  });
});

test("appendScrapeWarnings voegt toe aan een bestaand bestand i.p.v. te overschrijven", () => {
  withTmpCwd(() => {
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna A", melding: "eerste" }]);
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna B", melding: "tweede" }]);
    const data = JSON.parse(fs.readFileSync("scrape-warnings.json", "utf-8"));
    assert.deepEqual(data.warnings, [
      { bron: "Sauna A", melding: "eerste" },
      { bron: "Sauna B", melding: "tweede" },
    ]);
  });
});

test("appendScrapeWarnings start opnieuw als het bestaande bestand onleesbaar is", () => {
  withTmpCwd(() => {
    fs.writeFileSync("scrape-warnings.json", "geen geldige JSON");
    appendScrapeWarnings("2026-08-26", [{ bron: "Sauna A", melding: "test" }]);
    const data = JSON.parse(fs.readFileSync("scrape-warnings.json", "utf-8"));
    assert.deepEqual(data.warnings, [{ bron: "Sauna A", melding: "test" }]);
  });
});
