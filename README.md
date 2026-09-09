# framer-to-sanity-migration

Migrate a published Framer site into a Sanity project.

> **This repository is the public slice of [FocusReactive's](https://focusreactive.com) internal migration tooling, and it is cut down in two ways.** It covers one path only — Framer → Sanity — and the pipeline behind that path is itself a simplified but still complete version of the internal one: it runs end-to-end on its own and hands you a working project.

## What you get

A standalone pnpm/turbo workspace with a `studio` and a `web` package, generated from the live site:

- **Document types** for every Framer CMS collection, with their fields typed and their items
  seeded into the dataset
- **Section blocks** as real React components, registered in the page builder and composable in
  the studio
- **Header and footer** as chrome documents, rendered by the app shell
- **Design tokens** — colours, type scale, spacing, radii, shadows — as CSS variables
- **Images and videos** as Sanity image and file assets, referenced by the content that uses them
- **Webfonts** copied into the project and served from it
- **A seed** that fills the dataset from the migration's own artifacts, so the project has content
  the first time you open it

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

You also need a live Sanity target:

- a Sanity project and dataset to migrate into;
- `SANITY_API_WRITE_TOKEN` exported in the shell the migration runs in;
- the API version the generated project talks to is pinned in this repo, at
  `src/scripts/generate/constants/versions.ts` — there is nothing to set in `migrate.config.json`
  for it.

Without the project and the token, the deliverable's `types` and `seed` gates fail — `typegen`
needs a real dataset to extract a schema against, and `seed` needs somewhere to write documents.
Set these up before starting a run, not after the pipeline stalls on them.

## Usage

Launch Claude Code and call migration skill:

```
/migrate https://pearlstudio.framer.website/
```

The migration runs in a workspace beside this repository (`../migrations/<project-name>` by
default, set in `migrate.config.json`); this repository is never written to by a run.

## How it works

Ten phases, in execution order:

| phase           | what it does                                                                          |
| --------------- | ------------------------------------------------------------------------------------- |
| `probe`         | fetches the home page, `robots.txt`, the sitemap and a 404 page                       |
| `detect`        | scores the home page against the Framer signal registry and gates the run             |
| `inventory`     | crawls the site into its page list and its CMS collections                            |
| `snapshot`      | freezes every page: raw HTML, post-hydration DOM, computed styles, screenshots        |
| `assets`        | inventories every image, video and font family behind a stable asset id               |
| `design-tokens` | reads the frozen styles into a token set and emits the theme                          |
| `discovery`     | names the page's blocks, the site's globals and its collections                       |
| `synth`         | authors each surface: field schema, content, and a React component                    |
| `layout`        | composes each route from block instances with their field values                      |
| `generate`      | writes the Sanity Studio + Next.js project, then installs, seeds, builds and lints it |

Run state lives in the project's `.migration/` directory: `manifest.json` records every step and
its status, and `artifacts/` holds the intermediate representation each phase reads and writes.
Every step is idempotent and every run is resumable — point the skill at an existing project and it
picks up at the first step that is not `done`.

## Guides

| guide                                                                                                                  | answers                                                                                                             |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| [Detecting Framer from a published page](guides/detect-framer-from-a-published-page.md)                                | How do you tell that a site is built with Framer, and how confident can you be?                                     |
| [Reading a Framer content model from a published site](guides/read-framer-content-model-from-published-site.md)        | Which pages are CMS items, which collection does each belong to, and how do you find them all without an API token? |
| [Framer asset URLs to Sanity image assets](guides/framer-asset-urls-to-sanity-image-assets.md)                         | Which of these CDN URLs are the same image, and how does it become a Sanity image asset?                            |
| [Freezing a published site so the migration is verifiable](guides/freeze-a-published-site-for-verifiable-migration.md) | How do you prove a rebuilt page matches the original, when screenshots cannot?                                      |
| [Framer sections to Sanity blocks](guides/framer-sections-to-sanity-blocks.md)                                         | Framer has no block model — so where do the Sanity block schemas and the Portable Text come from?                   |

## 🚀 Need Help with Headless CMS Migration?

This repository is maintained by [FocusReactive](https://focusreactive.com) — a specialized Next.js and Headless CMS migration agency.

We help enterprise businesses migrate from legacy monoliths (WordPress, Drupal, Sitecore) and visual builders (Webflow, Framer) to modern stacks like Sanity, Payload CMS, Storyblok, and MedusaJS.

The pipeline in this repository is one path out of that matrix, published in full. The internal version of the same tooling covers the others — if your migration path isn't Framer → Sanity, ask us about it.

### Why FocusReactive?

- **Expertise:** Verified Sanity, Payload, and Storyblok partners.
- **Speed:** We use our proprietary [CMS Kit](https://github.com/focusreactive/cms-kit) to speed up migrations by 40%.
- **SEO & Performance:** Zero downtime migrations with 100/100 Lighthouse scores.

👉 **[Get a Free Migration Consultation](https://focusreactive.com/services/headless-cms-expert-agency/)** or contact us at contact@focusreactive.com.

## License

MIT — see [LICENSE](LICENSE).
