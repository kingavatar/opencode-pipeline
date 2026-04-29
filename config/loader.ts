import { readFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import type { PipelineConfig } from "./types"
import { DEFAULT_CONFIG } from "./types"

function stripJsonComments(raw: string): string {
  return raw
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([}\]])/g, "$1")
}

export async function loadConfig(directory: string): Promise<PipelineConfig> {
  let config: PipelineConfig = {
    storage: { ...DEFAULT_CONFIG.storage },
    models: { ...DEFAULT_CONFIG.models },
    workflow: { ...DEFAULT_CONFIG.workflow },
    git: { ...DEFAULT_CONFIG.git },
  }

  const paths = [
    join(directory, ".opencode", "pipeline-config.jsonc"),
    join(directory, ".opencode", "pipeline-config.json"),
  ]

  const home = process.env.HOME || process.env.USERPROFILE || homedir()
  const globalPaths = [
    join(home, ".config", "opencode", "pipeline-config.jsonc"),
    join(home, ".config", "opencode", "pipeline-config.json"),
  ]

  for (const p of [...globalPaths, ...paths]) {
    try {
      const raw = await readFile(p, "utf-8")
      const cleaned = stripJsonComments(raw)
      const parsed = JSON.parse(cleaned) as Partial<PipelineConfig>
      config = mergeConfig(config, parsed)
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.warn(`[pipeline] Could not load config from ${p}:`, (err as Error).message)
      }
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
