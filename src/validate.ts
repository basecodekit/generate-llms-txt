import type { GeoInput } from "./types";

const BILLING_PERIODS = new Set(["one_time", "monthly", "yearly"]);

export class GeoInputError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid GEO input:\n- ${problems.join("\n- ")}`);
    this.name = "GeoInputError";
  }
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Structural checks the generators rely on. Apps should still validate their
 * own config with a schema at startup; this guards the package's contract
 * for standalone (CLI) callers, and fails loudly instead of emitting a
 * price or URL that would mislead an answer engine.
 */
export function assertValidGeoInput(input: GeoInput): void {
  const problems: string[] = [];
  const { entity, offers, faqs } = input;

  if (!entity?.name?.trim()) problems.push("entity.name is required");
  if (!entity?.description?.trim())
    problems.push("entity.description is required");
  if (!entity?.url || !isAbsoluteUrl(entity.url))
    problems.push("entity.url must be an absolute http(s) URL");
  if (entity?.logo !== undefined && !isAbsoluteUrl(entity.logo))
    problems.push("entity.logo must be an absolute http(s) URL");
  entity?.sameAs?.forEach((url, i) => {
    if (!isAbsoluteUrl(url))
      problems.push(`entity.sameAs[${i}] must be an absolute http(s) URL`);
  });

  if (!Array.isArray(offers)) problems.push("offers must be an array");
  else
    offers.forEach((offer, i) => {
      if (!offer.name?.trim()) problems.push(`offers[${i}].name is required`);
      if (!Number.isFinite(offer.price) || offer.price < 0)
        problems.push(`offers[${i}].price must be a non-negative number`);
      if (!/^[A-Z]{3}$/.test(offer.currency ?? ""))
        problems.push(
          `offers[${i}].currency must be an ISO 4217 code like "USD"`,
        );
      if (!BILLING_PERIODS.has(offer.billing))
        problems.push(
          `offers[${i}].billing must be one_time, monthly or yearly`,
        );
      if (offer.url !== undefined && !isAbsoluteUrl(offer.url))
        problems.push(`offers[${i}].url must be an absolute http(s) URL`);
    });

  if (!Array.isArray(faqs)) problems.push("faqs must be an array");
  else
    faqs.forEach((faq, i) => {
      if (!faq.question?.trim())
        problems.push(`faqs[${i}].question is required`);
      if (!faq.answer?.trim()) problems.push(`faqs[${i}].answer is required`);
    });

  input.links?.forEach((link, i) => {
    if (!link.title?.trim()) problems.push(`links[${i}].title is required`);
    if (!isAbsoluteUrl(link.url))
      problems.push(`links[${i}].url must be an absolute http(s) URL`);
  });

  if (problems.length > 0) throw new GeoInputError(problems);
}
