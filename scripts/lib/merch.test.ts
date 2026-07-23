import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseMerchProduct,
  isBestelbaar,
  getMerchProduct,
  formatEuro,
  type MerchProduct,
} from "../../src/lib/merch";

const basis = {
  naam: "Testhoed",
  prijs: 34.95,
  verzendkosten: 0,
  afbeeldingen: ["/images/merch/testhoed.jpg"],
  betaalUrl: "https://payment-links.mollie.com/payment/test",
  productStatus: "leverbaar",
  bijgewerkt: "2026-07-23",
};

test("parseMerchProduct parseert volledige frontmatter", () => {
  const product = parseMerchProduct(basis, "Het verhaal.", "testhoed");
  assert.ok(product);
  assert.equal(product.slug, "testhoed");
  assert.equal(product.naam, "Testhoed");
  assert.equal(product.prijs, 34.95);
  assert.equal(product.verzendkosten, 0);
  assert.deepEqual(product.afbeeldingen, ["/images/merch/testhoed.jpg"]);
  assert.equal(product.productStatus, "leverbaar");
  assert.equal(product.bijgewerkt, "2026-07-23");
  assert.equal(product.body, "Het verhaal.");
});

test("parseMerchProduct valt terug op binnenkort bij onbekende of ontbrekende status", () => {
  const raar = parseMerchProduct({ ...basis, productStatus: "pre-order" }, "", "x");
  assert.equal(raar?.productStatus, "binnenkort");
  const leeg = parseMerchProduct({ ...basis, productStatus: undefined }, "", "x");
  assert.equal(leeg?.productStatus, "binnenkort");
});

test("parseMerchProduct keurt af zonder naam of geldige prijs", () => {
  assert.equal(parseMerchProduct({ ...basis, naam: undefined }, "", "x"), null);
  assert.equal(parseMerchProduct({ ...basis, prijs: "gratis" }, "", "x"), null);
  assert.equal(parseMerchProduct({ ...basis, prijs: 0 }, "", "x"), null);
});

test("parseMerchProduct normaliseert een YAML-Date naar een ISO-string", () => {
  const product = parseMerchProduct(
    { ...basis, bijgewerkt: new Date(Date.UTC(2026, 6, 23)) },
    "",
    "x",
  );
  assert.equal(product?.bijgewerkt, "2026-07-23");
});

test("isBestelbaar alleen bij leverbaar met betaallink", () => {
  const leverbaar = parseMerchProduct(basis, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(leverbaar), true);
  const binnenkort = parseMerchProduct({ ...basis, productStatus: "binnenkort" }, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(binnenkort), false);
  const zonderLink = parseMerchProduct({ ...basis, betaalUrl: undefined }, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(zonderLink), false);
  const uitverkocht = parseMerchProduct({ ...basis, productStatus: "uitverkocht" }, "", "x") as MerchProduct;
  assert.equal(isBestelbaar(uitverkocht), false);
});

test("formatEuro formatteert nl-NL met vaste spatie", () => {
  assert.equal(formatEuro(34.95), "€ 34,95");
  assert.equal(formatEuro(5), "€ 5,00");
});

test("getMerchProduct leest het echte saunahoed-bestand", () => {
  const product = getMerchProduct("saunahoed");
  assert.ok(product, "verwacht content/merch/saunahoed.mdx");
  assert.equal(product.slug, "saunahoed");
  assert.ok(product.prijs > 0);
  assert.ok(product.body.length > 50, "productverhaal mag niet leeg zijn");
});

test("getMerchProduct geeft undefined voor onbekende of onveilige slug", () => {
  assert.equal(getMerchProduct("bestaat-niet"), undefined);
  assert.equal(getMerchProduct("../saunas/thermen-bussloo"), undefined);
});
