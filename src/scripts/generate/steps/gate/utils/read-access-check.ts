import { readManifest } from "#lib/manifest/index.ts";
import { loadRunConfig } from "#run-config/load.ts";

import { generateGateStepId } from "../../../constants/ids.ts";
import { SANITY_API_VERSION } from "../../../constants/versions.ts";

export interface ReadAccessChecks {
  seedIsDone: (projectPath: string) => Promise<boolean>;
  countPages: (opts: { projectId: string; dataset: string; token: string | undefined }) => Promise<number>;
}

function defaultChecks(): ReadAccessChecks {
  return {
    seedIsDone: async (projectPath) => {
      const manifest = await readManifest(projectPath);
      return manifest.steps[generateGateStepId("seed")]?.status === "done";
    },
    countPages: async ({ projectId, dataset, token }) => {
      const url = `https://${projectId}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}?query=${encodeURIComponent('count(*[_type == "page"])')}`;
      const response = await fetch(url, token === undefined ? {} : { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return 0;
      const body: unknown = await response.json();
      const result = (body as { result?: unknown }).result;
      return typeof result === "number" ? result : 0;
    },
  };
}

export async function assertBuildCanReadSeededContent(opts: {
  projectPath: string;
  checks?: ReadAccessChecks;
}): Promise<void> {
  const checks = opts.checks ?? defaultChecks();

  if (!(await checks.seedIsDone(opts.projectPath))) return;

  const runConfig = await loadRunConfig(opts.projectPath);
  const token = process.env["SANITY_API_READ_TOKEN"];
  const count = await checks.countPages({
    projectId: runConfig.target.projectId,
    dataset: runConfig.target.dataset,
    token,
  });
  if (count > 0) return;

  const accessDescription =
    token === undefined ?
      "SANITY_API_READ_TOKEN is not set, so it reads anonymously"
    : "SANITY_API_READ_TOKEN is set, but that token";

  throw new Error(
    "generate:build precheck: the dataset has seeded content (generate:seed is done), but the same "
      + `access the emitted web app uses at build/runtime — ${accessDescription} — sees zero "page" documents. `
      + "next build would succeed anyway and silently pre-render an empty site (every route 404s).\n\n"
      + "Fix: export SANITY_API_READ_TOKEN (a Viewer-role token is enough) in the shell running this gate, "
      + "or confirm the target dataset actually permits anonymous reads, then re-run --gate build --force.",
  );
}
