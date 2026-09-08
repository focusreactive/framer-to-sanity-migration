import { parseHydrateV2 } from "#adapters/framer/hydrate.ts";
import type { ClassifiedPage } from "#adapters/shared/pages.ts";
import { extractAnchorHrefs } from "#lib/html.ts";
import type { Logger } from "#lib/logger.ts";
import { normalizeUrl, routeFromUrl } from "#lib/url.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";
import { parseSearchIndexPaths } from "./searchindex.ts";

type ClassifiedFields = Omit<ClassifiedPage, "source">;

type CrawlSource = "sitemap" | "crawl" | "searchindex";

interface QueueItem {
  url: string;
  source: CrawlSource;
}

export interface CrawlResult {
  pages: ClassifiedPage[];
  warnings: string[];
}

function firstPathVariable(pathVariables: Record<string, string> | undefined): string | undefined {
  if (pathVariables === undefined) return undefined;
  return Object.values(pathVariables)[0];
}

export async function crawlFramer(opts: {
  origin: string;
  sitemapUrls: string[];
  searchIndexUrl?: string;
  sourceUrl: string;
  store: SnapshotStore;
  maxPages: number;
  logger: Logger;
}): Promise<CrawlResult> {
  const { origin, sitemapUrls, searchIndexUrl, sourceUrl, store, maxPages, logger } = opts;

  const warnings: string[] = [];
  const warn = (message: string): void => {
    warnings.push(message);
    logger.warn(message);
  };

  const sourcesByUrl = new Map<string, Set<CrawlSource>>();
  const visited = new Set<string>();
  const queued = new Set<string>();
  const queue: QueueItem[] = [];

  const enqueue = (rawUrl: string, source: CrawlSource): void => {
    let normalized: string;
    try {
      normalized = normalizeUrl(rawUrl);
    } catch {
      return;
    }

    const sources = sourcesByUrl.get(normalized);
    if (sources) {
      sources.add(source);
    } else {
      sourcesByUrl.set(normalized, new Set([source]));
    }

    if (visited.has(normalized) || queued.has(normalized)) return;
    queued.add(normalized);
    queue.push({ url: normalized, source });
  };

  const followLinks = sitemapUrls.length === 0;

  const nextItem = (): QueueItem | undefined => queue.shift();

  if (sitemapUrls.length > 0) {
    enqueue(sourceUrl, "crawl");
    for (const url of sitemapUrls) {
      let sitemapOrigin: string;
      try {
        sitemapOrigin = new URL(url).origin;
      } catch {
        continue;
      }
      if (sitemapOrigin !== origin) continue;

      enqueue(url, "sitemap");
    }
  } else {
    if (searchIndexUrl !== undefined) {
      try {
        const entry = await store.fetchInto(searchIndexUrl, "data");
        const body = await store.readBody(entry);
        const paths = parseSearchIndexPaths(body.toString("utf8"));
        for (const path of paths) {
          enqueue(new URL(path, origin).toString(), "searchindex");
        }
      } catch (error) {
        warn(`searchIndex fetch error: ${searchIndexUrl}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    enqueue(sourceUrl, "crawl");
  }

  const classifiedByUrl = new Map<string, ClassifiedFields>();
  let fetchedCount = 0;

  for (;;) {
    const item = nextItem();
    if (!item) break;

    if (fetchedCount >= maxPages) {
      warn(`maxPages reached (${maxPages})`);
      break;
    }

    queued.delete(item.url);
    visited.add(item.url);

    fetchedCount += 1;

    let entry;
    try {
      entry = await store.fetchInto(item.url, "page");
    } catch (error) {
      warn(`fetch error: ${item.url}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    if (entry.http.status >= 400) {
      warn(`fetch failed: ${item.url} (status ${entry.http.status})`);
      continue;
    }

    const body = await store.readBody(entry);
    const html = body.toString("utf8");
    const hydrate = parseHydrateV2(html);

    if (hydrate.routeId === undefined) {
      warn(`non-framer page: ${item.url}`);
      continue;
    }

    const route = routeFromUrl(entry.http.finalUrl);

    const kind: ClassifiedPage["kind"] = hydrate.collectionItemId !== undefined ? "item" : "static";
    const slug = firstPathVariable(hydrate.pathVariables);

    classifiedByUrl.set(item.url, {
      route,
      kind,
      ...(kind === "item" && { collectionKey: hydrate.routeId }),
      ...(slug !== undefined && { slug }),
      ...(hydrate.localeId !== undefined && { localeId: hydrate.localeId }),
    });

    if (!followLinks) continue;

    for (const href of extractAnchorHrefs(html)) {
      let resolvedUrl: string;
      try {
        resolvedUrl = new URL(href, entry.http.finalUrl).toString();
      } catch {
        continue;
      }

      const normalized = normalizeUrl(resolvedUrl);
      if (new URL(normalized).origin !== origin) continue;

      enqueue(normalized, "crawl");
    }
  }

  const pages: ClassifiedPage[] = [];
  for (const [url, fields] of classifiedByUrl) {
    const sources = sourcesByUrl.get(url);
    if (!sources) {
      throw new Error(`unreachable: no sources recorded for classified url "${url}"`);
    }

    for (const source of sources) {
      pages.push({ ...fields, source });
    }
  }

  return { pages, warnings };
}
