import { describe, expect, it } from "vitest";

import { framerInventoryCrawler } from "#adapters/framer/inventory.ts";
import { inventoryCrawlerFor } from "#inventory/inventory-crawler-for.ts";

describe("inventoryCrawlerFor", () => {
  it("returns the framer crawler, the only crawler this tool has", () => {
    expect(inventoryCrawlerFor()).toBe(framerInventoryCrawler);
  });
});
