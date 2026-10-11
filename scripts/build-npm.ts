/**
 * Builds the public npm package into `dist/npm`: compiled ESM for Node, type
 * declarations, README and LICENSE, and a package.json under the published
 * name. The workspace package stays `@basecodekit/geo-tools` (private,
 * consumed from source); only this output is published.
 *
 *   bun run build:npm
 *   cd dist/npm && npm publish
 */
import { $ } from "bun";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PUBLISHED_NAME = "@basecodekit/generate-llms-txt";
const BIN_NAME = "generate-llms-txt";
const REPOSITORY = "https://github.com/basecodekit/generate-llms-txt";

const root = join(import.meta.dir, "..");
const out = join(root, "dist", "npm");
const workspace = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
) as {
  version: string;
  description: string;
};

await rm(join(root, "dist"), { recursive: true, force: true });
await mkdir(out, { recursive: true });

const result = await Bun.build({
  entrypoints: ["src/index.ts", "src/schemaorg/validate.ts", "src/cli.ts"].map(
    (p) => join(root, p),
  ),
  root: join(root, "src"),
  outdir: join(out, "dist"),
  target: "node",
  format: "esm",
  splitting: true,
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

// The source shebang targets Bun for in-repo use; the published CLI runs on Node.
const cliPath = join(out, "dist", "cli.js");
const cli = (await readFile(cliPath, "utf8")).replace(/^#!.*\n/, "");
await writeFile(cliPath, `#!/usr/bin/env node\n${cli}`, { mode: 0o755 });

await $`bun x tsc -p ${join(root, "tsconfig.build.json")} --outDir ${join(out, "dist")}`;

await cp(join(root, "README.md"), join(out, "README.md"));
await cp(join(root, "LICENSE"), join(out, "LICENSE"));

const manifest = {
  name: PUBLISHED_NAME,
  version: workspace.version,
  description: workspace.description,
  license: "MIT",
  type: "module",
  exports: {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./validate": {
      types: "./dist/schemaorg/validate.d.ts",
      default: "./dist/schemaorg/validate.js",
    },
  },
  bin: { [BIN_NAME]: "dist/cli.js" },
  files: ["dist", "README.md", "LICENSE"],
  publishConfig: { access: "public" },
  engines: { node: ">=20" },
  repository: { type: "git", url: `git+${REPOSITORY}.git` },
  homepage: `${REPOSITORY}#readme`,
  bugs: `${REPOSITORY}/issues`,
  keywords: [
    "llms.txt",
    "json-ld",
    "schema.org",
    "structured-data",
    "geo",
    "aeo",
    "seo",
    "ai-search",
  ],
  sideEffects: false,
};
await writeFile(
  join(out, "package.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
console.log(`built ${PUBLISHED_NAME}@${workspace.version} in ${out}`);
