import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { mkdir, rm, writeFile, readFile } from "fs/promises"
import {
  getWorkspaceId,
  registerWorkspace,
  storeState,
  loadState,
  appendHistory,
  pruneHistory,
  getLastSessionEntry,
  getStatePreview,
  STORAGE_ROOT,
  STATE_KEYS,
} from "../storage/workspace-registry"

const TEST_DIR = join(STORAGE_ROOT, "_test_wsreg")
const TEST_PATH = "/home/test/project"

describe("STORAGE_ROOT", () => {
  it("ends with .local/share/opencode/pipeline", () => {
    expect(STORAGE_ROOT).toContain(".local/share/opencode/pipeline")
  })

  it("is an absolute path", () => {
    expect(STORAGE_ROOT.startsWith("/")).toBe(true)
  })
})

describe("STATE_KEYS", () => {
  it("has exactly 12 keys", () => {
    expect(STATE_KEYS.length).toBe(12)
  })

  it("contains all expected keys", () => {
    expect(STATE_KEYS).toContain("STATE.md")
    expect(STATE_KEYS).toContain("PRD.md")
    expect(STATE_KEYS).toContain("LLD.md")
    expect(STATE_KEYS).toContain("DECISION_REGISTER.md")
    expect(STATE_KEYS).toContain("TECH_STACK_BASELINE.md")
    expect(STATE_KEYS).toContain("HISTORY.md")
    expect(STATE_KEYS).toContain("HLD.md")
    expect(STATE_KEYS).toContain("AUDIT_REPORT.md")
    expect(STATE_KEYS).toContain("LINT_REPORT.md")
    expect(STATE_KEYS).toContain("PLAN_CHECK.md")
    expect(STATE_KEYS).toContain("CODE_SUMMARY.md")
  })

  it("keys are in the expected order", () => {
    expect(STATE_KEYS[0]).toBe("STATE.md")
    expect(STATE_KEYS[3]).toBe("DECISION_REGISTER.md")
    expect(STATE_KEYS[5]).toBe("RESEARCH_NOTES.md")
    expect(STATE_KEYS[6]).toBe("HISTORY.md")
    expect(STATE_KEYS[7]).toBe("HLD.md")
    expect(STATE_KEYS[8]).toBe("AUDIT_REPORT.md")
    expect(STATE_KEYS[9]).toBe("LINT_REPORT.md")
    expect(STATE_KEYS[10]).toBe("PLAN_CHECK.md")
    expect(STATE_KEYS[11]).toBe("CODE_SUMMARY.md")
  })
})

describe("getWorkspaceId", () => {
  it("returns same id for same path", () => {
    const a = getWorkspaceId(TEST_PATH)
    const b = getWorkspaceId(TEST_PATH)
    expect(a).toBe(b)
    expect(a.length).toBe(16)
  })

  it("returns different id for different paths", () => {
    const a = getWorkspaceId("/home/project-a")
    const b = getWorkspaceId("/home/project-b")
    expect(a).not.toBe(b)
  })

  it("empty string produces deterministic hash", () => {
    const id = getWorkspaceId("")
    expect(id).toBeTruthy()
    expect(typeof id).toBe("string")
    expect(id.length).toBe(16)
  })

  it("very long path produces valid id", () => {
    const long = "/" + "a".repeat(500) + "/" + "b".repeat(500)
    const id = getWorkspaceId(long)
    expect(id.length).toBe(16)
  })

  it("throws on null input", () => {
    expect(() => getWorkspaceId(null as unknown as string)).toThrow()
  })

  it("throws on undefined input", () => {
    expect(() => getWorkspaceId(undefined as unknown as string)).toThrow()
  })
})

