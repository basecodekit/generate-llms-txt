import { afterAll, describe, expect, spyOn, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli";
import { generateLlmsTxt } from "./extractor";
import { sampleInput } from "./fixtures";

const dir = await mkdtemp(join(tmpdir(), "geo-tools-"));
afterAll(() => rm(dir, { recursive: true, force: true }));

describe("generate-llms-txt CLI", () => {
  test("writes llms.txt from a JSON input", async () => {
    const input = join(dir, "geo.json");
    const out = join(dir, "llms.txt");
    await writeFile(input, JSON.stringify(sampleInput));
    expect(await main([input, "--out", out])).toBe(0);
    expect(await readFile(out, "utf8")).toBe(generateLlmsTxt(sampleInput));
  });

  test("reads a module's named geoConfig export and prints JSON-LD", async () => {
    const input = join(dir, "geo.config.ts");
    const out = join(dir, "jsonld.json");
    await writeFile(
      input,
      `export const geoConfig = ${JSON.stringify(sampleInput)};`,
    );
    expect(await main([input, "--jsonld", "--out", out])).toBe(0);
    expect(
      JSON.parse(await readFile(out, "utf8")).map(
        (b: { "@type": string }) => b["@type"],
      ),
    ).toContain("FAQPage");
  });

  test("--check validates the JSON-LD offline and exits 0 when it is clean", async () => {
    const input = join(dir, "check.json");
    await writeFile(input, JSON.stringify(sampleInput));
    const stderr = spyOn(console, "error").mockImplementation(() => {});
    expect(await main([input, "--check"])).toBe(0);
    expect(stderr.mock.calls.at(-1)?.[0]).toBe("0 error(s), 1 warning(s)");
    stderr.mockRestore();
  });

  test("exits 1 with the validation problems on bad input", async () => {
    const input = join(dir, "bad.json");
    await writeFile(
      input,
      JSON.stringify({
        ...sampleInput,
        offers: [
          { name: "X", price: -1, currency: "USD", billing: "one_time" },
        ],
      }),
    );
    const stderr = spyOn(console, "error").mockImplementation(() => {});
    expect(await main([input])).toBe(1);
    expect(stderr.mock.calls[0]?.[0]).toContain("offers[0].price");
    stderr.mockRestore();
  });
});
