import { parseHydrateV2 } from "#adapters/framer/hydrate.ts";

describe("parseHydrateV2", () => {
  it("reads the route id, collection item id and path variables", () => {
    const payload = JSON.stringify({
      routeId: "augiA20Il",
      collectionItemId: "kDf92",
      pathVariables: { slug: "studio-pearl" },
    }).replace(/"/g, "&quot;");

    const parsed = parseHydrateV2(`<div data-framer-hydrate-v2="${payload}"></div>`);

    expect(parsed.routeId).toBe("augiA20Il");
    expect(parsed.collectionItemId).toBe("kDf92");
    expect(parsed.pathVariables).toEqual({ slug: "studio-pearl" });
  });

  it("returns an undefined route id for a page that is not framer", () => {
    expect(parseHydrateV2("<h1>hello</h1>").routeId).toBeUndefined();
  });
});
