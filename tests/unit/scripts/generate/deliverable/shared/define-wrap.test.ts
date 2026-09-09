import { helpersImportLine, wrapTopLevelFields } from "#generate/deliverable/shared/define-wrap.ts";
import { raw, renderSource } from "#generate/deliverable/shared/source.ts";

describe("helpersImportLine", () => {
  it("imports nothing when no helpers are used", () => {
    expect(helpersImportLine(new Set())).toBe("import {  } from \"sanity\";");
  });

  it("imports a single helper by name", () => {
    expect(helpersImportLine(new Set(["defineType"]))).toBe('import { defineType } from "sanity";');
  });

  it("always orders helpers defineArrayMember, defineField, defineType regardless of input order", () => {
    expect(helpersImportLine(new Set(["defineType", "defineField", "defineArrayMember"]))).toBe(
      'import { defineArrayMember, defineField, defineType } from "sanity";',
    );
    expect(helpersImportLine(new Set(["defineField", "defineArrayMember"]))).toBe(
      'import { defineArrayMember, defineField } from "sanity";',
    );
  });
});

describe("wrapTopLevelFields", () => {
  it("wraps each top-level field in a defineField call", () => {
    const { fields } = wrapTopLevelFields([{ name: "title", type: "string" }]);
    expect(fields.map((field) => renderSource(field))).toEqual(['defineField({ name: "title", type: "string" })']);
  });

  it("reports usesArrayMember false when nothing is an array member", () => {
    const { usesArrayMember } = wrapTopLevelFields([{ name: "title", type: "string" }]);
    expect(usesArrayMember).toBe(false);
  });

  it("wraps nested fields inside a fields array with defineField too", () => {
    const { fields } = wrapTopLevelFields([
      { name: "style", type: "object", fields: [{ name: "bg", type: "color" }] },
    ]);
    expect(renderSource(fields[0]!)).toBe(
      'defineField({ name: "style", type: "object", fields: [defineField({ name: "bg", type: "color" })] })',
    );
  });

  it("wraps members of an of array with defineArrayMember and reports usesArrayMember true", () => {
    const { fields, usesArrayMember } = wrapTopLevelFields([
      { name: "tags", type: "array", of: [{ type: "string" }] },
    ]);
    expect(renderSource(fields[0]!)).toBe(
      'defineField({ name: "tags", type: "array", of: [defineArrayMember({ type: "string" })] })',
    );
    expect(usesArrayMember).toBe(true);
  });

  it("leaves raw source values untouched instead of trying to wrap them", () => {
    const { fields } = wrapTopLevelFields([raw("customField")]);
    expect(renderSource(fields[0]!)).toBe("defineField(customField)");
  });

  it("returns an empty fields array and usesArrayMember false for no fields", () => {
    expect(wrapTopLevelFields([])).toEqual({ fields: [], usesArrayMember: false });
  });
});
