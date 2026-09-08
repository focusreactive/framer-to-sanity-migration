import { DETECT_STEP_ID } from "#detect/constants/ids.ts";
import { detectPlatform } from "#detect/detect-platform.ts";
import { CONFIDENCE_THRESHOLD } from "#detect/scoring.ts";
import { detectDataSchema } from "#ir/detect.ts";
import type { ProbeData } from "#probe/read-probe-data.ts";

const SEARCH_INDEX = "https://framerusercontent.com/sites/abc123/searchIndex-x.json";

function probeData(homeHtml: string, headers: Record<string, string> = {}): ProbeData {
  return {
    sourceUrl: "https://example.com/",
    homeHtml,
    homeHttp: { status: 200, finalUrl: "https://example.com/", redirectChain: [], headers },
  };
}

describe("detectPlatform", () => {
  it("exposes the detect step id", () => {
    expect(DETECT_STEP_ID).toBe("detect");
  });

  it("returns a framer verdict on a page with a hydrate attribute and a framer server header", () => {
    const html =
      `<html><head><meta name="framer-search-index" content="${SEARCH_INDEX}"></head>`
      + `<body><div data-framer-hydrate-v2='{"routeId":"augiA20Il"}'></div></body></html>`;

    const result = detectPlatform(probeData(html, { server: "Framer/feb0bfd" }));

    expect(result.verdict).toBe("framer");
    expect(result.scores.framer.hasTier1Strong).toBe(true);
    expect(() => detectDataSchema.parse(result)).not.toThrow();
  });

  it("returns unknown on a page with no framer signal", () => {
    const result = detectPlatform(probeData("<html><head></head><body><h1>hello</h1></body></html>"));
    expect(result.verdict).toBe("unknown");
    expect(result.scores.framer.score).toBe(0);
    expect(() => detectDataSchema.parse(result)).not.toThrow();
  });

  it("wires thresholds from the scoring module constants", () => {
    const result = detectPlatform(probeData("<html><head></head><body></body></html>"));

    expect(result.thresholds).toEqual({ confidence: CONFIDENCE_THRESHOLD });
  });
});
