import { sanityColorValue } from "#generate/deliverable/shared/color.ts";

describe("sanityColorValue", () => {
  it("converts a hex colour into sanity's colour object", () => {
    expect(sanityColorValue("#FF0000")).toEqual({
      kind: "converted",
      value: { _type: "color", hex: "#ff0000" },
    });
  });

  it("accepts a shorthand 3-digit hex colour", () => {
    expect(sanityColorValue("#F00")).toEqual({
      kind: "converted",
      value: { _type: "color", hex: "#f00" },
    });
  });

  it("converts the rgb form getComputedStyle actually returns", () => {
    expect(sanityColorValue("rgb(255, 0, 0)")).toEqual({
      kind: "converted",
      value: { _type: "color", hex: "#ff0000" },
    });
  });

  it("carries an rgba alpha channel through onto the converted colour", () => {
    expect(sanityColorValue("rgba(255, 0, 0, 0.5)")).toEqual({
      kind: "converted",
      value: { _type: "color", hex: "#ff0000", alpha: 0.5 },
    });
  });

  it("omits alpha entirely for an opaque rgb value", () => {
    const result = sanityColorValue("rgb(0, 128, 255)");
    expect(result.kind).toBe("converted");
    expect(result).toEqual({ kind: "converted", value: { _type: "color", hex: "#0080ff" } });
    expect("alpha" in (result as { value: object }).value).toBe(false);
  });

  it("keeps a value it cannot parse verbatim, and reports the raw string alongside it", () => {
    expect(sanityColorValue("linear-gradient(red, blue)")).toEqual({
      kind: "verbatim",
      raw: "linear-gradient(red, blue)",
      value: { _type: "color", hex: "linear-gradient(red, blue)" },
    });
  });

  it("trims surrounding whitespace before treating a value as verbatim", () => {
    expect(sanityColorValue("  var(--brand-color)  ")).toEqual({
      kind: "verbatim",
      raw: "var(--brand-color)",
      value: { _type: "color", hex: "var(--brand-color)" },
    });
  });

  it("reports an empty conversion for a blank or non-string value", () => {
    expect(sanityColorValue(undefined)).toEqual({ kind: "empty" });
    expect(sanityColorValue("  ")).toEqual({ kind: "empty" });
    expect(sanityColorValue(123)).toEqual({ kind: "empty" });
    expect(sanityColorValue(null)).toEqual({ kind: "empty" });
  });
});
