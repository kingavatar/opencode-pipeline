import { readFile } from "fs/promises"
import { join } from "path"
import type { PipelineConfig } from "./types"
import { DEFAULT_CONFIG } from "./types"

export async function loadConfig(directory: string): Promise<PipelineConfig> {
  let config: PipelineConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG))

  const paths = [
    join(directory, ".opencode", "pipeline-config.jsonc"),
    join(directory, ".opencode", "pipeline-config.json"),
  ]

  const home = process.env.HOME || process.env.USERPROFILE || "~"
  const globalPaths = [
    join(home, ".config", "opencode", "pipeline-config.jsonc"),
    join(home, ".config", "opencode", "pipeline-config.json"),
  ]

  // Global first, then per-project overrides it
  for (const p of [...globalPaths, ...paths]) {
    try {
      const raw = await readFile(p, "utf-8")
      const parsed = JSON.parse(raw) as Partial<PipelineConfig>
      config = mergeConfig(config, parsed)
    } catch {
      // File doesn't exist or invalid — skip
    }
  }

  return config
}

function mergeConfig(base: PipelineConfig, overrides: Partial<PipelineConfig>): PipelineConfig {
  return {
    storage: { ...base.storage, ...overrides.storage },
    models: { ...base.models, ...overrides.models },
    workflow: { ...base.workflow, ...overrides.workflow },
    git: { ...base.git, ...overrides.git },
  }
}
