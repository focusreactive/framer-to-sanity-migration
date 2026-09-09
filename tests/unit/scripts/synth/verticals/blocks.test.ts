import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { type BlockField, blockTypeSchema } from "#ir/blocks.ts";
import { synthEntryDir } from "#lib/synth-store/paths.ts";
import { blockContentResponseSchema } from "#synth/schemas/content-response.ts";
import { blockFieldsResponseSchema } from "#synth/schemas/fields-response.ts";
import { blocksVertical } from "#synth/verticals/blocks.ts";

import { synthProject } from "../fixtures/synth.ts";

const fields: BlockField[] = [
  { name: "logo", type: { type: "image" }, required: true },
  { name: "eyebrow", type: { type: "text" }, required: false },
  {
    name: "cta",
    type: {
      type: "group",
      fields: [
        { name: "label", type: { type: "text" }, required: true },
        { name: "href", type: { type: "text" }, required: false },
      ],
    },
    required: true,
  },
];

function literalsOf(response: unknown): unknown {
  const parsed = blockContentResponseSchema(fields).safeParse(response);
  if (!parsed.success) throw new Error(`the content response was rejected: ${parsed.error.message}`);
  return (parsed.data as { literals: unknown }).literals;
}

describe("blockContentResponseSchema", () => {
  it("validates literals against the block's fields", () => {
    expect(literalsOf({ literals: { logo: { assetId: "a1", alt: "Logo" }, cta: { label: "Go" } } })).toEqual({
      logo: { assetId: "a1", alt: "Logo" },
      cta: { label: "Go" },
    });
  });

  it("accepts the AI's null-for-absent dialect and stores the canonical record", () => {
    expect(
      literalsOf({
        literals: { logo: { assetId: "a1", alt: null }, eyebrow: null, cta: { label: "Go", href: null } },
      }),
    ).toEqual({ logo: { assetId: "a1" }, cta: { label: "Go" } });
  });

  it("rejects a null in a required position, naming the field", () => {
    const parsed = blockContentResponseSchema(fields).safeParse({
      literals: { logo: null, cta: { label: "Go" } },
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toMatch(/logo/);
  });

  it("rejects unknown slugs and wrong types", () => {
    expect(
      blockContentResponseSchema(fields).safeParse({
        literals: { logo: { assetId: "a1" }, cta: { label: "Go" }, ghost: 1 },
      }).success,
    ).toBe(false);
    expect(
      blockContentResponseSchema(fields).safeParse({ literals: { logo: "not-a-ref", cta: { label: "Go" } } }).success,
    ).toBe(false);
  });
});

describe("blocksVertical.acceptFields", () => {
  const response = (overrides: Record<string, unknown>) =>
    blockFieldsResponseSchema.parse({ name: "Hero", fields: [fields[0]], ...overrides });

  it("shapes the schema shard and keeps an optional collectionKey", async () => {
    const outcome = await blocksVertical.acceptFields("/tmp/p", { key: "hero" }, response({ collectionKey: "posts" }));
    expect(outcome).toMatchObject({ ok: true, shard: { name: "Hero", collectionKey: "posts" } });
  });

  it("rejects duplicate field slugs, naming the slug", async () => {
    const outcome = await blocksVertical.acceptFields(
      "/tmp/p",
      { key: "hero" },
      response({ fields: [fields[0], fields[0]] }),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.errors[0]).toMatchObject({ code: "DUPLICATE_FIELD", got: "logo" });
  });
});

describe("blocksVertical.emitCodegen", () => {
  it("parses the shard through blockTypeSchema and writes the props and schema files", async () => {
    const projectPath = await synthProject("blocks-emit-codegen");
    const dir = synthEntryDir(projectPath, "blocks", "hero");
    await mkdir(dir, { recursive: true });

    const shard = { name: "Hero", fields: [fields[0]], collectionKey: "posts" };
    expect(() =>
      blockTypeSchema.parse({ id: "hero", name: shard.name, fields: shard.fields, collectionKey: shard.collectionKey, content: {} }),
    ).not.toThrow();

    await blocksVertical.emitCodegen(projectPath, { key: "hero" }, shard);

    const props = await readFile(join(dir, "props.ts"), "utf8");
    const schema = await readFile(join(dir, "schema.ts"), "utf8");
    expect(props).toContain("logo");
    expect(schema).toContain("Hero");
  });
});
