import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { NEVER_REMOVED } from "#generate/constants/dirs.ts";
import { writeSanityEnv } from "#generate/steps/scaffold/app-env.ts";

async function projectDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "sanity-env-"));
}

describe("writeSanityEnv", () => {
  it("never lists an env file for removal on a rebase", () => {
    for (const file of NEVER_REMOVED) expect(["studio/.env", "web/.env.local"]).toContain(file);
  });

  it("writes the project id, dataset and api version into the studio env", async () => {
    const dir = await projectDir();
    await writeSanityEnv({
      projectPath: dir,
      target: { projectId: "abc123", dataset: "production", apiVersion: "2026-09-01" },
    });
    const env = await readFile(join(dir, "studio/.env"), "utf8");
    expect(env).toContain("abc123");
    expect(env).toContain("production");
  });
});
