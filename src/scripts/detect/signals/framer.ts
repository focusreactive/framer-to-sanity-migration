import type { Signal } from "#detect/types.ts";
import { countMatches, hit, hostname, inRegion } from "#detect/utils/signal-match.ts";

const NAME_ATTR_MIN_HITS = 5;
const HASH_CLASS_MIN_HITS = 10;
const CONTENT_ASSET_MIN_HITS = 3;

export const framerSignals: Signal[] = [
  {
    id: "fr-meta-generator",
    platform: "framer",
    description: 'meta name=generator content="Framer <7hex>", either order (row 1)',
    tier: "strong",
    family: "fr-publish-marks",
    tier1Html: true,
    match: inRegion(
      "fullHtml",
      /<meta\b[^>]*(?:name="generator"[^>]*content="Framer\s+[0-9a-f]{6,8}"|content="Framer\s+[0-9a-f]{6,8}"[^>]*name="generator")[^>]*>/i,
    ),
  },
  {
    id: "fr-comment-madein",
    platform: "framer",
    description: 'HTML comment "Built with Framer" OR "Made in Framer" (row 2)',
    tier: "strong",
    family: "fr-publish-marks",
    tier1Html: true,
    match: inRegion("fullHtml", /<!--[^>]*(?:Built with Framer|Made in Framer)/i),
  },
  {
    id: "fr-meta-search-index",
    platform: "framer",
    description: 'meta name="framer-search-index" (row 3)',
    tier: "strong",
    tier1Html: true,
    match: inRegion("fullHtml", /name="framer-search-index"/i),
  },
  {
    id: "fr-div-hydrate-v2",
    platform: "framer",
    description: "div#main data-framer-hydrate-v2 SSR hydration JSON (row 4)",
    tier: "strong",
    family: "fr-ssr-container",
    tier1Html: true,
    match: inRegion("fullHtml", /data-framer-hydrate-v2=/i),
  },
  {
    id: "fr-div-ssr-released-at",
    platform: "framer",
    description: "data-framer-ssr-released-at ISO date on div#main (row 5)",
    tier: "strong",
    family: "fr-ssr-container",
    tier1Html: true,
    match: inRegion("fullHtml", /data-framer-ssr-released-at="[^"]*"/i),
  },
  {
    id: "fr-div-page-optimized-at",
    platform: "framer",
    description: "data-framer-page-optimized-at ISO date on div#main (row 6)",
    tier: "strong",
    family: "fr-ssr-container",
    tier1Html: true,
    match: inRegion("fullHtml", /data-framer-page-optimized-at="[^"]*"/i),
  },
  {
    id: "fr-script-bundle-main",
    platform: "framer",
    description: 'main bundle: data-framer-bundle="main" OR /sites/<id>/script_main.<hash>.mjs (row 7)',
    tier: "strong",
    tier1Html: true,
    match: inRegion(
      "fullHtml",
      /data-framer-bundle="main"|framerusercontent\.com\/sites\/[^"']+\/script_main\.[^"']+\.mjs/i,
    ),
  },
  {
    id: "fr-script-analytics",
    platform: "framer",
    description: "events.framer.com/script analytics, with/without ?v=2 (row 8)",
    tier: "strong",
    tier1Html: true,
    match: inRegion("fullHtml", /events\.framer\.com\/script/i),
  },
  {
    id: "fr-header-server",
    platform: "framer",
    description: "server: Framer/<hash> response header (row 9)",
    tier: "strong",
    match: (view) => {
      const server = view.headers["server"];
      return server && /Framer\/[0-9a-f]{5,}/i.test(server) ? hit(`server: ${server}`) : null;
    },
  },
  {
    id: "fr-attr-name-count",
    platform: "framer",
    description: "data-framer-name / component-type >=5 occurrences (row 10)",
    tier: "strong",
    family: "fr-data-attrs",
    tier1Html: true,
    match: (view) => {
      const count = countMatches(/data-framer-(?:name|component-type)=/gi, view.fullHtml);
      return count >= NAME_ATTR_MIN_HITS ? hit(`data-framer-name/component-type ×${count}`) : null;
    },
  },
  {
    id: "fr-asset-sites",
    platform: "framer",
    description: "framerusercontent.com/sites/<siteId>/ published assets (row 11)",
    tier: "strong",
    family: "fr-cdn",
    tier1Html: true,
    match: inRegion("fullHtml", /framerusercontent\.com\/sites\//i),
  },
  {
    id: "fr-url-host",
    platform: "framer",
    description: "host *.framer.website|app|photos|media|wiki (row 12)",
    tier: "strong",
    instant: true,
    tier1Html: true,
    match: (view) => {
      for (const url of [view.finalUrl, view.sourceUrl]) {
        const host = hostname(url);
        if (host && /\.framer\.(?:website|app|photos|media|wiki)$/.test(host)) {
          return hit(`host ${host}`);
        }
      }
      return null;
    },
  },
  {
    id: "fr-link-modulepreload",
    platform: "framer",
    description: "modulepreload of framerusercontent chunk (row 13)",
    tier: "medium",
    family: "fr-cdn",
    match: inRegion(
      "fullHtml",
      /rel="modulepreload"[^>]*framerusercontent\.com|framerusercontent\.com[^>]*rel="modulepreload"/i,
    ),
  },
  {
    id: "fr-style-css-ssr",
    platform: "framer",
    description: "style[data-framer-css-ssr-minified] inline SSR CSS (row 14)",
    tier: "medium",
    family: "fr-css",
    match: inRegion("fullHtml", /data-framer-css-ssr-minified/i),
  },
  {
    id: "fr-style-breakpoint-css",
    platform: "framer",
    description: "style[data-framer-breakpoint-css] (row 15)",
    tier: "medium",
    family: "fr-css",
    match: inRegion("fullHtml", /data-framer-breakpoint-css/i),
  },
  {
    id: "fr-class-framer-hash",
    platform: "framer",
    description: "framer-<hash> classes >=10 occurrences (row 16)",
    tier: "medium",
    family: "fr-css",
    match: (view) => {
      const count = countMatches(/(?<![-\w])framer-[A-Za-z0-9]{4,}/g, view.fullHtml);
      return count >= HASH_CLASS_MIN_HITS ? hit(`framer-<hash> classes ×${count}`) : null;
    },
  },
  {
    id: "fr-class-styles-preset",
    platform: "framer",
    description: "framer-styles-preset-<hash> text preset class (row 17)",
    tier: "medium",
    family: "fr-css",
    match: inRegion("fullHtml", /framer-styles-preset-[a-z0-9]+/i),
  },
  {
    id: "fr-css-token-var",
    platform: "framer",
    description: "CSS var --token-<UUIDv4> design token (row 18)",
    tier: "medium",
    family: "fr-css",
    match: inRegion("fullHtml", /--token-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i),
  },
  {
    id: "fr-div-root",
    platform: "framer",
    description: "div[data-framer-root] root wrapper (row 19)",
    tier: "medium",
    family: "fr-ssr-container",
    match: inRegion("fullHtml", /data-framer-root/i),
  },
  {
    id: "fr-font-framerstatic",
    platform: "framer",
    description: "font on app.framerstatic.com (row 20)",
    tier: "medium",
    family: "fr-cdn",
    match: inRegion("fullHtml", /app\.framerstatic\.com/i),
  },
  {
    id: "fr-script-appear",
    platform: "framer",
    description: 'script[type="framer/appear"] appear-animation content (row 21)',
    tier: "medium",
    match: inRegion("fullHtml", /type="framer\/appear"/i),
  },
  {
    id: "fr-meta-search-index-fallback",
    platform: "framer",
    description: 'meta name="framer-search-index-fallback" (2026 runtime) (row 22)',
    tier: "medium",
    match: inRegion("fullHtml", /name="framer-search-index-fallback"/i),
  },
  {
    id: "fr-og-image-usercontent",
    platform: "framer",
    description: "og:image / apple-touch-icon on framerusercontent/images (row 23)",
    tier: "medium",
    family: "fr-cdn",
    match: inRegion("fullHtml", /(?:property="og:image"|rel="apple-touch-icon")[^>]*framerusercontent\.com\/images\//i),
  },
  {
    id: "fr-asset-usercontent-content",
    platform: "framer",
    description: "framerusercontent.com/images|assets/ >=3 occurrences (row 24)",
    tier: "medium",
    family: "fr-cdn",
    match: (view) => {
      const count = countMatches(/framerusercontent\.com\/(?:images|assets)\//gi, view.fullHtml);
      return count >= CONTENT_ASSET_MIN_HITS ? hit(`framerusercontent.com/images|assets ×${count}`) : null;
    },
  },
  {
    id: "fr-header-server-timing",
    platform: "framer",
    description: "server-timing with ssg-status + route id=<routeId> (row 25)",
    tier: "medium",
    match: (view) => {
      const value = view.headers["server-timing"];
      return value && /ssg-status/i.test(value) && /route;[^,]*desc="id=/i.test(value) ?
          hit(`server-timing: ${value}`)
        : null;
    },
  },
  {
    id: "fr-badge-container",
    platform: "framer",
    description: "div#__framer-badge-container (free *.framer.website only) (row 26)",
    tier: "medium",
    match: inRegion("fullHtml", /__framer-badge-container/i),
  },
  {
    id: "fr-script-editorbar",
    platform: "framer",
    description: "inline editorbar script __framer_force_showing_editorbar_since (row 27)",
    tier: "medium",
    match: inRegion("fullHtml", /__framer_force_showing_editorbar_since/i),
  },
  {
    id: "fr-body-class-framer-body",
    platform: "framer",
    description: "body class framer-body-<routeId>-framer-<projectId> (old runtime) (row 28)",
    tier: "weak",
    family: "fr-ssr-container",
    match: inRegion("fullHtml", /framer-body-[A-Za-z0-9]+-framer-[A-Za-z0-9]+/i),
  },
  {
    id: "fr-attr-misc-data-framer",
    platform: "framer",
    description: "misc data-framer-* attributes (cursor, generated, stack, …) (row 29)",
    tier: "weak",
    family: "fr-data-attrs",
    match: inRegion(
      "fullHtml",
      /data-framer-(?:page-link-current|background-image-wrapper|cursor|generated|preserve-params|legacy-stack-gap-enabled|stack-[a-z-]+|original-sizes)/i,
    ),
  },
  {
    id: "fr-attr-appear-id",
    platform: "framer",
    description: "data-framer-appear-id on animated elements (row 30)",
    tier: "weak",
    family: "fr-data-attrs",
    match: inRegion("fullHtml", /data-framer-appear-id/i),
  },
  {
    id: "fr-comment-published",
    platform: "framer",
    description: 'HTML comment "Published <date> UTC" (row 31)',
    tier: "weak",
    family: "fr-publish-marks",
    match: inRegion("fullHtml", /<!--\s*Published\b[^>]*UTC\s*-->/i),
  },
  {
    id: "fr-div-overlay",
    platform: "framer",
    description: "div#overlay paired with div#main[data-framer-hydrate-v2] (row 32)",
    tier: "weak",
    family: "fr-ssr-container",
    match: (view) =>
      /data-framer-hydrate-v2=/i.test(view.fullHtml) && /id="overlay"/i.test(view.fullHtml) ?
        hit("div#main[data-framer-hydrate-v2] + div#overlay")
      : null,
  },
  {
    id: "fr-html-redirect-timezone",
    platform: "framer",
    description: "data-redirect-timezone on <html> (row 33)",
    tier: "weak",
    match: inRegion("htmlTag", /data-redirect-timezone="[^"]*"/i),
  },
  {
    id: "fr-meta-html-plugin",
    platform: "framer",
    description: 'meta name="framer-html-plugin" (row 34)',
    tier: "weak",
    match: inRegion("fullHtml", /name="framer-html-plugin"/i),
  },
  {
    id: "fr-comment-headstart-slots",
    platform: "framer",
    description: 'custom-code slot comments "Start/End of headStart" (row 35)',
    tier: "weak",
    match: inRegion("fullHtml", /<!--\s*(?:Start|End) of headStart\s*-->/i),
  },
];
