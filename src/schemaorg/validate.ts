import type { JsonLd } from "../jsonld";
import vocab from "./vocab.json" with { type: "json" };

/**
 * Offline JSON-LD validation against the official Schema.org vocabulary
 * (`vocab.json`, refreshed by `scripts/update-schemaorg-vocab.ts`), plus the
 * Google rich-result requirements for the types this package emits.
 *
 * Schema.org checks: every `@type` exists; every property exists and is
 * allowed on that type (domain); every value fits the property's range —
 * a typed node of a matching class, a primitive of a matching data type, or
 * an enumeration member URL such as `https://schema.org/InStock`.
 */

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  /** Invalid Schema.org, or a Google-required property missing. */
  errors: ValidationIssue[];
  /** Valid, but superseded terms or missing Google-recommended data. */
  warnings: ValidationIssue[];
}

type Vocab = {
  classes: Record<string, string[]>;
  properties: Record<string, { domains: string[]; ranges: string[] }>;
  enumMembers: Record<string, string[]>;
  superseded: Record<string, string>;
};

const { classes, properties, enumMembers, superseded } = vocab as Vocab;
const SCHEMA_URL = /^https?:\/\/schema\.org\/([A-Za-z0-9_]+)$/;
const ancestorCache = new Map<string, Set<string>>();

/** The class and everything it inherits from. */
function ancestors(type: string): Set<string> {
  const cached = ancestorCache.get(type);
  if (cached) return cached;
  const result = new Set<string>([type]);
  for (const parent of classes[type] ?? [])
    for (const a of ancestors(parent)) result.add(a);
  ancestorCache.set(type, result);
  return result;
}

const isA = (type: string, ranges: string[]) =>
  ranges.some((range) => ancestors(type).has(range));

function primitiveFits(value: unknown, ranges: string[]): boolean {
  if (typeof value === "boolean")
    return ranges.some((r) => isA(r, ["Boolean"]));
  if (typeof value === "number") return ranges.some((r) => isA(r, ["Number"]));
  if (typeof value !== "string") return false;
  if (ranges.some((r) => isA(r, ["Text", "Date", "DateTime", "Time"])))
    return true;
  // An enumeration member referenced by URL, e.g. availability: ".../InStock".
  const member = SCHEMA_URL.exec(value)?.[1];
  return (
    member !== undefined &&
    (enumMembers[member] ?? []).some((memberOf) => isA(memberOf, ranges))
  );
}

const describe = (value: unknown) =>
  Array.isArray(value) ? "array" : value === null ? "null" : typeof value;

function checkNode(
  node: unknown,
  path: string,
  ranges: string[] | null,
  result: ValidationResult,
): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => checkNode(item, `${path}[${i}]`, ranges, result));
    return;
  }
  if (node === null || typeof node !== "object") {
    if (ranges && !primitiveFits(node, ranges)) {
      result.errors.push({
        path,
        message: `${JSON.stringify(node)} (${describe(node)}) does not fit range ${ranges.join(" | ")}`,
      });
    }
    return;
  }

  const record = node as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type !== "string") {
    result.errors.push({ path, message: "node has no @type" });
    return;
  }
  if (!(type in classes)) {
    result.errors.push({ path, message: `unknown type ${type}` });
    return;
  }
  if (superseded[type])
    result.warnings.push({
      path,
      message: `${type} is superseded by ${superseded[type]}`,
    });
  if (ranges && !isA(type, ranges)) {
    result.errors.push({
      path,
      message: `${type} does not fit range ${ranges.join(" | ")}`,
    });
  }

  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("@")) continue;
    const at = `${path}.${key}`;
    const property = properties[key];
    if (!property) {
      result.errors.push({ path: at, message: `unknown property ${key}` });
      continue;
    }
    if (!property.domains.some((domain) => ancestors(type).has(domain))) {
      result.errors.push({
        path: at,
        message: `${key} is not a property of ${type}`,
      });
    }
    if (superseded[key])
      result.warnings.push({
        path: at,
        message: `${key} is superseded by ${superseded[key]}`,
      });
    checkNode(value, at, property.ranges, result);
  }
}

const has = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return (
    value !== undefined &&
    value !== null &&
    value !== "" &&
    !(Array.isArray(value) && value.length === 0)
  );
};

const asList = (value: unknown): Record<string, unknown>[] =>
  (Array.isArray(value) ? value : value ? [value] : []).filter(
    (v): v is Record<string, unknown> => typeof v === "object" && v !== null,
  );

/**
 * Google's requirements for the product snippet and software app rich
 * results (developers.google.com/search/docs/appearance/structured-data,
 * checked 2026-10-08). FAQ rich results are retired, so FAQPage gets only
 * the Schema.org checks. Missing ratings are a warning, never a reason to
 * invent them.
 */
function checkGoogle(
  node: Record<string, unknown>,
  path: string,
  result: ValidationResult,
): void {
  const type = node["@type"];
  const offers = asList(node.offers);

  const checkOffers = () =>
    offers.forEach((offer, i) => {
      const at = `${path}.offers[${i}]`;
      const spec = asList(offer.priceSpecification)[0];
      if (!has(offer, "price") && !(spec && has(spec, "price"))) {
        result.errors.push({
          path: at,
          message: "Google requires price or priceSpecification.price",
        });
      }
      if (!has(offer, "priceCurrency"))
        result.warnings.push({
          path: at,
          message: "Google recommends priceCurrency",
        });
    });

  if (type === "Product") {
    if (!has(node, "name"))
      result.errors.push({ path, message: "Google requires name on Product" });
    if (
      !["offers", "review", "aggregateRating"].some((key) => has(node, key))
    ) {
      result.errors.push({
        path,
        message:
          "Google requires one of offers, review or aggregateRating on Product",
      });
    }
    checkOffers();
  }

  if (type === "SoftwareApplication") {
    if (!has(node, "name"))
      result.errors.push({
        path,
        message: "Google requires name on SoftwareApplication",
      });
    if (offers.length === 0)
      result.errors.push({
        path,
        message: "Google requires offers.price on SoftwareApplication",
      });
    if (!has(node, "aggregateRating") && !has(node, "review")) {
      result.warnings.push({
        path,
        message:
          "no aggregateRating or review, so Google won't show a software app rich result (add real ratings only)",
      });
    }
    checkOffers();
  }
}

export function validateJsonLd(data: JsonLd | JsonLd[]): ValidationResult {
  const result: ValidationResult = { errors: [], warnings: [] };
  const blocks = Array.isArray(data) ? data : [data];
  blocks.forEach((block, i) => {
    const path = Array.isArray(data) ? `[${i}]` : "$";
    const context = block["@context"];
    if (
      typeof context !== "string" ||
      !/^https?:\/\/schema\.org\/?$/.test(context)
    ) {
      result.errors.push({
        path,
        message: `@context must be "https://schema.org", got ${JSON.stringify(context)}`,
      });
    }
    checkNode(block, path, null, result);
    checkGoogle(block, path, result);
  });
  return result;
}

/** The vocabulary release the validator checks against. */
export const schemaOrgVocabulary = {
  source: (vocab as { source: string }).source,
  retrieved: (vocab as { retrieved: string }).retrieved,
};
