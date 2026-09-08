import { buildProbeView, type ProbeView } from "#detect/probe-view.ts";
import { framerSignals } from "#detect/signals/framer.ts";
import type { Signal } from "#detect/types.ts";
import type { ProbeData } from "#probe/read-probe-data.ts";

type Http = ProbeData["homeHttp"];

function http(overrides: Partial<Http> = {}): Http {
  return {
    status: 200,
    finalUrl: "https://example.com/",
    redirectChain: [],
    headers: {},
    ...overrides,
  };
}

function view(overrides: Partial<ProbeData> = {}): ProbeView {
  return buildProbeView({
    sourceUrl: "https://example.com/",
    homeHtml: "<html><head></head><body></body></html>",
    homeHttp: http(),
    ...overrides,
  });
}

function find(signals: Signal[], id: string): Signal {
  const signal = signals.find((s) => s.id === id);
  if (!signal) throw new Error(`unknown signal id: ${id}`);
  return signal;
}

const allSignals = framerSignals;

describe("signal registry invariants", () => {
  it("has ids unique across the registry", () => {
    const ids = allSignals.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("follows the id mnemonic", () => {
    expect(framerSignals.every((s) => s.id.startsWith("fr-"))).toBe(true);
  });

  it("tags every framer signal with platform framer", () => {
    expect(framerSignals.every((s) => s.platform === "framer")).toBe(true);
  });

  it("gives the registry at least one instant host signal", () => {
    expect(framerSignals.filter((s) => s.instant).length).toBeGreaterThanOrEqual(1);
  });

  it("gives the registry at least five tier1Html signals", () => {
    expect(framerSignals.filter((s) => s.tier1Html).length).toBeGreaterThanOrEqual(5);
  });

  it("marks every instant signal as tier1Html", () => {
    expect(allSignals.filter((s) => s.instant).every((s) => s.tier1Html)).toBe(true);
  });
});

describe("framer matchers", () => {
  it("matches the meta generator tag regardless of attribute order", () => {
    const orderA = view({
      homeHtml: '<html><head><meta name="generator" content="Framer feb0bfd"></head></html>',
    });
    const orderB = view({
      homeHtml: '<html><head><meta content="Framer feb0bfd" name="generator"></head></html>',
    });
    expect(find(framerSignals, "fr-meta-generator").match(orderA)).not.toBeNull();
    expect(find(framerSignals, "fr-meta-generator").match(orderB)).not.toBeNull();
  });

  it("matches the Built with Framer / Made in Framer comment", () => {
    const builtWith = view({ homeHtml: "<!-- Built with Framer --><html><body></body></html>" });
    const madeIn = view({ homeHtml: "<!-- Made in Framer --><html><body></body></html>" });
    expect(find(framerSignals, "fr-comment-madein").match(builtWith)).not.toBeNull();
    expect(find(framerSignals, "fr-comment-madein").match(madeIn)).not.toBeNull();
  });

  it("matches the framer-search-index meta tag", () => {
    const v = view({
      homeHtml:
        '<html><head><meta name="framer-search-index" content="https://framerusercontent.com/sites/abc123/searchIndex-x.json"></head></html>',
    });
    expect(find(framerSignals, "fr-meta-search-index").match(v)).not.toBeNull();
  });

  it("matches the data-framer-hydrate-v2 SSR hydration attribute", () => {
    const v = view({
      homeHtml: '<html><body><div id="main" data-framer-hydrate-v2=\'{"routeId":"augiA20Il"}\'></div></body></html>',
    });
    expect(find(framerSignals, "fr-div-hydrate-v2").match(v)).not.toBeNull();
  });

  it("matches the main bundle marker by data attribute or by script_main URL", () => {
    const byAttr = view({ homeHtml: '<html><body><div data-framer-bundle="main"></div></body></html>' });
    const byUrl = view({
      homeHtml:
        '<html><body><script src="https://framerusercontent.com/sites/abc123/script_main.HASH.mjs"></script></body></html>',
    });
    expect(find(framerSignals, "fr-script-bundle-main").match(byAttr)).not.toBeNull();
    expect(find(framerSignals, "fr-script-bundle-main").match(byUrl)).not.toBeNull();
  });

  it("matches the events.framer.com analytics script", () => {
    const v = view({
      homeHtml: '<html><body><script src="https://events.framer.com/script?v=2"></script></body></html>',
    });
    expect(find(framerSignals, "fr-script-analytics").match(v)).not.toBeNull();
  });

  it("matches the Framer/<hash> server response header", () => {
    const v = view({ homeHttp: http({ headers: { server: "Framer/feb0bfd" } }) });
    expect(find(framerSignals, "fr-header-server").match(v)).not.toBeNull();
  });

  it("requires at least 5 data-framer-name/component-type attribute hits", () => {
    const below = view({
      homeHtml: `<html><body>${'<div data-framer-name="x"></div>'.repeat(4)}</body></html>`,
    });
    const atThreshold = view({
      homeHtml: `<html><body>${'<div data-framer-name="x"></div>'.repeat(5)}</body></html>`,
    });
    expect(find(framerSignals, "fr-attr-name-count").match(below)).toBeNull();
    expect(find(framerSignals, "fr-attr-name-count").match(atThreshold)).not.toBeNull();
  });

  it("matches framerusercontent.com/sites/ published assets", () => {
    const v = view({
      homeHtml: '<html><body><img src="https://framerusercontent.com/sites/abc123/image.png"></body></html>',
    });
    expect(find(framerSignals, "fr-asset-sites").match(v)).not.toBeNull();
  });

  it("fires the instant signal on a *.framer.website host (finalUrl or sourceUrl)", () => {
    const byFinal = view({ homeHttp: http({ finalUrl: "https://example.framer.website/" }) });
    const bySource = view({ sourceUrl: "https://example.framer.website/" });
    expect(find(framerSignals, "fr-url-host").match(byFinal)).not.toBeNull();
    expect(find(framerSignals, "fr-url-host").match(bySource)).not.toBeNull();
  });

  it("counts distinct framer-<hash> classes (>=10 = one hit)", () => {
    const below = view({
      homeHtml: `<html><body class="${Array.from({ length: 9 }, (_, i) => `framer-abc${i}`).join(" ")}"></body></html>`,
    });
    const atThreshold = view({
      homeHtml: `<html><body class="${Array.from({ length: 10 }, (_, i) => `framer-abc${i}`).join(" ")}"></body></html>`,
    });
    expect(find(framerSignals, "fr-class-framer-hash").match(below)).toBeNull();
    expect(find(framerSignals, "fr-class-framer-hash").match(atThreshold)).not.toBeNull();
  });

  it("produces ZERO hits for a page that merely mentions framer in text", () => {
    const v = view({
      homeHtml:
        '<html><head></head><body><p>We migrated away from Framer to Vercel last year.</p><a href="/vs/framer">Framer vs us</a></body></html>',
    });
    for (const signal of framerSignals) {
      expect(signal.match(v), `signal ${signal.id} should not match`).toBeNull();
    }
  });
});
