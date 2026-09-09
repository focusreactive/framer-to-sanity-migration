import {
  blockArrayFor,
  sanityDataForFields,
  sanityValueFor,
  type BlockDef,
  type BlockRecord,
  type FieldDef,
  type SeedCtx,
} from "#generate/deliverable/seed/transform.ts";

function makeCtx(overrides: Partial<SeedCtx> = {}): SeedCtx {
  return {
    uploadedAssetId: () => undefined,
    resolveAssetId: () => undefined,
    warn: () => {},
    ...overrides,
  };
}

describe("sanityValueFor", () => {
  it("passes a plain text value through unchanged", () => {
    expect(sanityValueFor({ type: "text" }, "hello", makeCtx())).toBe("hello");
  });

  it("returns undefined for a null or undefined value regardless of field type", () => {
    expect(sanityValueFor({ type: "text" }, null, makeCtx())).toBeUndefined();
    expect(sanityValueFor({ type: "text" }, undefined, makeCtx())).toBeUndefined();
  });

  it("converts a color field through sanityColorValue", () => {
    expect(sanityValueFor({ type: "color" }, "#FF0000", makeCtx())).toEqual({ _type: "color", hex: "#ff0000" });
  });

  it("warns and stores a color it cannot parse verbatim", () => {
    const warn = vi.fn();
    const value = sanityValueFor({ type: "color" }, "var(--brand)", makeCtx({ warn }));
    expect(value).toEqual({ _type: "color", hex: "var(--brand)" });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("var(--brand)"));
  });

  it("returns undefined for an empty color value", () => {
    expect(sanityValueFor({ type: "color" }, "", makeCtx())).toBeUndefined();
  });

  it("converts a rich text field via htmlToPortableText", () => {
    const value = sanityValueFor({ type: "richText" }, "<p>Body copy</p>", makeCtx());
    expect(Array.isArray(value)).toBe(true);
    expect((value as { style?: string }[])[0]?.style).toBe("normal");
  });

  it("returns undefined for an empty rich text value", () => {
    expect(sanityValueFor({ type: "richText" }, "", makeCtx())).toBeUndefined();
  });

  it("resolves an image field to a reference when the asset was uploaded", () => {
    const ctx = makeCtx({ uploadedAssetId: (assetId) => (assetId === "asset-1" ? "image-ref-1" : undefined) });
    const value = sanityValueFor({ type: "image" }, { assetId: "asset-1", alt: "A cat" }, ctx);
    expect(value).toEqual({
      _type: "image",
      alt: "A cat",
      asset: { _type: "reference", _ref: "image-ref-1" },
    });
  });

  it("warns and leaves an image field empty when the asset was never uploaded", () => {
    const warn = vi.fn();
    const value = sanityValueFor({ type: "image" }, { assetId: "asset-1" }, makeCtx({ warn }));
    expect(value).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("asset-1"));
  });

  it("resolves a reference field to a document reference keyed off its collection", () => {
    const value = sanityValueFor({ type: "reference", collectionKey: "post" }, "hello-world", makeCtx());
    expect(value).toEqual({ _type: "reference", _ref: "post.hello-world" });
  });

  it("returns undefined for a reference field with no collection key", () => {
    expect(sanityValueFor({ type: "reference" }, "hello-world", makeCtx())).toBeUndefined();
  });

  it("resolves each entry of a multiReference field to a keyed reference", () => {
    const value = sanityValueFor({ type: "multiReference", collectionKey: "post" }, ["a", "b"], makeCtx()) as Record<
      string,
      unknown
    >[];
    expect(value).toHaveLength(2);
    expect(value[0]).toMatchObject({ _type: "reference", _ref: "post.a" });
    expect(value[1]).toMatchObject({ _type: "reference", _ref: "post.b" });
    expect(typeof value[0]?.["_key"]).toBe("string");
    expect(typeof value[1]?.["_key"]).toBe("string");
  });

  it("converts an array of plain values into keyed array entries where the entry is a record", () => {
    const value = sanityValueFor(
      { type: "array", element: { type: "group", fields: [{ name: "label", type: { type: "text" }, required: true }] } },
      [{ label: "one" }, { label: "two" }],
      makeCtx(),
    ) as Record<string, unknown>[];
    expect(value).toHaveLength(2);
    expect(value[0]).toMatchObject({ label: "one" });
    expect(value[1]).toMatchObject({ label: "two" });
    expect(typeof value[0]?.["_type"]).toBe("string");
    expect(typeof value[0]?.["_key"]).toBe("string");
  });

  it("skips array entries that convert to undefined", () => {
    const value = sanityValueFor(
      { type: "array", element: { type: "reference", collectionKey: "post" } },
      ["", "valid"],
      makeCtx(),
    ) as Record<string, unknown>[];
    expect(value).toHaveLength(1);
    expect(value[0]).toMatchObject({ _type: "reference", _ref: "post.valid" });
    expect(typeof value[0]?.["_key"]).toBe("string");
  });

  it("returns undefined for an array field with no element definition", () => {
    expect(sanityValueFor({ type: "array" }, ["a"], makeCtx())).toBeUndefined();
  });

  it("recurses into a group field via sanityDataForFields", () => {
    const fields: FieldDef[] = [{ name: "label", type: { type: "text" }, required: true }];
    const value = sanityValueFor({ type: "group", fields }, { label: "hi" }, makeCtx());
    expect(value).toEqual({ label: "hi" });
  });
});

