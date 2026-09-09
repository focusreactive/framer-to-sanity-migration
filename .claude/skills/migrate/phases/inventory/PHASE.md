# Inventory phase

Crawling the site into the page/collection list every later stage indexes by:
static routes from the sitemap plus Framer's collection item routes, classified
and deduped. One script, one step (`inventory`).

## Step 1 · inventory (script, manifest step `inventory`)

```
pnpm tsx src/scripts/inventory/index.ts --project <projectPath> [--force]
```

Report the page and collection counts.

```json
{
   "step": "inventory",
   "status": "done" | "skipped",
   "pages": <n>,
   "collections": <n>
}
```

Deterministic work, in order:

1. Read `probe`'s sitemap and `detect`'s platform hints (both already on disk)
   — the hints include `searchIndexUrl` when the home page carried a
   `framer-search-index` meta tag.
2. Collect every sitemap URL, following nested sitemaps through the snapshot
   store (no re-fetching what `probe` already captured).
3. Enumerate routes, in priority order:
   - **Sitemap present.** Seed the queue from the source URL plus every
     same-origin sitemap URL. No link-following happens in this mode — the
     sitemap is treated as the authoritative route list.
   - **No sitemap, search-index present.** Fetch the search-index endpoint
     named by `detect`'s `searchIndexUrl` hint and enqueue every path key it
     returns, then fall back to link-BFS from the source URL for anything the
     index missed.
   - **No sitemap, no search-index.** Link-BFS from the source URL alone,
     following in-origin anchors page by page.
     Each fetched page is parsed for its `data-framer-hydrate-v2` SSR payload;
     pages with a `collectionItemId` are classified as collection items (keyed by
     the hydration payload's `routeId`), everything else is a static page.
4. Write `pages.json` (`{ pages: [...], collections: [...] }`) and record it
   against the `inventory` step.

The whole origin is crawled: there is no route allow-list, and the only ceiling
is `MAX_PAGES` from `src/lib/crawl-defaults.ts`.
