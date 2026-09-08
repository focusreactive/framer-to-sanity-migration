import type { ProbeView } from "#detect/probe-view.ts";
import { type PlatformHints } from "#ir/detect.ts";

export function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

const FRAMER_SITES_URL_RE = /framerusercontent\.com\/sites\/([^/"'?]+)\//i;
const SEARCH_INDEX_META_TAG_RE = /<meta\b[^>]*name="framer-search-index"[^>]*>/i;
const CONTENT_ATTR_RE = /content="([^"]*)"/i;
const HYDRATE_V2_RE = /data-framer-hydrate-v2=["']([^"']*)["']/i;

function extractAttr(re: RegExp, source: string): string | undefined {
  return re.exec(source)?.[1];
}

function extractSearchIndexUrl(view: ProbeView): string | undefined {
  const tag = SEARCH_INDEX_META_TAG_RE.exec(view.head)?.[0] ?? SEARCH_INDEX_META_TAG_RE.exec(view.fullHtml)?.[0];
  return tag === undefined ? undefined : extractAttr(CONTENT_ATTR_RE, tag);
}

function extractFramerSiteId(view: ProbeView, searchIndexUrl: string | undefined): string | undefined {
  return (
    extractAttr(FRAMER_SITES_URL_RE, view.head)
    ?? extractAttr(FRAMER_SITES_URL_RE, view.fullHtml)
    ?? (searchIndexUrl === undefined ? undefined : extractAttr(FRAMER_SITES_URL_RE, searchIndexUrl))
  );
}

type FramerBreakpoint = NonNullable<PlatformHints["framerBreakpoints"]>[number];

function isFramerBreakpoint(value: unknown): value is FramerBreakpoint {
  return (
    typeof value === "object"
    && value !== null
    && typeof (value as Record<string, unknown>)["hash"] === "string"
    && typeof (value as Record<string, unknown>)["mediaQuery"] === "string"
  );
}

interface HydrateHints {
  framerRouteId?: string;
  framerBreakpoints?: FramerBreakpoint[];
}

function extractHydrateHints(view: ProbeView): HydrateHints {
  const raw = extractAttr(HYDRATE_V2_RE, view.fullHtml);
  if (raw === undefined) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeHtmlAttribute(raw));
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  const routeId = record["routeId"];
  const breakpoints = record["breakpoints"];

  return {
    ...(typeof routeId === "string" && { framerRouteId: routeId }),
    ...(Array.isArray(breakpoints)
      && breakpoints.every(isFramerBreakpoint) && {
        framerBreakpoints: breakpoints.map(({ hash, mediaQuery }) => ({
          hash,
          mediaQuery,
        })),
      }),
  };
}

export function extractPlatformHints(view: ProbeView): PlatformHints {
  const searchIndexUrl = extractSearchIndexUrl(view);
  const framerSiteId = extractFramerSiteId(view, searchIndexUrl);
  const { framerRouteId, framerBreakpoints } = extractHydrateHints(view);

  return {
    ...(framerSiteId !== undefined && { framerSiteId }),
    ...(searchIndexUrl !== undefined && { searchIndexUrl }),
    ...(framerRouteId !== undefined && { framerRouteId }),
    ...(framerBreakpoints !== undefined && { framerBreakpoints }),
  };
}
