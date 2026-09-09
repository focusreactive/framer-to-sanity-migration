import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeGate } from "#generate/steps/gate/execute-gate.ts";
import { defaultExec } from "#generate/steps/gate/utils/execute-gate.ts";

async function project(scripts: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "execute-gate-real-"));
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "execute-gate-fixture", version: "0.0.0", scripts }),
  );
  return dir;
}

describe("executeGate against a real pnpm subprocess", () => {
  it("resolves with no note or findings when the gate's script exits zero", async () => {
    const projectPath = await project({ format: 'node -e "process.exit(0)"' });

    const outcome = await executeGate({ projectPath, gate: "format" });

    expect(outcome).toEqual({});
  }, 30_000);

  it("throws quoting the command and its output when a blocking gate's script exits nonzero", async () => {
    const projectPath = await project({ format: 'node -e "console.log(\'boom\'); process.exit(1)"' });

    await expect(executeGate({ projectPath, gate: "format" })).rejects.toThrow(/gate format.*exited 1/s);
    await expect(executeGate({ projectPath, gate: "format" })).rejects.toThrow(/boom/);
  }, 30_000);

  it("records a non-blocking lint gate's failing output as findings instead of throwing", async () => {
    const projectPath = await project({ turbo: 'node -e "console.log(\'3 problems\'); process.exit(1)"' });

    const outcome = await executeGate({ projectPath, gate: "lint" });

    expect(outcome.findings).toContain("3 problems");
  }, 30_000);
});

describe("defaultExec against a real pnpm subprocess", () => {
  it("reports a real, non-null exit code on success", async () => {
    const projectPath = await project({ ok: 'node -e "process.exit(0)"' });

    const result = await defaultExec(["run", "ok"], { cwd: projectPath, env: process.env, timeoutMs: 30_000 });

    expect(result.timedOut ?? false).toBe(false);
    expect(result.code).toBe(0);
  }, 30_000);

  it("reports the real nonzero exit code on failure", async () => {
    const projectPath = await project({ fail: 'node -e "process.exit(3)"' });

    const result = await defaultExec(["run", "fail"], { cwd: projectPath, env: process.env, timeoutMs: 30_000 });

    expect(result.code).toBe(3);
  }, 30_000);

  it("marks the run as timed out once it outlives a short custom timeout", async () => {
    const projectPath = await project({ hang: 'node -e "setTimeout(() => {}, 200)"' });

    const result = await defaultExec(["run", "hang"], { cwd: projectPath, env: process.env, timeoutMs: 50 });

    expect(result.timedOut).toBe(true);
  }, 30_000);
});