describe("sanityDataForFields", () => {
  it("wraps the configured slug field into a sanity slug value", () => {
    const fields: FieldDef[] = [{ name: "slug", type: { type: "text" }, required: true }];
    const ctx = makeCtx({ slugField: "slug" });
    expect(sanityDataForFields(fields, { slug: "hello-world" }, ctx)).toEqual({
      slug: { _type: "slug", current: "hello-world" },
    });
  });

  it("omits a field whose converted value is undefined", () => {
    const fields: FieldDef[] = [{ name: "hero", type: { type: "richText" }, required: false }];
    expect(sanityDataForFields(fields, { hero: "" }, makeCtx())).toEqual({});
  });

  it("converts multiple fields into a single record", () => {
    const fields: FieldDef[] = [
      { name: "title", type: { type: "text" }, required: true },
      { name: "tint", type: { type: "color" }, required: false },
    ];
    expect(sanityDataForFields(fields, { title: "Hello", tint: "#000000" }, makeCtx())).toEqual({
      title: "Hello",
      tint: { _type: "color", hex: "#000000" },
    });
  });
});

describe("blockArrayFor", () => {
  const blocks: BlockDef[] = [
    { id: "heroBlock", fields: [{ name: "title", type: { type: "text" }, required: true }] },
  ];

  it("orders block records by their order field, not their array position", () => {
    const records: BlockRecord[] = [
      { order: 1, blockType: "heroBlock", anchorMigId: "second", fields: { title: { kind: "literal", value: "B" } } },
      { order: 0, blockType: "heroBlock", anchorMigId: "first", fields: { title: { kind: "literal", value: "A" } } },
    ];
    const result = blockArrayFor(records, blocks, makeCtx());
    expect(result.map((block) => block["_key"])).toEqual(["first", "second"]);
  });

  it("shapes each block with its schema type name and anchor id as the array key", () => {
    const records: BlockRecord[] = [
      { order: 0, blockType: "heroBlock", anchorMigId: "anchor-1", fields: { title: { kind: "literal", value: "Hi" } } },
    ];
    expect(blockArrayFor(records, blocks, makeCtx())).toEqual([{ _type: "heroBlock", _key: "anchor-1", title: "Hi" }]);
  });

  it("throws naming the unknown block type and its anchor id", () => {
    const records: BlockRecord[] = [{ order: 0, blockType: "missing", anchorMigId: "anchor-9", fields: {} }];
    expect(() => blockArrayFor(records, blocks, makeCtx())).toThrow(/missing.*anchor-9/);
  });

  it("does not apply the slug field to a block's own fields", () => {
    const slugBlocks: BlockDef[] = [{ id: "slugBlock", fields: [{ name: "slug", type: { type: "text" }, required: true }] }];
    const records: BlockRecord[] = [
      { order: 0, blockType: "slugBlock", anchorMigId: "anchor-2", fields: { slug: { kind: "literal", value: "raw-slug" } } },
    ];
    const ctx = makeCtx({ slugField: "slug" });
    expect(blockArrayFor(records, slugBlocks, ctx)).toEqual([{ _type: "slugBlock", _key: "anchor-2", slug: "raw-slug" }]);
  });
});