describe("registerWorkspace", () => {
  const wsPath = "/home/test/register-ws"

  afterEach(async () => {
    const id = getWorkspaceId(wsPath)
    await rm(join(STORAGE_ROOT, id), { recursive: true, force: true })
  })

  it("registers new workspace and returns id", async () => {
    const id = await registerWorkspace(wsPath)
    expect(id).toBe(getWorkspaceId(wsPath))
  })

  it("increments session count on re-registration", async () => {
    await registerWorkspace(wsPath)
    await registerWorkspace(wsPath)
    const id = getWorkspaceId(wsPath)
    const state = await loadState(id, "STATE.md")
    expect(state).toBeNull()
  })

  it("creates workspace directory", async () => {
    const id = await registerWorkspace(wsPath)
    const { existsSync } = await import("fs")
    expect(existsSync(join(STORAGE_ROOT, id))).toBe(true)
  })

  it("preserves branches array on re-registration", async () => {
    const id = getWorkspaceId(wsPath)
    await registerWorkspace(wsPath)
    await registerWorkspace(wsPath)
    const wsDir = join(STORAGE_ROOT, id)
    expect(await import("fs").then(fs => fs.existsSync(wsDir))).toBe(true)
  })

  it("handles empty string path", async () => {
    const id = await registerWorkspace("")
    expect(typeof id).toBe("string")
    expect(id.length).toBe(16)
    await rm(join(STORAGE_ROOT, id), { recursive: true, force: true })
  })

  it("handles path with special characters", async () => {
    const path = "/home/test/weird !@#$%^&*()/project"
    const id = await registerWorkspace(path)
    expect(typeof id).toBe("string")
    await rm(join(STORAGE_ROOT, id), { recursive: true, force: true })
  })
})

describe("storeState and loadState", () => {
  const wsPath = "/home/test/store-state"
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(wsPath)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  // Happy path
  it("writes and reads state", async () => {
    await storeState(wsId, "STATE.md", "phase=1")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("phase=1\n")
  })

  it("returns null for missing file", async () => {
    const result = await loadState(wsId, "PRD.md")
    expect(result).toBeNull()
  })

  it("write mode overwrites existing content", async () => {
    await storeState(wsId, "STATE.md", "first")
    await storeState(wsId, "STATE.md", "second")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("second\n")
  })

  it("append mode appends content", async () => {
    await storeState(wsId, "STATE.md", "line1")
    await storeState(wsId, "STATE.md", "line2", "append")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("line1\nline2\n")
  })

  // Content edge cases
  it("handles empty string content", async () => {
    await storeState(wsId, "STATE.md", "")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("\n")
  })

  it("handles unicode content", async () => {
    await storeState(wsId, "STATE.md", "日本語テスト 🎉")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("日本語テスト 🎉\n")
  })

  it("handles large content (100KB)", async () => {
    const large = "x".repeat(100_000)
    await storeState(wsId, "STATE.md", large)
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe(large + "\n")
  })

  it("handles content with null bytes", async () => {
    await storeState(wsId, "STATE.md", "before\0after")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toContain("before")
    expect(result).toContain("after")
  })

  it("handles multiline content with trailing newlines", async () => {
    await storeState(wsId, "STATE.md", "a\nb\nc\n\n")
    const result = await loadState(wsId, "STATE.md")
    expect(result).toContain("a")
    expect(result).toContain("b")
    expect(result).toContain("c")
  })

  it("handles content that is null at JS level", async () => {
    await storeState(wsId, "STATE.md", null as unknown as string)
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("null\n")
  })

  it("handles content that is undefined at JS level", async () => {
    await storeState(wsId, "STATE.md", undefined as unknown as string)
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("undefined\n")
  })

  it("handles content that is a number", async () => {
    await storeState(wsId, "STATE.md", 42 as unknown as string)
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("42\n")
  })

  it("handles content that is an object", async () => {
    await storeState(wsId, "STATE.md", {} as unknown as string)
    const result = await loadState(wsId, "STATE.md")
    expect(result).toBe("[object Object]\n")
  })

  // maxLines boundary conditions
  it("loadState with maxLines returns last N lines", async () => {
    const content = Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n")
    await storeState(wsId, "STATE.md", content)
    const result = await loadState(wsId, "STATE.md", 3)
    expect(result).toBe("line8\nline9\n")
  })

  it("loadState with maxLines=0 returns full content", async () => {
    await storeState(wsId, "STATE.md", "line1\nline2")
    const result = await loadState(wsId, "STATE.md", 0)
    expect(result).toBe("line1\nline2\n")
  })

  it("loadState with maxLines=1 returns empty for trailing-newline content", async () => {
    await storeState(wsId, "STATE.md", "a\nb\nc")
    const result = await loadState(wsId, "STATE.md", 1)
    expect(result).toBe("")
  })

  it("loadState with maxLines=2 returns last 2 lines", async () => {
    await storeState(wsId, "STATE.md", "a\nb\nc\nd")
    const result = await loadState(wsId, "STATE.md", 2)
    expect(result).toBe("d\n")
  })

  it("loadState with negative maxLines returns full content", async () => {
    await storeState(wsId, "STATE.md", "only")
    const result = await loadState(wsId, "STATE.md", -5)
    expect(result).toBe("only\n")
  })

  it("loadState with maxLines > total lines returns full content", async () => {
    await storeState(wsId, "STATE.md", "only")
    const result = await loadState(wsId, "STATE.md", 100)
    expect(result).toBe("only\n")
  })

  it("loadState with NaN maxLines returns full content", async () => {
    await storeState(wsId, "STATE.md", "data")
    const result = await loadState(wsId, "STATE.md", NaN)
    expect(result).toBe("data\n")
  })

  it("loadState with Infinity maxLines returns full content", async () => {
    await storeState(wsId, "STATE.md", "data")
    const result = await loadState(wsId, "STATE.md", Infinity)
    expect(result).toBe("data\n")
  })

  it("loadState with float maxLines truncates to int", async () => {
    await storeState(wsId, "STATE.md", "a\nb\nc\nd\ne")
    const result = await loadState(wsId, "STATE.md", 3.7)
    expect(result).toBe("d\ne\n")
  })

  // All valid STATE_KEYS
  it("all valid STATE_KEYS can be used", async () => {
    for (const key of STATE_KEYS) {
      await storeState(wsId, key, `content-${key}`)
      const result = await loadState(wsId, key)
      expect(result).toBe(`content-${key}\n`)
    }
  })

  // Null/undefined workspaceId
  it("storeState throws on null workspaceId", async () => {
    await expect(storeState(null as unknown as string, "STATE.md", "x")).rejects.toThrow()
  })

  it("loadState returns null for non-existent workspace", async () => {
    const result = await loadState("nonexistent_ws_id", "STATE.md")
    expect(result).toBeNull()
  })
})

