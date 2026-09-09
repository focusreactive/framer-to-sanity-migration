# Reading a Framer content model from a published site

A published Framer site tells you which of its pages are CMS collection items, which collection
each belongs to, and what each item's slug is — all from the hydration payload every page ships in
its HTML. No API token is needed, and none exists to ask for: Framer has no public content API for
a published site.

## How do you find every page?

The crawl branches on one condition — whether a sitemap was found — and the two branches don't mix.

**A sitemap exists.** A published Framer site's `sitemap.xml` is complete — it lists every static
route and every CMS item route the site publishes. When it's present, it is the _sole_ seed source:
the sitemap's URLs plus the entry URL you were given are enqueued, and nothing else is fetched for
routes. Link BFS does not run in this branch, and neither does the search-index endpoint — with a
complete sitemap, both would only rediscover pages already queued.

**No sitemap exists.** Two sources take over, together: the **search-index endpoint**, whose URL
comes from the `<meta name="framer-search-index">` tag (see [Detecting Framer from a published
page](detect-framer-from-a-published-page.md)) — its JSON body's keys are the paths of every CMS
route the site publishes — and **link breadth-first search** from the entry URL, following
same-origin anchors as pages are fetched. Neither is complete on its own: the search index only
enumerates CMS routes, so it says nothing about static pages, and link BFS only finds what's linked
from somewhere already crawled. Running both is how this branch approximates the coverage the
sitemap branch gets for free.

So the search-index endpoint is a fallback route source, not a third source merged in alongside the
sitemap — when a sitemap is present, the search-index endpoint is never fetched.

## How do you tell a collection item page from a static page?

Every route Framer serves through its client runtime carries `data-framer-hydrate-v2` on its mount
node, whose JSON payload is the whole classification rule:

- **`collectionItemId` present** → the page is a CMS collection item. Absent → the page is static.
- **`routeId`** → the id of the collection (or static route) the page belongs to. On an item page,
  this is the collection key; pages sharing a `routeId` belong to the same collection.

That is the entire test — one field decides item-versus-static, and one more field says which
collection. There is no separate "collection" attribute or template marker to check; the collection
identity comes from the same hydration payload that made the page identifiable as Framer in the
first place.

A page whose HTML has no `data-framer-hydrate-v2` payload at all — meaning `routeId` cannot be
parsed out of it — is treated as unreachable rather than static: it is not part of this site's
Framer-rendered surface, so it is dropped from the crawl with a warning rather than misclassified.

## Where does the item's slug come from?

`pathVariables` in the same hydration payload is a small record of the route's dynamic segments —
for a route like `/blog/:slug`, it holds one entry. The **first value** in that record, regardless
of its key name, is taken as the item's slug. Framer does not name the parameter consistently across
collections, so reading it positionally rather than by key name is what makes the rule work
uniformly across every collection a site defines.

## How do collections fall out of that?

Group every item page by its `routeId`. Each group is one collection: the `routeId` is its key, and
its item count is however many item pages the crawl found carrying it. Two Framer-specific
wrinkles worth knowing:

- **Locale.** `localeId` rides along in the same payload and is recorded through the pipeline for
  diagnostics and traceability. Locale migration is out of scope for this version (single-locale
  v1) — nothing downstream reads or collapses it.
- **Route source matters for coverage, not classification.** Whether a page was found via the
  sitemap, link BFS, or the search index changes nothing about how it's classified — the
  `collectionItemId`/`routeId` rule applies identically regardless of how the crawler reached the
  page. Source is recorded for diagnostics only.

## What can't be recovered this way?

**Field names.** Framer's published output carries no field schema — no equivalent of a CMS API
response with named fields, no template metadata declaring "this collection has a `title` and a
`publishedAt`." What you get from crawling is a set of rendered items and the DOM each one produces.
The collection's fields — their names, types and which rendered nodes they came from — are inferred
from comparing those rendered items against each other, which is the job of the `discovery` and
`synth` phases, not this one. That inference is good enough to produce a working, typed Sanity
document type, but it is an inference, not a recovery: a field Framer's editor named `heroSubtitle`
might come out as `subtitle` or `tagline` depending on what the rendered markup made legible.

## Source in this repository

- [`src/adapters/framer/hydrate.ts`](../src/adapters/framer/hydrate.ts) — parsing
  `data-framer-hydrate-v2` into `routeId`, `collectionItemId`, `pathVariables`, `localeId`
- [`src/adapters/framer/crawl.ts`](../src/adapters/framer/crawl.ts) — the sitemap-vs-fallback
  branch, the search-index and link-BFS fallback sources, and the item-versus-static classification
- [`src/adapters/framer/searchindex.ts`](../src/adapters/framer/searchindex.ts) — parsing the
  search-index JSON into route paths

## Related

- [Detecting Framer from a published page](detect-framer-from-a-published-page.md) — the check that
  runs before this
- [Framer sections to Sanity blocks](framer-sections-to-sanity-blocks.md) — where these collections
  and routes end up
