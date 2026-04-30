import { join, dirname } from "path"
import { mkdir, readFile, writeFile, appendFile, rename } from "fs/promises"
import { existsSync } from "fs"
import { createHash } from "crypto"
import { homedir } from "os"

export const STORAGE_ROOT = join(
  process.env.HOME || process.env.USERPROFILE || homedir(),
  ".local",
  "share",
  "opencode",
  "pipeline",
)

export const STATE_KEYS = [
  "STATE.md",
  "PRD.md",
  "LLD.md",
  "DECISION_REGISTER.md",
  "TECH_STACK_BASELINE.md",
  "RESEARCH_NOTES.md",
  "HISTORY.md",
  "HLD.md",
  "AUDIT_REPORT.md",
  "LINT_REPORT.md",
  "PLAN_CHECK.md",
  "CODE_SUMMARY.md",
] as const

export type StateKey = (typeof STATE_KEYS)[number]

const WORKSPACES_FILE = join(STORAGE_ROOT, "workspaces.json")

export interface WorkspaceEntry {
  path: string
  lastAccess: string
  branches: string[]
  sessions: number
}

export interface Workspaces {
  [workspaceId: string]: WorkspaceEntry
}

function hashWorkspace(absPath: string): string {
  return createHash("sha256").update(absPath).digest("hex").slice(0, 16)
}

function workspaceDir(workspaceId: string): string {
  return join(STORAGE_ROOT, workspaceId)
}

async function loadWorkspaces(): Promise<Workspaces> {
  try {
    const raw = await readFile(WORKSPACES_FILE, "utf-8")
    return JSON.parse(raw) as Workspaces
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return {}
    console.error("[pipeline] Failed to parse workspaces.json — data may be corrupted:", err)
    return {}
  }
}

async function saveWorkspaces(workspaces: Workspaces): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true })
  const tmp = WORKSPACES_FILE + ".tmp"
  await writeFile(tmp, JSON.stringify(workspaces, null, 2))
  await rename(tmp, WORKSPACES_FILE)
}

export async function registerWorkspace(absPath: string): Promise<string> {
  const id = hashWorkspace(absPath)
  const workspaces = await loadWorkspaces()

  workspaces[id] = {
    path: absPath,
    lastAccess: new Date().toISOString(),
    branches: workspaces[id]?.branches ?? [],
    sessions: (workspaces[id]?.sessions ?? 0) + 1,
  }

  await saveWorkspaces(workspaces)
  await mkdir(workspaceDir(id), { recursive: true })
  return id
}

export function getWorkspaceId(absPath: string): string {
  return hashWorkspace(absPath)
}

export async function storeState(
  workspaceId: string,
  key: StateKey,
  content: string,
  mode: "write" | "append" = "write",
): Promise<void> {
  const dir = workspaceDir(workspaceId)
  await mkdir(dir, { recursive: true })
  const filePath = join(dir, key)
  await mkdir(dirname(filePath), { recursive: true })

  if (mode === "append") {
    await appendFile(filePath, content + "\n")
  } else {
    await writeFile(filePath, content + "\n")
  }
}

export async function loadState(
  workspaceId: string,
  key: StateKey,
  maxLines?: number,
): Promise<string | null> {
  const filePath = join(workspaceDir(workspaceId), key)
  try {
    let content = await readFile(filePath, "utf-8")
    if (maxLines && maxLines > 0) {
      const lines = content.split("\n")
      if (lines.length > maxLines) {
        content = lines.slice(-maxLines).join("\n")
      }
    }
    return content
  } catch {
    return null
  }
}

export async function getLastSessionEntry(workspaceId: string): Promise<string | null> {
  const history = await loadState(workspaceId, "HISTORY.md")
  if (!history) return null

  const entries = history.split("\n## Session:")
  if (entries.length < 2) return null
  const last = "## Session:" + entries[entries.length - 1]
  return last.trim()
}

export async function appendHistory(workspaceId: string, entry: string): Promise<void> {
  const timestamp = new Date().toISOString().slice(0, 10)
  const header = `\n## Session: ${timestamp} | ${entry}`
  await storeState(workspaceId, "HISTORY.md", header, "append")
}

export async function pruneHistory(workspaceId: string, maxEntries: number): Promise<void> {
  if (maxEntries <= 0) return
  const history = await loadState(workspaceId, "HISTORY.md")
  if (!history) return
  const entries = history.split("\n## Session:")
  if (entries.length <= maxEntries + 1) return
  const kept = entries.slice(-maxEntries)
  const pruned = (entries.length > 1 ? "## Session:" : "") + kept.join("\n## Session:")
  await storeState(workspaceId, "HISTORY.md", pruned)
}

export async function getStatePreview(workspaceId: string): Promise<{
  state: string | null
  lastSession: string | null
  hasPrd: boolean
  hasLld: boolean
  hasDecisionRegister: boolean
  hasHld: boolean
  hasAuditReport: boolean
  hasLintReport: boolean
  hasPlanCheck: boolean
  hasCodeSummary: boolean
  hasResearchNotes: boolean
}> {
  const state = await loadState(workspaceId, "STATE.md")
  const lastSession = await getLastSessionEntry(workspaceId)
  const hasPrd = existsSync(join(workspaceDir(workspaceId), "PRD.md"))
  const hasLld = existsSync(join(workspaceDir(workspaceId), "LLD.md"))
  const hasDecisionRegister = existsSync(join(workspaceDir(workspaceId), "DECISION_REGISTER.md"))
  const hasHld = existsSync(join(workspaceDir(workspaceId), "HLD.md"))
  const hasAuditReport = existsSync(join(workspaceDir(workspaceId), "AUDIT_REPORT.md"))
  const hasLintReport = existsSync(join(workspaceDir(workspaceId), "LINT_REPORT.md"))
  const hasPlanCheck = existsSync(join(workspaceDir(workspaceId), "PLAN_CHECK.md"))
  const hasCodeSummary = existsSync(join(workspaceDir(workspaceId), "CODE_SUMMARY.md"))
  const hasResearchNotes = existsSync(join(workspaceDir(workspaceId), "RESEARCH_NOTES.md"))

  return { state, lastSession, hasPrd, hasLld, hasDecisionRegister, hasHld, hasAuditReport, hasLintReport, hasPlanCheck, hasCodeSummary, hasResearchNotes }
}