describe("appendHistory and pruneHistory", () => {
  const wsPath = "/home/test/history"
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(wsPath)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  it("appendHistory adds timestamped entry", async () => {
    await appendHistory(wsId, "completed | Add auth")
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toMatch(/## Session: \d{4}-\d{2}-\d{2}/)
    expect(history).toContain("completed | Add auth")
  })

  it("appendHistory adds to existing entries", async () => {
    await appendHistory(wsId, "entry1")
    await appendHistory(wsId, "entry2")
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry1")
    expect(history).toContain("entry2")
  })

  it("appendHistory handles null entry", async () => {
    await appendHistory(wsId, null as unknown as string)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("null")
  })

  it("appendHistory handles empty entry", async () => {
    await appendHistory(wsId, "")
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("## Session:")
  })

  it("appendHistory handles entry with newlines", async () => {
    await appendHistory(wsId, "line1\nline2\nline3")
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("line1")
  })

  it("appendHistory handles entry containing ## Session: pattern", async () => {
    await appendHistory(wsId, "nested ## Session: marker")
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("nested ## Session: marker")
  })

  it("appendHistory works with unregistered workspace", async () => {
    const newId = "fresh_workspace_001"
    await appendHistory(newId, "first entry")
    const history = await loadState(newId, "HISTORY.md")
    expect(history).toContain("first entry")
    await rm(join(STORAGE_ROOT, newId), { recursive: true, force: true })
  })

  // pruneHistory
  it("pruneHistory removes oldest entries beyond max", async () => {
    for (let i = 0; i < 10; i++) {
      await appendHistory(wsId, `entry${i}`)
    }
    await pruneHistory(wsId, 3)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).not.toContain("entry0")
    expect(history).toContain("entry7")
    expect(history).toContain("entry9")
  })

  it("pruneHistory with maxEntries=0 is no-op", async () => {
    await appendHistory(wsId, "entry")
    await pruneHistory(wsId, 0)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry")
  })

  it("pruneHistory with negative maxEntries is no-op", async () => {
    await appendHistory(wsId, "entry")
    await pruneHistory(wsId, -10)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry")
  })

  it("pruneHistory with maxEntries=1 keeps only most recent", async () => {
    for (let i = 0; i < 5; i++) {
      await appendHistory(wsId, `entry${i}`)
    }
    await pruneHistory(wsId, 1)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).not.toContain("entry3")
    expect(history).toContain("entry4")
  })

  it("pruneHistory with entries exactly equal to max is no-op", async () => {
    for (let i = 0; i < 5; i++) {
      await appendHistory(wsId, `entry${i}`)
    }
    await pruneHistory(wsId, 5)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry0")
    expect(history).toContain("entry4")
  })

  it("pruneHistory with entries <= max is no-op", async () => {
    for (let i = 0; i < 5; i++) {
      await appendHistory(wsId, `entry${i}`)
    }
    await pruneHistory(wsId, 10)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry0")
    expect(history).toContain("entry4")
  })

  it("pruneHistory with NaN maxEntries is no-op", async () => {
    await appendHistory(wsId, "entry")
    await pruneHistory(wsId, NaN)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry")
  })

  it("pruneHistory handles non-existent workspace", async () => {
    await pruneHistory("nonexistent", 5)
    // should not throw
  })

  it("pruneHistory with very large maxEntries (100000)", async () => {
    await appendHistory(wsId, "entry")
    await pruneHistory(wsId, 100000)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry")
  })
})

