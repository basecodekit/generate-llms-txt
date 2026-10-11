import { describe, expect, test } from "bun:test";
import { generateLlmsTxt } from "./extractor";
import { sampleInput } from "./fixtures";
import {
  type JsonLd,
  faqPageJsonLd,
  generateJsonLd,
  serializeJsonLd,
} from "./jsonld";

/**
 * Required properties per type, from Schema.org plus the fields Google's
 * rich-result validators require. Every nested node is checked as well.
 */
const REQUIRED: Record<string, string[]> = {
  SoftwareApplication: [
    "name",
    "offers",
    "applicationCategory",
    "operatingSystem",
  ],
  Product: ["name", "offers"],
  Offer: ["price", "priceCurrency"],
  UnitPriceSpecification: ["price", "priceCurrency"],
  FAQPage: ["mainEntity"],
  Question: ["name", "acceptedAnswer"],
  Answer: ["text"],
  Brand: ["name"],
};

function schemaProblems(
  node: unknown,
  path: string,
  problems: string[] = [],
): string[] {
  if (Array.isArray(node))
    node.forEach((child, i) =>
      schemaProblems(child, `${path}[${i}]`, problems),
    );
  else if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if ("@type" in record) {
      const type = record["@type"] as string;
      const required = REQUIRED[type];
      if (!required) problems.push(`${path}: unexpected @type ${type}`);
      for (const key of required ?? []) {
        const value = record[key];
        if (
          value === undefined ||
          value === "" ||
          (Array.isArray(value) && value.length === 0)
        )
          problems.push(`${path}: ${type} is missing ${key}`);
      }
    }
    for (const [key, value] of Object.entries(record))
      schemaProblems(value, `${path}.${key}`, problems);
  }
  return problems;
}

describe("generateJsonLd", () => {
  const blocks = generateJsonLd(sampleInput);

  test("emits SoftwareApplication, Product and FAQPage blocks with the Schema.org context", () => {
    expect(blocks.map((b) => b["@type"])).toEqual([
      "SoftwareApplication",
      "Product",
      "FAQPage",
    ]);
    for (const block of blocks)
      expect(block["@context"]).toBe("https://schema.org");
  });

  test("every node has a known @type and its required properties", () => {
    expect(
      blocks.flatMap((block, i) => schemaProblems(block, `blocks[${i}]`)),
    ).toEqual([]);
  });

  test("drops the FAQPage block when there are no FAQs", () => {
    expect(
      generateJsonLd({ ...sampleInput, faqs: [] }).map((b) => b["@type"]),
    ).not.toContain("FAQPage");
  });

  test("FAQPage carries every question and answer", () => {
    const faq = faqPageJsonLd(sampleInput.faqs);
    expect(faq.mainEntity).toEqual(
      sampleInput.faqs.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    );
  });
});

describe("generated prices never drift from the configured price", () => {
  const llmsTxt = generateLlmsTxt(sampleInput);
  const [app, product] = generateJsonLd(sampleInput) as [JsonLd, JsonLd];

  for (const block of [app, product]) {
    test(`${block["@type"]} offers match the config one-to-one`, () => {
      const offers = block.offers as JsonLd[];
      expect(offers).toHaveLength(sampleInput.offers.length);
      sampleInput.offers.forEach((configured, i) => {
        const offer = offers[i]!;
        expect(offer.name).toBe(configured.name);
        expect(offer.price).toBe(configured.price);
        expect(offer.priceCurrency).toBe(configured.currency);
        const spec = offer.priceSpecification as JsonLd | undefined;
        if (configured.billing === "one_time") expect(spec).toBeUndefined();
        else {
          expect(spec?.price).toBe(configured.price);
          expect(spec?.unitCode).toBe(
            configured.billing === "monthly" ? "MON" : "ANN",
          );
        }
      });
    });
  }

  test("a changed config price changes both outputs", () => {
    const changed = {
      ...sampleInput,
      offers: sampleInput.offers.map((o) => ({ ...o, price: o.price + 1 })),
    };
    const [changedApp] = generateJsonLd(changed) as [JsonLd];
    expect((changedApp.offers as JsonLd[]).map((o) => o.price)).toEqual(
      changed.offers.map((o) => o.price),
    );
    expect(generateLlmsTxt(changed)).not.toBe(llmsTxt);
    expect(generateLlmsTxt(changed)).toContain("$150.00 one-time");
  });
});

describe("serializeJsonLd", () => {
  test("cannot close the surrounding script tag", () => {
    const hostile = {
      ...sampleInput,
      entity: {
        ...sampleInput.entity,
        description: "</script><script>alert(1)</script> & co",
      },
    };
    const json = serializeJsonLd(generateJsonLd(hostile));
    expect(json).not.toContain("</script");
    expect(json).not.toContain("<");
    expect(JSON.parse(json)[0].description).toBe(hostile.entity.description);
  });
});
