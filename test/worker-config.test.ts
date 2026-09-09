import { describe, expect, it } from "vitest"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// Guards the one-repo-many-workers layout: every dashboard Worker
// (muse-worker1..10) must resolve to a config whose `name` matches it
// exactly, otherwise Workers Builds warns + opens a fix PR.
// Worker 1 uses the default wrangler.jsonc; workers 2..10 use
// wrangler.workerN.jsonc via `npx wrangler deploy --config <file>`.
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const EXPECTED = Array.from({ length: 10 }, (_, i) => `muse-worker${i + 1}`)

function configFor(workerName: string): Record<string, unknown> {
  const file = workerName === "muse-worker1" ? "wrangler.jsonc" : `wrangler.${workerName.replace("muse-", "")}.jsonc`
  const raw = readFileSync(join(ROOT, file), "utf8")
  return JSON.parse(raw) as Record<string, unknown>
}

describe("per-worker wrangler configs", () => {
  it("covers muse-worker1..10 with no gaps or extras", () => {
    const files = new Set(readdirSync(ROOT))
    expect(files.has("wrangler.jsonc")).toBe(true)
    for (let n = 2; n <= 10; n++) {
      expect(files.has(`wrangler.worker${n}.jsonc`)).toBe(true)
    }
  })

  it("each config names its own worker, points at src/index.ts, requires PROXY_API_KEY", () => {
    const names = new Set<string>()
    for (const workerName of EXPECTED) {
      const cfg = configFor(workerName)
      expect(cfg.name).toBe(workerName)
      names.add(cfg.name as string)
      expect(cfg.main).toBe("src/index.ts")
      expect(existsSync(join(ROOT, cfg.main as string))).toBe(true)
      const secrets = cfg.secrets as { required?: string[] }
      expect(secrets.required).toContain("PROXY_API_KEY")
    }
    expect(names.size).toBe(10)
  })
})
