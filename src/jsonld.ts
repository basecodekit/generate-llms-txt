import type { GeoEntity, GeoFaq, GeoInput, GeoOffer } from "./types";
import { assertValidGeoInput } from "./validate";

const CONTEXT = "https://schema.org";

/** UN/CEFACT codes Schema.org uses for a recurring price's unit. */
const UNIT_CODE = { monthly: "MON", yearly: "ANN" } as const;

export type JsonLd = {
  "@context"?: string;
  "@type": string;
  [key: string]: unknown;
};

export function offerJsonLd(
  offer: GeoOffer,
  entity?: Pick<GeoEntity, "url">,
): JsonLd {
  const node: JsonLd = {
    "@type": "Offer",
    name: offer.name,
    price: offer.price,
    priceCurrency: offer.currency,
    availability: "https://schema.org/InStock",
  };
  if (offer.description) node.description = offer.description;
  const url = offer.url ?? entity?.url;
  if (url) node.url = url;
  if (offer.billing !== "one_time") {
    node.priceSpecification = {
      "@type": "UnitPriceSpecification",
      price: offer.price,
      priceCurrency: offer.currency,
      billingDuration: 1,
      unitCode: UNIT_CODE[offer.billing],
    };
  }
  return node;
}

function entityFields(entity: GeoEntity): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    name: entity.name,
    description: entity.description,
    url: entity.url,
  };
  if (entity.logo) fields.image = entity.logo;
  if (entity.sameAs?.length) fields.sameAs = entity.sameAs;
  return fields;
}

export function productJsonLd(
  input: Pick<GeoInput, "entity" | "offers">,
): JsonLd {
  assertValidGeoInput({ faqs: [], ...input });
  return {
    "@context": CONTEXT,
    "@type": "Product",
    ...entityFields(input.entity),
    brand: { "@type": "Brand", name: input.entity.name },
    offers: input.offers.map((offer) => offerJsonLd(offer, input.entity)),
  };
}

export function softwareApplicationJsonLd(
  input: Pick<GeoInput, "entity" | "offers">,
): JsonLd {
  assertValidGeoInput({ faqs: [], ...input });
  const { entity } = input;
  return {
    "@context": CONTEXT,
    "@type": "SoftwareApplication",
    ...entityFields(entity),
    applicationCategory: entity.applicationCategory ?? "DeveloperApplication",
    operatingSystem: entity.operatingSystem ?? "Web",
    offers: input.offers.map((offer) => offerJsonLd(offer, entity)),
  };
}

export function faqPageJsonLd(faqs: GeoFaq[]): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

/**
 * Every JSON-LD block the input supports: SoftwareApplication and Product
 * always, FAQPage only when there are FAQs (an empty FAQPage is invalid).
 */
export function generateJsonLd(input: GeoInput): JsonLd[] {
  assertValidGeoInput(input);
  const blocks = [softwareApplicationJsonLd(input), productJsonLd(input)];
  if (input.faqs.length > 0) blocks.push(faqPageJsonLd(input.faqs));
  return blocks;
}

/**
 * JSON for a `<script type="application/ld+json">` body. Escapes `<`, `>`
 * and `&` so config text containing `</script>` can't end the tag early.
 */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
