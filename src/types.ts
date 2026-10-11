/**
 * The typed input every generator reads from. It is the single source of
 * truth for product facts: `llms.txt` and every JSON-LD block are derived
 * from it, never written by hand, so the two outputs can't disagree.
 */

export type BillingPeriod = "one_time" | "monthly" | "yearly";

export interface GeoEntity {
  /** Product or brand name, e.g. "BasecodeKit". */
  name: string;
  /** One-sentence summary; becomes the `llms.txt` blockquote. */
  description: string;
  /** Canonical absolute URL of the product. */
  url: string;
  logo?: string;
  /** Profiles that identify the same entity (GitHub, X, …). */
  sameAs?: string[];
  /** Schema.org `applicationCategory`, e.g. "DeveloperApplication". */
  applicationCategory?: string;
  /** Schema.org `operatingSystem`, e.g. "Web". */
  operatingSystem?: string;
}

export interface GeoOffer {
  name: string;
  /** Price in major units (149 means $149.00). */
  price: number;
  /** ISO 4217 code, e.g. "USD". */
  currency: string;
  billing: BillingPeriod;
  description?: string;
  url?: string;
}

export interface GeoFaq {
  question: string;
  answer: string;
}

export interface GeoLink {
  title: string;
  url: string;
  description?: string;
}

export interface GeoInput {
  entity: GeoEntity;
  offers: GeoOffer[];
  faqs: GeoFaq[];
  /** Factual statements about the product, rendered as a list. */
  claims?: string[];
  /** Further pages worth reading, rendered as an `llms.txt` link section. */
  links?: GeoLink[];
}