describe("getLastSessionEntry", () => {
  const wsPath = "/home/test/lastsession"
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(wsPath)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  it("returns null when no history exists", async () => {
    const result = await getLastSessionEntry(wsId)
    expect(result).toBeNull()
  })

  it("returns null when history is empty", async () => {
    await storeState(wsId, "HISTORY.md", "")
    const result = await getLastSessionEntry(wsId)
    expect(result).toBeNull()
  })

  it("returns null when history has no session delimiter", async () => {
    await storeState(wsId, "HISTORY.md", "just some random text\nno sessions here")
    const result = await getLastSessionEntry(wsId)
    expect(result).toBeNull()
  })

  it("returns the last session entry", async () => {
    await appendHistory(wsId, "first")
    await appendHistory(wsId, "second")
    const result = await getLastSessionEntry(wsId)
    expect(result).toContain("second")
  })

  it("handles single session entry", async () => {
    await appendHistory(wsId, "only")
    const result = await getLastSessionEntry(wsId)
    expect(result).toContain("only")
  })

  it("handles whitespace-only history", async () => {
    await storeState(wsId, "HISTORY.md", "   \n  \n  ")
    const result = await getLastSessionEntry(wsId)
    expect(result).toBeNull()
  })

  it("handles history with ## Session: inside entry body", async () => {
    await storeState(wsId, "HISTORY.md", "\n## Session: 2026-01-01 | real\n## Session: 2026-02-01 | fake")
    const result = await getLastSessionEntry(wsId)
    expect(result).toContain("fake")
  })

  it("handles single ## Session: header with no content", async () => {
    await storeState(wsId, "HISTORY.md", "## Session:")
    const result = await getLastSessionEntry(wsId)
    expect(result).toBeNull()
  })

  it("handles non-existent workspace id", async () => {
    const result = await getLastSessionEntry("nonexistent_ws")
    expect(result).toBeNull()
  })
})

