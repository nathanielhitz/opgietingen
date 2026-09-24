// scripts/lib/blob.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { BEWAAR_WEKEN, blobBeschikbaar, blobPad, verouderdePaden } from "./blob";

test("blobPad: social/<plaatsingsdag>/<post-id>.mp4, vreemde tekens uit de id gestript", () => {
  assert.equal(blobPad({ id: "weekend-2026-W40", plaatsingsdag: "2026-10-02" }), "social/2026-10-02/weekend-2026-W40.mp4");
  assert.equal(blobPad({ id: "../x/uitgelicht-a", plaatsingsdag: "2026-10-02" }), "social/2026-10-02/xuitgelicht-a.mp4");
});

test("verouderdePaden: ouder dan acht weken vóór vandaag, exact op de grens blijft staan, andere prefixen en onzin genegeerd", () => {
  const paden = [
    "social/2026-09-27/weekend-2026-W39.mp4", // 57 dagen oud: weg
    "social/2026-09-28/nieuw-2026-W40.mp4", // precies 56 dagen: blijft
    "social/2026-11-20/weekend-2026-W47.mp4", // vers
    "ander/2026-01-01/x.mp4", // andere prefix
    "social/onzin/x.mp4", // geen datummap
  ];
  assert.deepEqual(verouderdePaden(paden, "2026-11-23"), ["social/2026-09-27/weekend-2026-W39.mp4"]);
  assert.deepEqual(verouderdePaden(paden, "2026-11-23", 7), ["social/2026-09-27/weekend-2026-W39.mp4", "social/2026-09-28/nieuw-2026-W40.mp4"]);
  assert.equal(BEWAAR_WEKEN, 8);
});

test("blobBeschikbaar: alleen met een niet-lege BLOB_READ_WRITE_TOKEN", () => {
  assert.equal(blobBeschikbaar({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_x" }), true);
  assert.equal(blobBeschikbaar({ BLOB_READ_WRITE_TOKEN: "" }), false);
  assert.equal(blobBeschikbaar({}), false);
});
