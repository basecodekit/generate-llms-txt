# generate-llms-txt

Generate [`llms.txt`](https://llmstxt.org) and Schema.org JSON-LD (`SoftwareApplication`, `Product`, `Offer`, `FAQPage`) from one typed product config, and validate the JSON-LD offline.

Both outputs come from the same input, so the price an answer engine reads in `llms.txt` is always the price in your JSON-LD.

## CLI

```bash
npx @basecodekit/generate-llms-txt geo.json --out public/llms.txt   # llms.txt
npx @basecodekit/generate-llms-txt geo.json --jsonld                # JSON-LD blocks
npx @basecodekit/generate-llms-txt geo.json --check                 # offline validation, exit 1 on errors
```

The input is a `.json` file, or a `.js`/`.ts` module with a default export or a named `geoConfig` export. Loading `.ts` directly needs Node 22.18+ or Bun.

```json
{
  "entity": { "name": "Acme", "description": "What Acme does, in one sentence.", "url": "https://acme.example" },
  "offers": [{ "name": "Pro", "price": 19, "currency": "USD", "billing": "monthly" }],
  "faqs": [{ "question": "Is there a free trial?", "answer": "Yes, 14 days." }],
  "claims": ["Works with Next.js and Remix."],
  "links": [{ "title": "Docs", "url": "https://acme.example/docs" }]
}
```

`billing` is `one_time`, `monthly` or `yearly`. A price of `0` is listed as "Free".

## Library

```ts
import { generateJsonLd, generateLlmsTxt, serializeJsonLd } from "@basecodekit/generate-llms-txt";
import { validateJsonLd } from "@basecodekit/generate-llms-txt/validate";

const markdown = generateLlmsTxt(config); // serve as text/plain at /llms.txt
const blocks = generateJsonLd(config);
const scriptBody = serializeJsonLd(blocks); // safe inside <script type="application/ld+json">
const { errors, warnings } = validateJsonLd(blocks);
```

Invalid input (a missing name, a non-absolute URL, a negative or non-numeric price, a lowercase currency) throws a `GeoInputError` that lists every problem, so a wrong price never reaches the output.

## Validation

`validateJsonLd` checks the JSON-LD against a bundled copy of the official Schema.org vocabulary, with no network access:

- every type exists;
- every property exists and is allowed on its type;
- every value fits the property's range, including enumeration URLs like `https://schema.org/InStock`.

It also checks Google's required properties for product snippets and software app rich results. Valid markup that Google won't show as a rich result produces a warning, not an error. The most common case is a `SoftwareApplication` without ratings; add real ratings only. Google no longer shows FAQ rich results, so `FAQPage` gets only the Schema.org checks.

It is imported from `@basecodekit/generate-llms-txt/validate` so the vocabulary isn't loaded unless you use it.

## License

MIT
