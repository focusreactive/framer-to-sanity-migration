# Detecting Framer from a published page

A published Framer site can be identified from a single page fetch, with no API access and no
credentials. As with any published-page fingerprint, no single marker is trustworthy on its own —
a `server` header can be stripped by a proxy, an asset host can be copied, a meta tag can be hand
authored. A verdict has to come from several signals agreeing, with at least one of them hard to
fake by accident.

This is how the `detect` phase in this repository gates a migration run: it scores 35 signals
against the home page and refuses to continue unless the result clears both a numeric threshold and
a structural condition.

## Which markers identify a Framer page?

Four signals carry most of the weight.

- **The `server: Framer/<build>` response header.** Framer's edge sets this on every response it
  serves, `<build>` being a short hex build id. It is strong evidence, but a header alone is
  evidence about the server, not the page — a CDN or reverse proxy in front of a different origin
  could reproduce header-shaped output.
- **`data-framer-hydrate-v2` on the mount node.** The attribute holds a JSON payload that the client
  runtime reads to hydrate the page: `routeId` (which collection or static route this page belongs
  to), `collectionItemId` (present only when the page is a CMS item), `pathVariables` (the item's
  route parameters, its slug among them), `localeId`, and `breakpoints` (the responsive breakpoint
  set the page was authored against). This is the richest signal on the page, because it is also
  the source of the content-model facts used later in the pipeline — see [Reading a Framer content
  model from a published site](read-framer-content-model-from-published-site.md).
- **`framerusercontent.com` as the origin of every asset.** Every image, font and video a Framer
  site serves lives on this one CDN host, under `/sites/<id>/`, `/images/`, or `/assets/`. Seeing it
  repeatedly, or seeing the `/sites/<id>/` path specifically, is strong evidence — but a site can
  self-host copies of Framer-exported assets without being a Framer site, so this signal alone is
  not a verdict.
- **The `<meta name="framer-search-index">` tag.** Its `content` attribute is a URL to a JSON
  document that enumerates every CMS route the site publishes, and that URL embeds the site id
  under `/sites/<id>/`. Its presence is strong evidence on its own, and it doubles as the way the
  `inventory` phase finds CMS pages a sitemap might miss.

Beyond these four, the registry carries markers of the same three kinds seen on other page-builder
platforms: publish marks (`<meta name="generator" content="Framer <hex>">`, an HTML comment reading
"Built with Framer" or "Made in Framer"), the SSR container's own attributes
(`data-framer-ssr-released-at`, `data-framer-page-optimized-at`), and the main bundle marker
(`data-framer-bundle="main"` or a `framerusercontent.com/sites/<id>/script_main.<hash>.mjs` script
tag), plus the analytics beacon at `events.framer.com/script`.

## How much evidence is enough?

Each signal carries a tier, and each tier a weight: `strong` = 3, `medium` = 2, `weak` = 1. A page
needs a total score of **6** to be called Framer.

Two rules keep that number honest.

**Families are capped.** Related signals are grouped — the SSR container's attributes, the
`data-framer-*` attribute family — and each group contributes at most 6 to the score regardless of
how many of its members hit. Without the cap, a page carrying a handful of `data-framer-*`
attributes for unrelated reasons could clear the threshold on one family alone. Capping forces
corroboration from an unrelated kind of evidence.

**A weak-but-broad pile is not a verdict.** Clearing 6 is necessary but not sufficient: the run also
requires at least one strong signal that is observable directly in the page's own HTML — most of
the strong signals carry that flag — because a page that failed every HTML check but had a spoofed
`server` header should not pass. The `server` header, real as it is, is evidence about the response,
not the markup, so it cannot carry a verdict by itself.

Anything short of both conditions yields `unknown`, and the migration stops rather than guessing.

## Why isn't one signal enough?

Each individual signal answers a narrower question than "is this Framer" — `framerusercontent.com`
answers "does this page reference Framer's CDN," which a site could do by copying exported images
into its own build without ever having been built in Framer. `server: Framer/<build>` answers "did
this response come through Framer's edge," which is spoofable at a proxy. Only
`data-framer-hydrate-v2` is tied to the runtime actually executing on the page, which is why it is
treated as the strongest HTML-observable signal in the registry rather than merely corroborating
evidence.

## Source in this repository

- [`src/scripts/detect/signals/framer.ts`](../src/scripts/detect/signals/framer.ts) — the signal
  registry, with the exact pattern behind each one
- [`src/scripts/detect/scoring.ts`](../src/scripts/detect/scoring.ts) — weights, family cap,
  threshold, verdict
- [`src/scripts/detect/hints.ts`](../src/scripts/detect/hints.ts) — extracting the site id and the
  hydration payload

## Related

- [Reading a Framer content model from a published site](read-framer-content-model-from-published-site.md)
  — the next step once the verdict is `framer`
