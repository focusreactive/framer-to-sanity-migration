# Generate phase

Turns the whole IR into a working Sanity Studio + Next.js monorepo, then proves
it works by installing, extracting the schema and generating GROQ types,
formatting, seeding the dataset, type-checking, building and linting it. Every
file in the deliverable is written by this tool — there is no boilerplate base
underneath it, and **no generated file is ever hand-edited**: the
`src/scripts/generate/index.ts` CLI owns all writes.

Entered once `layout` is `done` — the phase reads `pages.json`, `blocks.json`,
`globals.json`, `collections.json`, `design-tokens.json`, the synth-staged
components under `.migration/artifacts/synth/`, the per-route layout NDJSON and
the snapshot's fonts.

The deliverable is a pnpm workspace written at the project root, alongside
`.migration/` itself: a `studio/` app (Sanity Studio — schema, structure,
Presentation resolve, the seed script) and a `web/` app (Next.js, `next-sanity`,
Portable Text rendering), tied together by a root `package.json`,
`pnpm-workspace.yaml` and `turbo.json`.

Eight manifest steps, in this order, each its own CLI call:

| #   | step id              | command             |
| --- | --------------------- | -------------------- |
| 1   | `generate:scaffold`  | `--scaffold`         |
| 2   | `generate:install`   | `--gate install`     |
| 3   | `generate:types`     | `--gate types`       |
| 4   | `generate:format`    | `--gate format`      |
| 5   | `generate:seed`      | `--gate seed`        |
| 6   | `generate:typecheck` | `--gate typecheck`   |
| 7   | `generate:build`     | `--gate build`       |
| 8   | `generate:lint`      | `--gate lint`        |

There is no state or plan command: read `steps["generate:*"]` in
`<projectPath>/.migration/manifest.json` and run the first one that is not
`done`. Every step prints its own `done`/`skipped` line, so a repeat run of a
closed step is free and tells you so.

## Preconditions

- Node 22+ and `pnpm` on PATH.
- A real Sanity project. `init-project` already collected its `--project-id`
  and `--dataset` (default `"production"`) into `run-config.json`'s `target` —
  this phase does not ask for them again, it just uses what is there.
- Two separate Sanity tokens, neither ever written into a generated file — not
  `studio/.env`, not `web/.env.local`, not anywhere under `.migration/`:
  - `SANITY_API_WRITE_TOKEN` — used only by `studio/scripts/seed.ts`, so only
    the shell running the `seed` gate needs it (Editor permission or higher).
  - `SANITY_API_READ_TOKEN` — used only by the emitted `web` app's own client,
    at both build time (`generateStaticParams`) and request time (Viewer
    permission is enough). Nothing in `studio/` reads it.

  **Before running `--preflight` or any gate, stop and ask the user for both**
  — do not wait for `--preflight` or the `seed` gate to surface the missing
  write token, and do not wait for the `build` gate's read-access check (below)
  to surface the missing read token. Both gaps are silent and expensive to
  discover late: a run that reaches `seed` without a write token fails only
  after `install`/`types`/`format` already ran, and a dataset that is
  reachable and writable can still be unreadable without (or even with) a
  read token — that failure mode doesn't stop anything, it ships a deliverable
  that builds clean and then 404s on every route once served. Explain the
  split to the user exactly as above (which token, which shell, which
  permission level) so they set the right one in the right place — a write
  token exported for `seed` does not also cover reads, and vice versa.

  A read token is not as sensitive as a write token — it grants no mutation
  ability — so unlike the write token, the user may reasonably choose to save
  themselves repeated exports by adding it directly to `web/.env.local`
  themselves once scaffold has written that file. Scaffold only ever writes
  `web/.env.local` once, if it is absent, so a hand-added line there survives
  every later `--scaffold --force`. Offer this once, but do not do it for
  them — it is their file to edit, not a generated one this tool owns.

Before burning time on the earlier gates, run the read-only preflight:

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --preflight
```

```json
{ "step": "generate:preflight", "problems": [] }
```

It checks `pnpm` is on PATH, that `SANITY_API_WRITE_TOKEN` is set, and that the
token can read and write the target dataset — the same three things that would
otherwise surface thirty minutes in, at the `seed` gate. A non-empty
`problems` list means fix those first; it writes nothing, records no manifest
step, and is safe to repeat.

`--preflight` says nothing about `SANITY_API_READ_TOKEN` — there is no seeded
content yet to check reads against this early, which is exactly why that
conversation with the user has to happen up front instead (above), not by
waiting on this command.

## Step 1 · scaffold (script, manifest step `generate:scaffold`)

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --scaffold [--force]
```

```json
{ "step": "generate:scaffold", "status": "done", "files": 74, "warnings": [] }
```

