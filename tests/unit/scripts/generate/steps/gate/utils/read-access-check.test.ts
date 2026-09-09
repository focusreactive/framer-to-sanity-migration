import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertBuildCanReadSeededContent } from "#generate/steps/gate/utils/read-access-check.ts";

async function projectWithRunConfig(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "read-access-check-"));
  await mkdir(join(dir, ".migration"), { recursive: true });
  await writeFile(
    join(dir, ".migration", "run-config.json"),
    JSON.stringify({
      sourceUrl: "https://site.example",
      projectName: "site",
      workspacePath: "..",
      target: { projectId: "abc123", dataset: "production" },
    }),
  );
  return dir;
}

describe("assertBuildCanReadSeededContent", () => {
  it("does nothing when seed has not run yet — there is nothing seeded to check", async () => {
    const projectPath = await projectWithRunConfig();
    const countPages = vi.fn();

    await assertBuildCanReadSeededContent({
      projectPath,
      checks: { seedIsDone: () => Promise.resolve(false), countPages },
    });

    expect(countPages).not.toHaveBeenCalled();
  });

  it("passes silently once the same access the web app uses sees at least one page", async () => {
    const projectPath = await projectWithRunConfig();

    await expect(
      assertBuildCanReadSeededContent({
        projectPath,
        checks: { seedIsDone: () => Promise.resolve(true), countPages: () => Promise.resolve(6) },
      }),
    ).resolves.toBeUndefined();
  });

  it("throws naming the missing token when seed is done but that access sees zero pages", async () => {
    const projectPath = await projectWithRunConfig();
    delete process.env["SANITY_API_READ_TOKEN"];

    await expect(
      assertBuildCanReadSeededContent({
        projectPath,
        checks: { seedIsDone: () => Promise.resolve(true), countPages: () => Promise.resolve(0) },
      }),
    ).rejects.toThrow(/SANITY_API_READ_TOKEN is not set/);
  });

  it("throws naming the token itself when SANITY_API_READ_TOKEN is set but still sees zero pages", async () => {
    const projectPath = await projectWithRunConfig();
    process.env["SANITY_API_READ_TOKEN"] = "token-with-no-read-access";

    try {
      await expect(
        assertBuildCanReadSeededContent({
          projectPath,
          checks: { seedIsDone: () => Promise.resolve(true), countPages: () => Promise.resolve(0) },
        }),
      ).rejects.toThrow(/SANITY_API_READ_TOKEN is set, but that token/);
    } finally {
      delete process.env["SANITY_API_READ_TOKEN"];
    }
  });

  it("passes the run-config's own projectId, dataset and the live token to countPages", async () => {
    const projectPath = await projectWithRunConfig();
    process.env["SANITY_API_READ_TOKEN"] = "a-real-token";
    const countPages = vi.fn().mockResolvedValue(1);

    try {
      await assertBuildCanReadSeededContent({
        projectPath,
        checks: { seedIsDone: () => Promise.resolve(true), countPages },
      });
    } finally {
      delete process.env["SANITY_API_READ_TOKEN"];
    }

    expect(countPages).toHaveBeenCalledWith({ projectId: "abc123", dataset: "production", token: "a-real-token" });
  });
});