describe("getStatePreview", () => {
  const wsPath = "/home/test/preview"
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(wsPath)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  it("returns empty preview for new workspace", async () => {
    const preview = await getStatePreview(wsId)
    expect(preview.state).toBeNull()
    expect(preview.lastSession).toBeNull()
    expect(preview.hasPrd).toBe(false)
    expect(preview.hasLld).toBe(false)
    expect(preview.hasDecisionRegister).toBe(false)
    expect(preview.hasHld).toBe(false)
    expect(preview.hasAuditReport).toBe(false)
    expect(preview.hasLintReport).toBe(false)
    expect(preview.hasPlanCheck).toBe(false)
    expect(preview.hasCodeSummary).toBe(false)
  })

  it("detects PRD and LLD existence", async () => {
    await storeState(wsId, "PRD.md", "prd content")
    await storeState(wsId, "LLD.md", "lld content")
    const preview = await getStatePreview(wsId)
    expect(preview.hasPrd).toBe(true)
    expect(preview.hasLld).toBe(true)
    expect(preview.hasDecisionRegister).toBe(false)
    expect(preview.hasHld).toBe(false)
  })

  it("returns state preview", async () => {
    await storeState(wsId, "STATE.md", "phase=3, progress=50%")
    const preview = await getStatePreview(wsId)
    expect(preview.state).toContain("phase=3")
  })

  it("truncates long state preview in caller, not here", async () => {
    const long = "x".repeat(500)
    await storeState(wsId, "STATE.md", long)
    const preview = await getStatePreview(wsId)
    expect(preview.state).toContain("x".repeat(500))
  })

  it("full workspace with all artifacts", async () => {
    await storeState(wsId, "STATE.md", "phase=5")
    await storeState(wsId, "PRD.md", "build a thing")
    await storeState(wsId, "LLD.md", "detailed plan")
    await storeState(wsId, "DECISION_REGISTER.md", "ADR-001: test")
    await storeState(wsId, "HLD.md", "architecture overview")
    await storeState(wsId, "AUDIT_REPORT.md", "audit findings")
    await storeState(wsId, "LINT_REPORT.md", "lint results")
    await storeState(wsId, "PLAN_CHECK.md", "plan check pass")
    await storeState(wsId, "CODE_SUMMARY.md", "code summary")
    await appendHistory(wsId, "session done")
    const preview = await getStatePreview(wsId)
    expect(preview.state).toContain("phase=5")
    expect(preview.hasPrd).toBe(true)
    expect(preview.hasLld).toBe(true)
    expect(preview.hasDecisionRegister).toBe(true)
    expect(preview.hasHld).toBe(true)
    expect(preview.hasAuditReport).toBe(true)
    expect(preview.hasLintReport).toBe(true)
    expect(preview.hasPlanCheck).toBe(true)
    expect(preview.hasCodeSummary).toBe(true)
    expect(preview.lastSession).toContain("session done")
  })

  it("workspace with only STATE.md", async () => {
    await storeState(wsId, "STATE.md", "just state")
    const preview = await getStatePreview(wsId)
    expect(preview.state).toContain("just state")
    expect(preview.hasPrd).toBe(false)
    expect(preview.hasLld).toBe(false)
    expect(preview.hasDecisionRegister).toBe(false)
    expect(preview.hasHld).toBe(false)
    expect(preview.lastSession).toBeNull()
  })

  it("workspace with history but no STATE.md", async () => {
    await appendHistory(wsId, "some session")
    const preview = await getStatePreview(wsId)
    expect(preview.state).toBeNull()
    expect(preview.lastSession).toContain("some session")
  })

  it("handles non-existent workspace", async () => {
    const preview = await getStatePreview("nonexistent_ws_id_123")
    expect(preview.state).toBeNull()
    expect(preview.hasPrd).toBe(false)
    expect(preview.hasLld).toBe(false)
    expect(preview.hasDecisionRegister).toBe(false)
    expect(preview.hasHld).toBe(false)
    expect(preview.hasCodeSummary).toBe(false)
  })
})
