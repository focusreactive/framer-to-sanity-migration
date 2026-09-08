import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPagesData } from "#adapters/shared/pages.ts";
import { collectSitemapUrls } from "#adapters/shared/sitemap-collect.ts";
import { crawlFramer } from "#adapters/framer/crawl.ts";
import { createLogger } from "#lib/logger.ts";
import type { PagesData } from "#ir/pages.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import { loadInventoryFixture } from "../../../../fixtures/inventory/load.ts";

const FIXTURE_NAME = "pearlstudio";
const FIXTURE_DIR = join(import.meta.dirname, "../../../../fixtures/inventory/framer", FIXTURE_NAME);

describe("framer inventory fixtures", () => {
  it(`crawls the "${FIXTURE_NAME}" fixture into the expected PagesData`, async () => {
    const fixture = await loadInventoryFixture(FIXTURE_DIR);
    const expected = JSON.parse(await readFile(join(FIXTURE_DIR, "expected-pages.json"), "utf8")) as PagesData;

    const logger = createLogger({ level: "error" });
    const projectPath = await mkdtemp(join(tmpdir(), "inventory-fixture-"));
    try {
      const store = await openSnapshotStore(projectPath, fixture.fetchClient);

      const sitemapLocs = await collectSitemapUrls({
        rootSitemapXml: fixture.rootSitemapXml,
        store,
        logger,
      });

      const { pages } = await crawlFramer({
        origin: new URL(fixture.sourceUrl).origin,
        sitemapUrls: sitemapLocs,
        sourceUrl: fixture.sourceUrl,
        store,
        maxPages: 100,
        logger,
      });

      const result = buildPagesData(pages);

      expect(result, `inventory fixture "${FIXTURE_NAME}"`).toEqual(expected);
    } finally {
      await rm(projectPath, { recursive: true, force: true });
    }
  });
});