Writes the whole project in one pass: the workspace root (`package.json`,
`pnpm-workspace.yaml`, `turbo.json`, `.gitignore`), the `studio/` app
(`sanity.config.ts` wired to the run's `projectId`/`dataset`, the structure
tool, the Presentation resolve, one Sanity document type per migrated CMS
collection plus `page`, one document type per chrome global (`header`,
`footer`), every synthesized block as an object type, and the generated
`scripts/seed.ts`), and the `web/` app (the route tree, the block renderer,
GROQ queries, the theme, the fonts and the Portable Text renderer). It also
writes `studio/.env` and `web/.env.local` with the project's `projectId` /
`dataset` / API version — **once**, and only if absent, so a re-run never
clobbers them.

It records the resulting file list in
`.migration/artifacts/generate-files.json` and deletes any previously-written
file that fell out of the current IR. The two env files are outside that
ledger, exactly like the env files above, so stale-file removal can never
touch them.

**Surface every line of `warnings` to the user.** They are the phase's only
report of IR gaps that do not stop the run: a collection with no
`collections.json` entry or an empty section template (no detail route), a
staged section missing its `Component.tsx`, a static route with no layout
NDJSON (the page is seeded as an empty draft), a collection slug renamed after
a collision, two sections sharing a richText field name, and a missing or
empty snapshot `fonts.css` (the app ships without webfonts).

**Repeating is safe.** On a project where the step is already `done` the
script prints `{"step":"generate:scaffold","status":"skipped"}`, writes
nothing and exits 0. Pass `--force` after any IR change — that is the only way
the deliverable picks up re-run upstream units.

Two errors stop the step, and both mean the emission plan itself is wrong:

- **"two route files claim the same URL"** — an emitted `web/` route file
  resolves to the same Next URL as another route file in the tree (route
  groups are ignored, dynamic segments compare by position). `next build`
  refuses this, so the step fails before writing rather than after. Rename the
  collection so its detail route gets a free segment.
- **"emission would overwrite files this tool did not write"** — an emission
  landed on a path that exists but is not in the previous run's ledger. Two
  writers disagree about who owns it; move the emission to a fresh path.

## Steps 2–8 · the gates (scripts, one manifest step each)

Each gate is one manifest step, run from the deliverable's own root
(`<projectPath>`) with that root's `.env` (if present) merged into the
environment the command runs under — this is in addition to whatever the
operator's own shell already exports, so exporting `SANITY_API_WRITE_TOKEN`
directly is enough; there is no need to write it to a file. Every gate is
idempotent: an already-`done` gate prints `skipped` and runs nothing.

```json
{ "step": "generate:build", "status": "done" }
{ "step": "generate:build", "status": "skipped" }
```

A failing blocking gate stops the phase with the last 80 lines of the
command's output on stderr and leaves the step `failed`. Re-run one gate with
`--gate <name> --force` after fixing the cause. `lint` is the one gate that
never fails the step (below).

### Step 2 · install (manifest step `generate:install`) — triage: network or a pinned-dependency conflict

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate install [--force]
```

Runs `pnpm install` (15 min timeout). Blocking.

**On failure**, this is network, or a version conflict between `studio` and
`web`'s pinned dependencies. Do not hand-edit versions in the generated
`package.json` files — the next scaffold overwrites them. The single source of
the deliverable's dependency versions is
`src/scripts/generate/constants/versions.ts`, and changing it is tool work,
not run work: record it and route around it.

### Step 3 · types (manifest step `generate:types`) — triage: a schema the studio can't load, or the wrong `projectId`

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate types [--force]
```

Runs `pnpm --filter studio run typegen` (5 min timeout) — `sanity schema
extract --workspace default` followed by `sanity typegen generate`, which
extracts the studio's schema and generates `web`'s GROQ types
(`web/sanity.types.ts`). Blocking. This gate can legitimately hang past its
timeout on a cold extract, so a timeout with `web/sanity.types.ts` present on
disk is treated as success and reported as a `note` on the printed line:

```json
{
  "step": "generate:types",
  "status": "done",
  "note": "pnpm --filter studio run typegen timed out but web/sanity.types.ts exists — treated as success"
}
```

**On failure** it is usually a schema file the studio cannot load: check the
emitted `studio/schema.json` (written by the `schema:extract` half of the
command, gitignored, safe to inspect) for a document/object type with a
syntax or import error. A `CorsOriginError` instead means the extract could
not resolve the workspace's project at all — the `projectId` baked into
`studio/sanity.config.ts` does not exist. No Sanity login is needed for
anything else this gate does.

