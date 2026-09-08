import { parseSearchIndexPaths } from "#adapters/framer/searchindex.ts";

describe("parseSearchIndexPaths", () => {
  it("collects every path the index is keyed by", () => {
    const body = JSON.stringify({ "/": {}, "/work/atlas": {} });
    expect(parseSearchIndexPaths(body)).toEqual(["/", "/work/atlas"]);
  });

  it("ignores keys that are not paths", () => {
    expect(parseSearchIndexPaths(JSON.stringify({ version: 3, "/about": {} }))).toEqual(["/about"]);
  });

  it("returns an empty list for a body it cannot parse", () => {
    expect(parseSearchIndexPaths("not json")).toEqual([]);
  });
});
