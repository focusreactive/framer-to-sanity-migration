import { crawlFramer } from "#adapters/framer/crawl.ts";
import type { InventoryCrawler } from "#adapters/shared/inventory.ts";

export const framerInventoryCrawler: InventoryCrawler = async (context) => {
  const { searchIndexUrl } = context.platformHints;

  return crawlFramer({
    origin: context.origin,
    sitemapUrls: context.sitemapUrls,
    ...(searchIndexUrl !== undefined && { searchIndexUrl }),
    sourceUrl: context.sourceUrl,
    store: context.store,
    maxPages: context.maxPages,
    logger: context.logger,
  });
};