### Step 4 · format (manifest step `generate:format`) — triage: a genuine parse error, never a style finding

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate format [--force]
```

Runs `pnpm run format` (5 min timeout) — `prettier --write .` from the
deliverable root. Blocking. `prettier --write` exits 0 even after rewriting
files, so the only way this gate fails is a genuine parse error, and
re-running will not fix it. Find the file it could not parse and fix that
file's syntax — prettier never blocks on style, only on a file it cannot read.

### Step 5 · seed (manifest step `generate:seed`) — triage: an IR problem naming the document/field, or a missing/wrong write token

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate seed [--force]
```

Runs `pnpm --filter studio run seed` (30 min timeout) — `tsx
scripts/seed.ts` (run from `studio/`), which uploads referenced assets, then
collection items, then chrome globals (`header`/`footer`), then pages built
from `.migration/artifacts/generate/page-tree.json` and the per-route layout
NDJSON, committing documents to the target dataset in batches. Blocking.

**On failure** the seed script names the document or field it failed on. That
is an IR problem, not a seed problem: fix the offending extraction unit
upstream, then `--scaffold --force` and `--gate seed --force`. A connection
failure instead — the process throwing immediately, or every mutation
rejected — means `SANITY_API_WRITE_TOKEN` is missing/wrong or the dataset
named in `run-config.json`'s `target` does not exist or is not writable by
that token; the `--preflight` command above checks exactly this.

### Step 6 · typecheck (manifest step `generate:typecheck`) — triage: fix the emitter, not the generated file

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate typecheck [--force]
```

Runs `pnpm run turbo run check-types` (10 min timeout) — `tsc --noEmit` in
both `studio/` and `web/`. Blocking. This is a codegen correctness gate
against the installed `sanity`/`next` packages and the GROQ types the `types`
gate just wrote — the one check that compiles what was emitted rather than a
stand-in. **On failure** read the error and fix the cause upstream (the IR, or
a re-run synth unit) — never the generated file, since the next scaffold
overwrites it.

### Step 7 · build (manifest step `generate:build`) — triage: same as `typecheck`

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate build [--force]
```

Runs `pnpm run turbo run build` (15 min timeout) — `sanity build` in `studio/`
and `next build` in `web/`. Blocking. Same rule as `typecheck`: fix the
emitter or the template, re-run scaffold, never patch the build output.

Before invoking `turbo`, and only when `generate:seed` is already `done`, this
gate checks the dataset the same way the emitted `web` app itself will:
`SANITY_API_READ_TOKEN` if it is set, an anonymous request otherwise. If that
access sees zero `page` documents despite seeding having succeeded, the gate
fails immediately naming the problem — `next build`'s own exit code cannot
catch this, since `generateStaticParams` returning an empty list is not an
error, it is a deliverable that builds clean and then 404s on every route.
Fix the same way `seed`'s connection-failure case is triaged: set
`SANITY_API_READ_TOKEN` (Viewer permission is enough), or confirm the target
dataset actually permits anonymous reads, then re-run `--gate build --force`.

### Step 8 · lint (manifest step `generate:lint`) — triage: not blocking; only eslint's exit code is read

```
pnpm tsx src/scripts/generate/index.ts --project <projectPath> --gate lint [--force]
```

Runs `pnpm run turbo run lint` (5 min timeout) — `eslint .` in `web/`. **Not
blocking** — its findings are style, not a broken deliverable, so eslint's
own exit code decides nothing beyond this gate: warnings exit 0 and pass, and
even an error-severity finding does not fail the step, only its output is
recorded. The tail is written to `.migration/artifacts/generate/lint.txt` and
the printed line points at it:

```json
{ "step": "generate:lint", "status": "done", "findings": ".migration/artifacts/generate/lint.txt" }
```

Report the findings to the user and close the phase.

## Verify

Read `<projectPath>/.migration/manifest.json`: all eight of
`generate:scaffold`, `generate:install`, `generate:types`, `generate:format`,
`generate:seed`, `generate:typecheck`, `generate:build` and `generate:lint` are
`"done"`.

Then, on disk under `<projectPath>`:

| path                                                | holds                                                  |
| ---------------------------------------------------- | ------------------------------------------------------- |
| `.migration/artifacts/generate-files.json`          | `files`, `removed`, `warnings` of the last scaffold      |
| `.migration/artifacts/generate/page-tree.json`      | the nested page tree the seed wrote pages from           |
| `.migration/artifacts/generate/lint.txt`            | the lint findings, when the lint gate had any            |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json` | the workspace shell                                      |
| `studio/sanity.config.ts`, `studio/schema.json`     | the studio's config and its extracted schema             |
| `web/sanity.types.ts`                                | written by the `types` gate                              |
| `studio/.env`, `web/.env.local`                     | the run's `projectId`/`dataset`, written once            |

Two things this phase does not do, and the user should hear both: the seed
script reads `.migration/**` at runtime, so it is an operator step — a cloned
deliverable without `.migration/` cannot re-seed; and hosting, Sanity project
provisioning and studio deployment (`sanity deploy`) are out of scope.
