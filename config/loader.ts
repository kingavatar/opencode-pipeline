import { readFile } from "fs/promises"
import { join } from "path"
import { homedir } from "os"
import type { PipelineConfig } from "./types"
import { DEFAULT_CONFIG } from "./types"

function stripJsonComments(raw: string): string {
  const lines = raw.split("\n")
  const out: string[] = []
  let inBlockComment = false

  for (const line of lines) {
    if (inBlockComment) {
      const end = line.indexOf("*/")
      if (end === -1) continue
      inBlockComment = false
      out.push(" ".repeat(end + 2) + line.slice(end + 2))
      continue
    }

    let result = ""
    let inString = false
    let stringChar = ""

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]

      if (!inString) {
        if (ch === "/" && line[i + 1] === "/") break
        if (ch === "/" && line[i + 1] === "*") {
          inBlockComment = true
          const rest = line.slice(i + 2)
          const end = rest.indexOf("*/")
          if (end !== -1) {
            i = i + 2 + end + 1
            inBlockComment = false
            result += " ".repeat(end + 4)
            continue
          }
          break
        }
        if (ch === '"' || ch === "'") {
          inString = true
          stringChar = ch
        }
        result += ch
      } else {
        result += ch
        if (ch === "\\") {
          i++
          if (i < line.length) result += line[i]
          continue
        }
        if (ch === stringChar) {
          inString = false
        }
      }
    }

    out.push(result)
  }

  return out.join("\n").replace(/,\s*([}\]])/g, "$1")
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
