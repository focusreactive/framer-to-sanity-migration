import type { MediaNormalizer } from "#assets/types.ts";

import type { CanonicalAsset } from "#adapters/shared/canonical-asset.ts";

const FRAMER_ASSET_HOST = "framerusercontent.com";

const SCALE_DOWN_PARAM = "scale-down-to";

function isFramerAsset(url: URL): boolean {
  return url.hostname === FRAMER_ASSET_HOST;
}

export function canonicalizeFramerAssetUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (!isFramerAsset(url)) return rawUrl;
  url.search = "";
  return url.toString();
}

export const framerMediaNormalizer: MediaNormalizer = {
  canonicalize(rawUrl: string): CanonicalAsset {
    const canonicalUrl = canonicalizeFramerAssetUrl(rawUrl);
    const url = new URL(canonicalUrl);
    if (!isFramerAsset(url)) return { canonicalUrl };
    const segment = url.pathname.split("/").pop() ?? "";
    const dot = segment.lastIndexOf(".");
    return { canonicalUrl, ...(dot > 0 && { platformId: segment.slice(0, dot) }) };
  },

  isVariant(rawUrl: string): boolean {
    const url = new URL(rawUrl);
    return isFramerAsset(url) && url.searchParams.has(SCALE_DOWN_PARAM);
  },

  fileName(canonicalUrl: string): string {
    return new URL(canonicalUrl).pathname.split("/").pop() ?? "";
  },
};
