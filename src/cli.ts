#!/usr/bin/env bun
import { realpathSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { generateLlmsTxt } from "./extractor";
import { generateJsonLd } from "./jsonld";
import { validateJsonLd } from "./schemaorg/validate";
import type { GeoInput } from "./types";
import { GeoInputError } from "./validate";

const USAGE = `Usage: generate-llms-txt <input> [--jsonld | --check] [--out <file>]

  <input>       GEO input as .json, or a .ts/.js module whose default
                export (or named "geoConfig" export) is the input object
  --jsonld      print the JSON-LD blocks instead of llms.txt
  --check       validate the JSON-LD offline against Schema.org and Google's
                rich-result requirements; exits 1 on any error
  --out <file>  write to a file instead of stdout`;

async function loadInput(path: string): Promise<GeoInput> {
  const absolute = resolve(path);
  if (absolute.endsWith(".json"))
    return JSON.parse(await readFile(absolute, "utf8")) as GeoInput;
  const mod = (await import(pathToFileURL(absolute).href)) as {
    default?: GeoInput;
    geoConfig?: GeoInput;
  };
  const input = mod.default ?? mod.geoConfig;
  if (!input) throw new Error(`${path} has no default or "geoConfig" export`);
  return input;
}

export async function main(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      jsonld: { type: "boolean" },
      check: { type: "boolean" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length !== 1) {
    console.error(USAGE);
    return values.help ? 0 : 1;
  }

  try {
    const input = await loadInput(positionals[0]!);
    if (values.check) {
      const { errors, warnings } = validateJsonLd(generateJsonLd(input));
      for (const w of warnings)
        console.error(`warning ${w.path}: ${w.message}`);
      for (const e of errors) console.error(`error   ${e.path}: ${e.message}`);
      console.error(`${errors.length} error(s), ${warnings.length} warning(s)`);
      return errors.length > 0 ? 1 : 0;
    }
    const output = values.jsonld
      ? `${JSON.stringify(generateJsonLd(input), null, 2)}\n`
      : generateLlmsTxt(input);
    if (values.out) await writeFile(values.out, output);
    else process.stdout.write(output);
    return 0;
  } catch (error) {
    console.error(
      error instanceof GeoInputError
        ? error.message
        : `generate-llms-txt: ${(error as Error).message}`,
    );
    return 1;
  }
}

/** True when run as a command (also via npm's bin symlink), false when imported. */
function isEntryPoint(): boolean {
  const invoked = process.argv[1];
  if (!invoked) return false;
  try {
    return (
      realpathSync(invoked) === realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
}

if (isEntryPoint()) process.exit(await main(process.argv.slice(2)));
