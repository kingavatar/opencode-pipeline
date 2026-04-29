import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import { join } from "path"
import { rm, writeFile, mkdir } from "fs/promises"
import {
  pipeline_store,
  pipeline_load,
  pipeline_status,
} from "../tools/index"
import {
  getWorkspaceId,
  storeState,
  loadState,
  registerWorkspace,
  STORAGE_ROOT,
  STATE_KEYS,
} from "../storage/workspace-registry"

const TEST_WS = "/home/test/tools-test"
const MOCK_CONTEXT = {
  worktree: TEST_WS,
  directory: TEST_WS,
  sessionID: "test-session-001",
}

describe("pipeline_store", () => {
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(TEST_WS)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  it("stores state successfully", async () => {
    const result = await pipeline_store.execute!(
      { key: "STATE.md", content: "phase=2", mode: "write" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("Stored STATE.md")
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("phase=2")
  })

  it("rejects invalid key", async () => {
    const result = await pipeline_store.execute!(
      { key: "../../etc/passwd", content: "evil", mode: "write" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("Invalid key")
    expect(result).toContain("STATE.md")
  })

  it("rejects empty key", async () => {
    const result = await pipeline_store.execute!(
      { key: "", content: "x", mode: "write" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("Invalid key")
  })

  it("rejects random string key not in STATE_KEYS", async () => {
    const result = await pipeline_store.execute!(
      { key: "rando.md", content: "x", mode: "write" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("Invalid key")
  })

  it("accepts all valid STATE_KEYS", async () => {
    for (const key of STATE_KEYS) {
      const result = await pipeline_store.execute!(
        { key, content: `data-${key}`, mode: "write" },
        MOCK_CONTEXT,
      )
      expect(result).toContain(`Stored ${key}`)
    }
  })

  it("append mode appends to existing content", async () => {
    await storeState(wsId, "STATE.md", "first")
    await pipeline_store.execute!(
      { key: "STATE.md", content: "second", mode: "append" },
      MOCK_CONTEXT,
    )
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("first")
    expect(loaded).toContain("second")
  })

  it("write mode overwrites existing content", async () => {
    await storeState(wsId, "STATE.md", "old")
    await pipeline_store.execute!(
      { key: "STATE.md", content: "new", mode: "write" },
      MOCK_CONTEXT,
    )
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("new")
    expect(loaded).not.toContain("old")
  })

  it("default mode is write", async () => {
    await storeState(wsId, "STATE.md", "old")
    await pipeline_store.execute!(
      { key: "STATE.md", content: "fresh" },
      MOCK_CONTEXT,
    )
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("fresh")
    expect(loaded).not.toContain("old")
  })

  it("handles empty string content", async () => {
    const result = await pipeline_store.execute!(
      { key: "STATE.md", content: "" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("Stored")
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toBe("\n")
  })

  it("returns error when no workspace context", async () => {
    const result = await pipeline_store.execute!(
      { key: "STATE.md", content: "x" },
      { worktree: "" as any, directory: "" as any },
    )
    expect(result).toContain("no workspace context")
  })

  it("returns error when context properties are undefined", async () => {
    const result = await pipeline_store.execute!(
      { key: "STATE.md", content: "x" },
      {} as any,
    )
    expect(result).toContain("no workspace context")
  })
})

describe("pipeline_load", () => {
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(TEST_WS)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  it("loads stored state", async () => {
    await storeState(wsId, "STATE.md", "content-here")
    const result = await pipeline_load.execute!(
      { key: "STATE.md" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("content-here")
  })

  it("returns not-found message for missing file", async () => {
    const result = await pipeline_load.execute!(
      { key: "STATE.md" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("No saved state")
  })

  it("rejects invalid key", async () => {
    const result = await pipeline_load.execute!(
      { key: "hacked.md" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("Invalid key")
  })

  it("respects lines truncation", async () => {
    const content = Array.from({ length: 20 }, (_, i) => `line${i}`).join("\n")
    await storeState(wsId, "STATE.md", content)
    const result = await pipeline_load.execute!(
      { key: "STATE.md", lines: 3 },
      MOCK_CONTEXT,
    )
    expect(result).toContain("line18")
    expect(result).toContain("line19")
    expect(result).not.toContain("line17")
    expect(result).not.toContain("line0")
  })

  it("handles undefined lines parameter", async () => {
    const content = "full content"
    await storeState(wsId, "STATE.md", content)
    const result = await pipeline_load.execute!(
      { key: "STATE.md" },
      MOCK_CONTEXT,
    )
    expect(result).toContain("full content")
  })

  it("returns error when no workspace context", async () => {
    const result = await pipeline_load.execute!(
      { key: "STATE.md" },
      {} as any,
    )
    expect(result).toContain("no workspace context")
  })
})

describe("pipeline_status", () => {
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(TEST_WS)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  it("returns status for empty workspace", async () => {
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    expect(result).toContain("Workspace:")
    expect(result).toContain("Has PRD: false")
    expect(result).toContain("Has LLD: false")
  })

  it("detects PRD", async () => {
    await storeState(wsId, "PRD.md", "test")
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    expect(result).toContain("Has PRD: true")
  })

  it("detects LLD", async () => {
    await storeState(wsId, "LLD.md", "test")
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    expect(result).toContain("Has LLD: true")
  })

  it("shows state preview when STATE.md exists", async () => {
    await storeState(wsId, "STATE.md", "phase=4,progress=80%")
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    expect(result).toContain("State preview:")
  })

  it("shows last session when history exists", async () => {
    const { appendHistory } = await import("../storage/workspace-registry")
    await appendHistory(wsId, "completed | test feature")
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    expect(result).toContain("Last session:")
  })

  it("returns error when no workspace context", async () => {
    const result = await pipeline_status.execute!({}, {} as any)
    expect(result).toContain("no workspace context")
  })
})
