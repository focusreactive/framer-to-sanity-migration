import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { crawlFramer } from "#adapters/framer/crawl.ts";
import type { FetchClient, FetchResponse } from "#lib/fetch/create-fetch-client/index.ts";
import type { Logger } from "#lib/logger.ts";
import { openSnapshotStore } from "#lib/snapshot-store/index.ts";
import type { SnapshotStore } from "#lib/snapshot-store/types.ts";

const ORIGIN = "https://example.com";

function fetchResponse(url: string, overrides: Partial<FetchResponse> = {}): FetchResponse {
  return {
    status: 200,
    finalUrl: url,
    redirectChain: [],
    headers: { "content-type": "text/html" },
    body: Buffer.from(""),
    ...overrides,
  };
}

function createFakeFetchClient(responses: Record<string, FetchResponse>): FetchClient & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    fetch(url: string): Promise<FetchResponse> {
      calls.push(url);
      const response = responses[url];
      if (!response) {
        throw new Error(`fake client: no response configured for ${url}`);
      }
      return Promise.resolve(response);
    },
    setCrawlDelayMs(): void {},
  };
}

function silentLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  };
}

function hydratePayload(opts: {
  routeId: string;
  collectionItemId?: string;
  pathVariables?: Record<string, string>;
}): string {
  const json = JSON.stringify({
    routeId: opts.routeId,
    ...(opts.collectionItemId !== undefined && { collectionItemId: opts.collectionItemId }),
    ...(opts.pathVariables !== undefined && { pathVariables: opts.pathVariables }),
  });

  return json.replace(/"/g, "&quot;");
}

function staticPage(routeId: string, body = ""): string {
  return `<!doctype html><html><head></head><body data-framer-hydrate-v2="${hydratePayload({ routeId })}">${body}</body></html>`;
}

function itemPage(routeId: string, collectionItemId: string, slug: string, body = ""): string {
  const payload = hydratePayload({ routeId, collectionItemId, pathVariables: { slug } });
  return `<!doctype html><html><head></head><body data-framer-hydrate-v2="${payload}">${body}</body></html>`;
}

function nonFramerPage(body = ""): string {
  return `<!doctype html><html><head></head><body>${body}</body></html>`;
}

async function withStore(
  responses: Record<string, FetchResponse>,
  run: (store: SnapshotStore, client: FetchClient & { calls: string[] }) => Promise<void>,
): Promise<void> {
  const projectPath = await mkdtemp(join(tmpdir(), "crawl-framer-test-"));
  try {
    const client = createFakeFetchClient(responses);
    const store = await openSnapshotStore(projectPath, client);
    await run(store, client);
  } finally {
    await rm(projectPath, { recursive: true, force: true });
  }
}

describe("crawlFramer", () => {
  it("classifies a page whose hydrate payload carries a collectionItemId as an item, with collectionKey set to the hydrate routeId", async () => {
    const home = `${ORIGIN}/`;
    const item = `${ORIGIN}/work/atlas`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("routeHome", `<a href="/work/atlas">Atlas</a>`)),
        }),
        [item]: fetchResponse(item, {
          body: Buffer.from(itemPage("col-work", "item-atlas", "atlas")),
        }),
      },
      async (store) => {
        const result = await crawlFramer({
          origin: ORIGIN,
          sitemapUrls: [],
          sourceUrl: home,
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        const byRoute = new Map(result.pages.map((page) => [page.route, page]));

        expect(byRoute.get("/work/atlas")).toMatchObject({
          kind: "item",
          collectionKey: "col-work",
          slug: "atlas",
        });
      },
    );
  });

  it("classifies a page without a collectionItemId as static", async () => {
    const home = `${ORIGIN}/`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(staticPage("routeHome")),
        }),
      },
      async (store) => {
        const result = await crawlFramer({
          origin: ORIGIN,
          sitemapUrls: [],
          sourceUrl: home,
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        const byRoute = new Map(result.pages.map((page) => [page.route, page]));

        expect(byRoute.get("/")).toMatchObject({
          kind: "static",
        });
        expect(byRoute.get("/")?.collectionKey).toBeUndefined();
      },
    );
  });

  it("flags a non-framer page with a warning and emits no record", async () => {
    const home = `${ORIGIN}/`;

    await withStore(
      {
        [home]: fetchResponse(home, {
          body: Buffer.from(nonFramerPage()),
        }),
      },
      async (store) => {
        const result = await crawlFramer({
          origin: ORIGIN,
          sitemapUrls: [],
          sourceUrl: home,
          store,
          maxPages: 100,
          logger: silentLogger(),
        });

        expect(result.pages).toHaveLength(0);
        expect(result.warnings).toEqual([`non-framer page: ${home}`]);
      },
    );
  });
});
