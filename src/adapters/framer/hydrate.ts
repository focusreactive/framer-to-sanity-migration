import { decodeHtmlAttribute } from "#detect/hints.ts";

export interface FramerHydrate {
  routeId?: string;
  localeId?: string;
  collectionItemId?: string;
  pathVariables?: Record<string, string>;
}

const HYDRATE_V2_RE = /data-framer-hydrate-v2=["']([^"']*)["']/i;

function extractStringPathVariables(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );

  return Object.fromEntries(entries);
}

export function parseHydrateV2(html: string): FramerHydrate {
  const raw = HYDRATE_V2_RE.exec(html)?.[1];
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
  const localeId = record["localeId"];
  const collectionItemId = record["collectionItemId"];
  const pathVariables = extractStringPathVariables(record["pathVariables"]);

  return {
    ...(typeof routeId === "string" && { routeId }),
    ...(typeof localeId === "string" && { localeId }),
    ...(typeof collectionItemId === "string" && { collectionItemId }),
    ...(pathVariables !== undefined && { pathVariables }),
  };
}
