import { describe, expect, test } from "bun:test";
import { sampleInput } from "../fixtures";
import { type JsonLd, generateJsonLd } from "../jsonld";
import { validateJsonLd } from "./validate";

const offer = { "@type": "Offer", price: 9, priceCurrency: "USD" };
const product = (extra: Record<string, unknown> = {}): JsonLd => ({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Kit",
  offers: [offer],
  ...extra,
});
const messages = (data: JsonLd | JsonLd[]) =>
  validateJsonLd(data).errors.map((e) => `${e.path}: ${e.message}`);

describe("validateJsonLd", () => {
  test("everything generateJsonLd emits is valid Schema.org with zero errors", () => {
    const result = validateJsonLd(generateJsonLd(sampleInput));
    expect(result.errors).toEqual([]);
    // Only the honest "no ratings" note for SoftwareApplication remains.
    expect(result.warnings.map((w) => w.path)).toEqual(["[0]"]);
  });

  test("a misspelled property is an error", () => {
    expect(messages(product({ nmae: "Kit" }))).toEqual([
      "$.nmae: unknown property nmae",
    ]);
  });

  test("a property used on the wrong type is an error", () => {
    expect(messages(product({ priceCurrency: "USD" }))).toEqual([
      "$.priceCurrency: priceCurrency is not a property of Product",
    ]);
  });

  test("an unknown type is an error", () => {
    expect(
      messages(product({ brand: { "@type": "Brnad", name: "x" } })),
    ).toEqual(["$.brand: unknown type Brnad"]);
  });

  test("a node of the wrong class for the property's range is an error", () => {
    expect(
      messages(product({ offers: [{ "@type": "Brand", name: "x" }] })),
    ).toContainEqual("$.offers[0]: Brand does not fit range Demand | Offer");
  });

  test("a primitive of the wrong data type is an error", () => {
    expect(
      messages(product({ offers: [{ ...offer, price: true }] })),
    ).toContainEqual(
      "$.offers[0].price: true (boolean) does not fit range Number | Text",
    );
  });

  test("enumeration members are accepted by URL, and only for their enumeration", () => {
    const withAvailability = (availability: string) =>
      messages(product({ offers: [{ ...offer, availability }] }));
    expect(withAvailability("https://schema.org/InStock")).toEqual([]);
    expect(withAvailability("https://schema.org/Monday")).toHaveLength(1);
  });

  test("subclasses fit a parent-class range", () => {
    // UnitPriceSpecification is a PriceSpecification.
    const spec = {
      "@type": "UnitPriceSpecification",
      price: 9,
      priceCurrency: "USD",
      billingDuration: 1,
      unitCode: "MON",
    };
    expect(
      messages(product({ offers: [{ ...offer, priceSpecification: spec }] })),
    ).toEqual([]);
  });

  test("the @context must be Schema.org", () => {
    expect(
      messages(product({ "@context": "https://example.com" })),
    ).toContainEqual(
      '$: @context must be "https://schema.org", got "https://example.com"',
    );
  });

  describe("Google rich-result requirements", () => {
    test("Product needs offers, review or aggregateRating", () => {
      const { offers: _, ...bare } = product();
      expect(messages(bare as JsonLd)).toContainEqual(
        "$: Google requires one of offers, review or aggregateRating on Product",
      );
    });

    test("an Offer needs a price", () => {
      expect(
        messages(
          product({ offers: [{ "@type": "Offer", priceCurrency: "USD" }] }),
        ),
      ).toContainEqual(
        "$.offers[0]: Google requires price or priceSpecification.price",
      );
    });

    test("a missing priceCurrency is only a warning", () => {
      const result = validateJsonLd(
        product({ offers: [{ "@type": "Offer", price: 9 }] }),
      );
      expect(result.errors).toEqual([]);
      expect(result.warnings.map((w) => w.message)).toContain(
        "Google recommends priceCurrency",
      );
    });
  });
});
