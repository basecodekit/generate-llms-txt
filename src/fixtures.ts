import type { GeoInput } from "./types";

/** Test fixture only — not the product's published facts. */
export const sampleInput: GeoInput = {
  entity: {
    name: "Acme Kit",
    description:
      "A config-driven Next.js starter for SaaS and pay-per-service products.",
    url: "https://acme.example",
    logo: "https://acme.example/logo.png",
    sameAs: ["https://github.com/acme/kit"],
  },
  claims: ["Ships four layout archetypes switchable from one config file."],
  offers: [
    {
      name: "Starter",
      price: 149,
      currency: "USD",
      billing: "one_time",
      description: "One project license.",
    },
    {
      name: "Pro",
      price: 249.5,
      currency: "USD",
      billing: "one_time",
      url: "https://acme.example/pro",
    },
    { name: "Updates", price: 19, currency: "EUR", billing: "monthly" },
    { name: "Updates yearly", price: 190, currency: "USD", billing: "yearly" },
  ],
  faqs: [
    {
      question: "Is it a one-time payment?",
      answer: "Yes. Editions are one-time purchases.",
    },
    {
      question: "Which frameworks\nare supported?",
      answer: "Next.js today.\n\nMore adapters later.",
    },
  ],
  links: [
    {
      title: "Docs",
      url: "https://acme.example/docs",
      description: "Setup guides.",
    },
  ],
};
