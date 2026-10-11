import type { BillingPeriod, GeoInput, GeoOffer } from "./types";
import { assertValidGeoInput } from "./validate";

const BILLING_LABEL: Record<BillingPeriod, string> = {
  one_time: "one-time",
  monthly: "per month",
  yearly: "per year",
};

/** Single-line text for headings, list items and the blockquote. */
function inline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function formatPrice(
  offer: Pick<GeoOffer, "price" | "currency">,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: offer.currency,
  }).format(offer.price);
}

function offerLine(offer: GeoOffer): string {
  const name = offer.url
    ? `[${inline(offer.name)}](${offer.url})`
    : `**${inline(offer.name)}**`;
  const description = offer.description
    ? ` — ${inline(offer.description)}`
    : "";
  // A free offer has no billing period worth stating ("$0.00 per month").
  const price =
    offer.price === 0
      ? "Free"
      : `${formatPrice(offer)} ${BILLING_LABEL[offer.billing]}`;
  return `- ${name}: ${price}${description}`;
}

/**
 * Renders the `llms.txt` markdown (https://llmstxt.org): an H1 name, a
 * blockquote summary, then H2 sections. Every offer and FAQ entry in the
 * input appears in the output; nothing is added that the input doesn't state.
 */
export function generateLlmsTxt(input: GeoInput): string {
  assertValidGeoInput(input);
  const { entity, offers, faqs, claims = [], links = [] } = input;
  const out: string[] = [
    `# ${inline(entity.name)}`,
    "",
    `> ${inline(entity.description)}`,
    "",
    `Website: ${entity.url}`,
  ];

  if (claims.length > 0) {
    out.push(
      "",
      "## Key facts",
      "",
      ...claims.map((claim) => `- ${inline(claim)}`),
    );
  }

  if (offers.length > 0) {
    out.push("", "## Pricing", "", ...offers.map(offerLine));
  }

  if (faqs.length > 0) {
    out.push("", "## FAQ");
    for (const faq of faqs)
      out.push("", `### ${inline(faq.question)}`, "", faq.answer.trim());
  }

  if (links.length > 0) {
    out.push(
      "",
      "## Links",
      "",
      ...links.map(
        (link) =>
          `- [${inline(link.title)}](${link.url})${link.description ? `: ${inline(link.description)}` : ""}`,
      ),
    );
  }

  return `${out.join("\n")}\n`;
}
