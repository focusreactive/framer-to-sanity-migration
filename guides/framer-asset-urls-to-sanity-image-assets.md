# Framer asset URLs to Sanity image assets

Every image, font and video a Framer site serves lives on one CDN host,
`framerusercontent.com`, but the same image can still appear under several URLs on that host — an
original and one or more downscaled variants. Turning those URLs into Sanity image assets one-for-one
would mint a reference for every variant of every photograph. Collapsing them correctly means
recognising which URLs are the same asset before minting anything, because Framer gives you no
filename to fall back on if you get it wrong.

## Which URL is the original?

A Framer image URL looks like `framerusercontent.com/images/<id>.<ext>`, optionally followed by a
query string. Two query shapes mean two different things:

- **`?scale-down-to=512|1024|2048`** marks a **generated variant** — a downscaled copy Framer serves
  for smaller viewports. This query parameter is the signal that a URL is not the asset to keep.
- **A bare `?width=&height=`**, or no query string at all, **is the original** — those width/height
  numbers, when present, describe the image's own intrinsic size rather than a requested resize.

Canonicalising a Framer asset URL means stripping the query string entirely once a URL is
recognised as belonging to this host — the query never changes which image it is, only which
rendition. Any reference to a `scale-down-to` variant is skipped before anything is downloaded;
only the canonical, query-stripped URL is fetched, and it resolves to the same asset regardless of
how many differently-sized `<img src>` values on the page pointed at it.

## What does the filename carry?

Nothing recoverable. The last path segment of a Framer asset URL is an opaque id followed by an
extension — `<opaque-id>.<ext>` — with no trace of whatever the file was named before it was
uploaded to Framer's editor. This is a real difference from source platforms whose asset URLs embed
a platform id *and* the original filename side by side: here there is only the id, and the id is
meaningless outside Framer's own storage. So the asset this pipeline records is named from that
opaque id and its extension, not from a human-readable original name — the studio's media browser
shows an id-derived name rather than `hero-photo.jpg`, and that is the honest state of the
information available from a published page.

## How does a deduplicated asset become a Sanity image reference?

Sanity addresses an uploaded image by an asset id of the shape `image-<sha>-<width>x<height>-<ext>`.
This pipeline mints that same shape itself, from the asset record's content SHA-256 and its file
extension, before any file has actually been uploaded to a dataset:

```ts
// src/scripts/generate/steps/scaffold/input-value.ts
export function syntheticAssetRef(meta: { sha: string; width?: number; height?: number; ext: string }): string {
  return `image-${meta.sha}-${String(meta.width ?? 0)}x${String(meta.height ?? 0)}-${meta.ext}`;
}
```

That ref has to be **deterministic**: the same source image always produces the same ref, on this
run and on the next one. Every field that points at an image — an image field, a rich-text `<img>` —
is resolved to this same synthetic reference independently, so a real upload step only has to know
one rule to reconcile them: hash the uploaded file and match it back to the ref that was minted for
it. A random or incrementing id would break that link and make every re-run of `generate`
non-reproducible.

Before the real dataset exists — while a block's component is still being reviewed against the
frozen reference — that reference has to resolve to real bytes somewhere. A generated component
imports `urlFor()` from `@/sanity/image`, which in the deliverable is Sanity's own image-url
builder. The review harness aliases that import to a stub that parses the synthetic ref back into
its SHA and extension and points at `/__mig-asset/` — the prefix the harness mounts its asset
handler on, which looks the SHA up in the media artifact and streams the downloaded file out of the
snapshot store:

```ts
// src/scripts/generate/steps/scaffold/url-for.ts
export const SANITY_ASSET_ROUTE_PREFIX = "/__mig-asset/";
const IMAGE_REF = /^image-([a-f0-9]+)-\d+x\d+-([a-z0-9]+)$/;
```

So a component under review renders the actual migrated image, addressed exactly the way it will be
once the asset is uploaded and the reference becomes real — no placeholder, and no dependency on
Sanity's CDN existing yet.

## Source in this repository

- [`src/adapters/framer/media-normalize.ts`](../src/adapters/framer/media-normalize.ts) —
  canonicalising the CDN host, the `scale-down-to` variant check, deriving the opaque id
- [`src/scripts/generate/steps/scaffold/input-value.ts`](../src/scripts/generate/steps/scaffold/input-value.ts)
  — minting the synthetic image and file references
- [`src/scripts/generate/steps/scaffold/url-for.ts`](../src/scripts/generate/steps/scaffold/url-for.ts)
  — the asset route prefix and parsing a synthetic ref back into its SHA and extension

## Related

- [Reading a Framer content model from a published site](read-framer-content-model-from-published-site.md)
  — how these same CDN URLs are found in the first place
- [Framer sections to Sanity blocks](framer-sections-to-sanity-blocks.md) — how fields point at
  image assets
