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

  it("loadState with maxLines > total lines returns full content", async () => {
    await storeState(wsId, "STATE.md", "only")
    const result = await loadState(wsId, "STATE.md", 100)
    expect(result).toBe("only\n")
  })

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

  it("all valid STATE_KEYS can be used", async () => {
    for (const key of STATE_KEYS) {
      await storeState(wsId, key, `content-${key}`)
      const result = await loadState(wsId, key)
      expect(result).toBe(`content-${key}\n`)
    }
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

  it("pruneHistory with entries <= max is no-op", async () => {
    for (let i = 0; i < 5; i++) {
      await appendHistory(wsId, `entry${i}`)
    }
    await pruneHistory(wsId, 10)
    const history = await loadState(wsId, "HISTORY.md")
    expect(history).toContain("entry0")
    expect(history).toContain("entry4")
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
  })

  it("detects PRD and LLD existence", async () => {
    await storeState(wsId, "PRD.md", "prd content")
    await storeState(wsId, "LLD.md", "lld content")
    const preview = await getStatePreview(wsId)
    expect(preview.hasPrd).toBe(true)
    expect(preview.hasLld).toBe(true)
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
})
