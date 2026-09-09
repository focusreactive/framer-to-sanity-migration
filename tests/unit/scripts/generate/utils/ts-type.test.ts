import { propKey, sanityTsType } from "#generate/utils/ts-type.ts";
import { fieldTypeSchema } from "#ir/field-type.ts";

describe("sanityTsType", () => {
  it("types text as string", () => {
    expect(sanityTsType({ type: "text" })).toBe("string");
  });

  it("types url as string", () => {
    expect(sanityTsType({ type: "url" })).toBe("string");
  });

  it("types email as string", () => {
    expect(sanityTsType({ type: "email" })).toBe("string");
  });

  it("types phone as string", () => {
    expect(sanityTsType({ type: "phone" })).toBe("string");
  });

  it("types date as string", () => {
    expect(sanityTsType({ type: "date" })).toBe("string");
  });

  it("types unsupported as string", () => {
    expect(sanityTsType({ type: "unsupported" })).toBe("string");
  });

  it("types number as number", () => {
    expect(sanityTsType({ type: "number" })).toBe("number");
  });

  it("types boolean as boolean", () => {
    expect(sanityTsType({ type: "boolean" })).toBe("boolean");
  });

  it("types color as a hex object", () => {
    expect(sanityTsType({ type: "color" })).toBe("{ hex: string }");
  });

  it("types richText as a Portable Text array", () => {
    expect(sanityTsType({ type: "richText" })).toBe("PortableTextBlock[]");
  });

  it("types image as SanityImage", () => {
    expect(sanityTsType({ type: "image" })).toBe("SanityImage");
  });

  it("types file as SanityFile", () => {
    expect(sanityTsType({ type: "file" })).toBe("SanityFile");
  });

  it("types video as SanityFile", () => {
    expect(sanityTsType({ type: "video" })).toBe("SanityFile");
  });

  it("types option as a union of its literal values", () => {
    expect(sanityTsType({ type: "option", values: ["a", "b"] })).toBe('"a" | "b"');
  });

  it("types reference as the resolved document intersection", () => {
    expect(sanityTsType(fieldTypeSchema.parse({ type: "reference", collectionKey: "people" }))).toBe(
      "{ _id: string } & Record<string, unknown>",
    );
  });

  it("types multiReference as an already-parenthesized array of the resolved document", () => {
    expect(sanityTsType(fieldTypeSchema.parse({ type: "multiReference", collectionKey: "people" }))).toBe(
      "({ _id: string } & Record<string, unknown>)[]",
    );
  });

  it("types a group as an inline object literal", () => {
    expect(
      sanityTsType({
        type: "group",
        fields: [
          { name: "label", type: { type: "text" }, required: true },
          { name: "hint", type: { type: "text" }, required: false },
        ],
      }),
    ).toBe("{ label: string; hint?: string }");
  });

  it("collapses an array of richText into a single Portable Text array", () => {
    expect(sanityTsType({ type: "array", element: { type: "richText" } })).toBe("PortableTextBlock[]");
  });

  it("types an array of scalars without parens", () => {
    expect(sanityTsType({ type: "array", element: { type: "text" } })).toBe("string[]");
  });

  it("parenthesizes an array of option so the union binds before the array", () => {
    const type = fieldTypeSchema.parse({ type: "array", element: { type: "option", values: ["a", "b"] } });
    expect(sanityTsType(type)).toBe('("a" | "b")[]');
  });

  it("parenthesizes an array of reference so the intersection binds before the array", () => {
    const type = fieldTypeSchema.parse({
      type: "array",
      element: { type: "reference", collectionKey: "people" },
    });
    expect(sanityTsType(type)).toBe("({ _id: string } & Record<string, unknown>)[]");
  });

  it("does not double-parenthesize an array of multiReference", () => {
    const type = fieldTypeSchema.parse({
      type: "array",
      element: { type: "multiReference", collectionKey: "people" },
    });
    expect(sanityTsType(type)).toBe("({ _id: string } & Record<string, unknown>)[][]");
  });

  it("does not parenthesize an array of group, since the object braces already disambiguate", () => {
    const type = fieldTypeSchema.parse({
      type: "array",
      element: { type: "group", fields: [{ name: "label", type: { type: "text" }, required: true }] },
    });
    expect(sanityTsType(type)).toBe("{ label: string }[]");
  });
});

describe("propKey", () => {
  it("returns a bare identifier unquoted", () => {
    expect(propKey("heading")).toBe("heading");
  });

  it("quotes a name that is not a valid identifier", () => {
    expect(propKey("data-x")).toBe('"data-x"');
  });
});
