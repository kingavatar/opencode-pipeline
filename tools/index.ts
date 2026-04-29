import { tool } from "@opencode-ai/plugin"
import {
  getWorkspaceId,
  storeState,
  loadState,
  registerWorkspace,
  STATE_KEYS,
  getStatePreview,
} from "../storage"

function validateKey(key: unknown): { ok: true; key: (typeof STATE_KEYS)[number] } | { ok: false; error: string } {
  const k = key as string
  if (!(STATE_KEYS as readonly string[]).includes(k)) {
    return { ok: false, error: `Invalid key '${k}'. Valid keys: ${STATE_KEYS.join(", ")}` }
  }
  return { ok: true, key: k as (typeof STATE_KEYS)[number] }
}

function getCwd(context: { worktree?: string; directory?: string }): string | null {
  const cwd = context.worktree || context.directory
  if (!cwd) return null
  return cwd
}

const _pipeline_store = tool({
  description:
    "Persist pipeline state to centralized storage at ~/.local/share/opencode/pipeline/<workspace-id>/",
  args: {
    key: tool.schema.string().describe("State file key (STATE.md, PRD.md, LLD.md, TECH_STACK_BASELINE.md, HISTORY.md)"),
    content: tool.schema.string().describe("Content to write"),
    mode: tool.schema.string().default("write").describe("Write mode: write or append"),
  },
  async execute(args, context) {
    const cwd = getCwd(context)
    if (!cwd) return "Error: no workspace context available"
    const workspaceId = getWorkspaceId(cwd)
    await registerWorkspace(cwd)
    const validated = validateKey(args.key)
    if (!validated.ok) return validated.error
    const mode = (args.mode ?? "write") as "write" | "append"
    await storeState(workspaceId, validated.key, String(args.content), mode)
    return `Stored ${validated.key} for workspace ${workspaceId}`
  },
})

const _pipeline_load = tool({
  description: "Load pipeline state from centralized storage",
  args: {
    key: tool.schema.string().describe("State file to load"),
    lines: tool.schema.number().optional().describe("Max lines to return"),
  },
  async execute(args, context) {
    const cwd = getCwd(context)
    if (!cwd) return "Error: no workspace context available"
    const workspaceId = getWorkspaceId(cwd)
    await registerWorkspace(cwd)
    const validated = validateKey(args.key)
    if (!validated.ok) return validated.error
    const content = await loadState(workspaceId, validated.key, Number(args.lines ?? 0))
    if (content === null) {
      return `No saved state for ${validated.key} in workspace ${workspaceId}`
    }
    return content
  },
})

const _pipeline_status = tool({
  description: "Get current pipeline status for this workspace",
  args: {},
  async execute(_args, context) {
    const cwd = getCwd(context)
    if (!cwd) return "Error: no workspace context available"
    const workspaceId = getWorkspaceId(cwd)
    await registerWorkspace(cwd)
    const preview = await getStatePreview(workspaceId)
    const lines: string[] = []
    lines.push(`Workspace: ${workspaceId}`)
    lines.push(`Has PRD: ${preview.hasPrd}`)
    lines.push(`Has LLD: ${preview.hasLld}`)
    if (preview.state) {
      lines.push(`State preview: ${preview.state.slice(0, 300)}`)
    }
    if (preview.lastSession) {
      lines.push(`Last session: ${preview.lastSession}`)
    }
    return lines.join("\n")
  },
})

export const pipeline_store = _pipeline_store
export const pipeline_load = _pipeline_load
export const pipeline_status = _pipeline_status
