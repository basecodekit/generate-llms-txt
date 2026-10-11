/**
 * Refreshes `src/schemaorg/vocab.json` from the official Schema.org release,
 * compacted to what the offline validator needs: classes with their parents,
 * properties with their domains and ranges, and enumeration members.
 *
 *   bun run scripts/update-schemaorg-vocab.ts [path-to-downloaded.jsonld]
 *
 * Without a path it downloads the latest release.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SOURCE =
  "https://schema.org/version/latest/schemaorg-current-https.jsonld";
const OUT = join(import.meta.dir, "..", "src", "schemaorg", "vocab.json");

type Ref = { "@id": string };
type GraphNode = {
  "@id": string;
  "@type": string | string[];
  "rdfs:subClassOf"?: Ref | Ref[];
  "schema:domainIncludes"?: Ref | Ref[];
  "schema:rangeIncludes"?: Ref | Ref[];
  "schema:supersededBy"?: Ref | Ref[];
};

const list = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const name = (id: string) => id.replace(/^schema:/, "");
const names = (refs: Ref | Ref[] | undefined) =>
  list(refs)
    .map((ref) => ref["@id"])
    .filter((id) => id.startsWith("schema:"))
    .map(name)
    .sort();

const path = process.argv[2];
const raw = path
  ? await readFile(path, "utf8")
  : await (await fetch(SOURCE)).text();
const graph = (JSON.parse(raw) as { "@graph": GraphNode[] })["@graph"];

const classes: Record<string, string[]> = {};
const properties: Record<string, { domains: string[]; ranges: string[] }> = {};
const enumMembers: Record<string, string[]> = {};
const superseded: Record<string, string> = {};

for (const node of graph) {
  if (!node["@id"].startsWith("schema:")) continue;
  const id = name(node["@id"]);
  const types = list(node["@type"]);
  if (types.includes("rdfs:Class")) {
    classes[id] = names(node["rdfs:subClassOf"]);
  } else if (types.includes("rdf:Property")) {
    properties[id] = {
      domains: names(node["schema:domainIncludes"]),
      ranges: names(node["schema:rangeIncludes"]),
    };
  } else {
    // An enumeration member, e.g. schema:InStock of type ItemAvailability.
    const memberOf = types.filter((t) => t.startsWith("schema:")).map(name);
    if (memberOf.length > 0) enumMembers[id] = memberOf.sort();
  }
  const replacement = names(node["schema:supersededBy"])[0];
  if (replacement) superseded[id] = replacement;
}

const sortKeys = <T>(record: Record<string, T>) =>
  Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => a.localeCompare(b)),
  );

await writeFile(
  OUT,
  `${JSON.stringify({
    source: SOURCE,
    retrieved: new Date().toISOString().slice(0, 10),
    classes: sortKeys(classes),
    properties: sortKeys(properties),
    enumMembers: sortKeys(enumMembers),
    superseded: sortKeys(superseded),
  })}\n`,
);
console.log(
  `wrote ${OUT}: ${Object.keys(classes).length} classes, ${Object.keys(properties).length} properties, ${Object.keys(enumMembers).length} enum members`,
);
