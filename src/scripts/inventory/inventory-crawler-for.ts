import { framerInventoryCrawler } from "#adapters/framer/inventory.ts";

import type { InventoryCrawler } from "#adapters/shared/inventory.ts";

export function inventoryCrawlerFor(): InventoryCrawler {
  return framerInventoryCrawler;
}
