import { describe, expect, test } from "bun:test";
import { formatPrice, generateLlmsTxt } from "./extractor";
import { sampleInput } from "./fixtures";
import { GeoInputError } from "./validate";

describe("generateLlmsTxt", () => {
  const output = generateLlmsTxt(sampleInput);

  test("follows the llms.txt shape: H1 name, blockquote summary, H2 sections", () => {
    const lines = output.split("\n");
    expect(lines[0]).toBe("# Acme Kit");
    expect(lines[2]).toBe(`> ${sampleInput.entity.description}`);
    expect(output.match(/^# /gm)).toHaveLength(1);
    for (const section of ["Key facts", "Pricing", "FAQ", "Links"])
      expect(output).toContain(`\n## ${section}\n`);
    expect(output.endsWith("\n")).toBe(true);
  });

  test("contains every offer with the configured price", () => {
    for (const offer of sampleInput.offers) {
      const line = output
        .split("\n")
        .find((l) => l.startsWith("- ") && l.includes(offer.name));
      expect(line).toBeDefined();
      expect(line).toContain(formatPrice(offer));
    }
    expect(output).toContain("$249.50 one-time");
    expect(output).toContain("€19.00 per month");
    expect(output).toContain("$190.00 per year");
  });

  test("contains every FAQ question as a heading and its full answer", () => {
    for (const faq of sampleInput.faqs) {
      expect(output).toContain(`### ${faq.question.replace(/\s+/g, " ")}`);
      expect(output).toContain(faq.answer);
    }
  });

  test("a $0 offer reads as Free, without a billing period", () => {
    const free = generateLlmsTxt({
      ...sampleInput,
      offers: [
        { name: "Hobby", price: 0, currency: "USD", billing: "monthly" },
      ],
    });
    expect(free).toContain("- **Hobby**: Free\n");
  });

  test("omits sections that have no entries", () => {
    const bare = generateLlmsTxt({
      ...sampleInput,
      claims: [],
      offers: [],
      faqs: [],
      links: [],
    });
    expect(bare).not.toContain("## ");
  });

  test("rejects input that would publish a wrong or missing price", () => {
    expect(() =>
      generateLlmsTxt({
        ...sampleInput,
        offers: [{ ...sampleInput.offers[0]!, price: Number.NaN }],
      }),
    ).toThrow(GeoInputError);
    expect(() =>
      generateLlmsTxt({
        ...sampleInput,
        offers: [{ ...sampleInput.offers[0]!, currency: "usd" }],
      }),
    ).toThrow(/ISO 4217/);
    expect(() =>
      generateLlmsTxt({
        ...sampleInput,
        entity: { ...sampleInput.entity, url: "acme.example" },
      }),
    ).toThrow(/entity\.url/);
  });
});
