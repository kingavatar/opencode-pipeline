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
  appendHistory,
} from "../storage/workspace-registry"

const TEST_WS = "/home/test/tools-test"
const MOCK_CONTEXT = { worktree: TEST_WS, directory: TEST_WS, sessionID: "test-session-001" }

describe("pipeline_store", () => {
  let wsId: string

  beforeEach(async () => {
    wsId = await registerWorkspace(TEST_WS)
  })

  afterEach(async () => {
    await rm(join(STORAGE_ROOT, wsId), { recursive: true, force: true })
  })

  // Happy path
  it("stores state successfully", async () => {
    const result = await pipeline_store.execute!({ key: "STATE.md", content: "phase=2", mode: "write" }, MOCK_CONTEXT)
    expect(result).toContain("Stored STATE.md")
    expect(await loadState(wsId, "STATE.md")).toContain("phase=2")
  })

  // Invalid keys
  it("rejects path traversal key", async () => {
    const result = await pipeline_store.execute!({ key: "../../etc/passwd", content: "evil", mode: "write" }, MOCK_CONTEXT)
    expect(result).toContain("Invalid key")
    expect(result).toContain("STATE.md")
  })

  it("rejects empty key", async () => {
    const result = await pipeline_store.execute!({ key: "", content: "x", mode: "write" }, MOCK_CONTEXT)
    expect(result).toContain("Invalid key")
  })

  it("rejects random key not in STATE_KEYS", async () => {
    const result = await pipeline_store.execute!({ key: "rando.md", content: "x", mode: "write" }, MOCK_CONTEXT)
    expect(result).toContain("Invalid key")
  })

  it("rejects null key", async () => {
    const result = await pipeline_store.execute!({ key: null as unknown as string, content: "x" }, MOCK_CONTEXT)
    expect(result).toContain("Invalid key")
  })

  it("rejects undefined key", async () => {
    const result = await pipeline_store.execute!({ key: undefined as unknown as string, content: "x" }, MOCK_CONTEXT)
    expect(result).toContain("Invalid key")
  })

  // Valid keys
  it("accepts all valid STATE_KEYS", async () => {
    for (const key of STATE_KEYS) {
      const result = await pipeline_store.execute!({ key, content: `data-${key}`, mode: "write" }, MOCK_CONTEXT)
      expect(result).toContain(`Stored ${key}`)
    }
  })

  it("accepts DECISION_REGISTER.md as valid storage key", async () => {
    const result = await pipeline_store.execute!(
      { key: "DECISION_REGISTER.md", content: "# Decision Register\n\n## ADR-001: Test\n- **Severity**: ⚪ Informational\n- **Context**: test\n- **Decision**: test\n- **Alternatives**: none\n- **Tradeoffs**: none\n- **Consequences**: none", mode: "write" },
      MOCK_CONTEXT
    )
    expect(result).toContain("Stored DECISION_REGISTER.md")
    const loaded = await loadState(wsId, "DECISION_REGISTER.md")
    expect(loaded).toContain("ADR-001")
    expect(loaded).toContain("Test")
  })

  // Modes
  it("append mode appends", async () => {
    await storeState(wsId, "STATE.md", "first")
    await pipeline_store.execute!({ key: "STATE.md", content: "second", mode: "append" }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("first")
    expect(loaded).toContain("second")
  })

  it("write mode overwrites", async () => {
    await storeState(wsId, "STATE.md", "old")
    await pipeline_store.execute!({ key: "STATE.md", content: "new", mode: "write" }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("new")
    expect(loaded).not.toContain("old")
  })

  it("default mode is write", async () => {
    await storeState(wsId, "STATE.md", "old")
    await pipeline_store.execute!({ key: "STATE.md", content: "fresh" }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("fresh")
    expect(loaded).not.toContain("old")
  })

  it("invalid mode string falls back to write", async () => {
    await storeState(wsId, "STATE.md", "old")
    await pipeline_store.execute!({ key: "STATE.md", content: "replaced", mode: "delete" as any }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("replaced")
  })

  // Content edge cases
  it("handles empty string content", async () => {
    const result = await pipeline_store.execute!({ key: "STATE.md", content: "" }, MOCK_CONTEXT)
    expect(result).toContain("Stored")
    expect(await loadState(wsId, "STATE.md")).toBe("\n")
  })

  it("handles null content (stored as string 'null')", async () => {
    await pipeline_store.execute!({ key: "STATE.md", content: null as unknown as string }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("null")
  })

  it("handles undefined content (stored as string 'undefined')", async () => {
    await pipeline_store.execute!({ key: "STATE.md", content: undefined as unknown as string }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("undefined")
  })

  it("handles number content cast to string", async () => {
    await pipeline_store.execute!({ key: "STATE.md", content: 42 as unknown as string }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("42")
  })

  it("handles object content cast to string", async () => {
    await pipeline_store.execute!({ key: "STATE.md", content: { a: 1 } as unknown as string }, MOCK_CONTEXT)
    const loaded = await loadState(wsId, "STATE.md")
    expect(loaded).toContain("[object Object]")
  })

  // Context edge cases
  it("returns error when no workspace context", async () => {
    const result = await pipeline_store.execute!({ key: "STATE.md", content: "x" }, { worktree: "" as any, directory: "" as any })
    expect(result).toContain("no workspace context")
  })

  it("returns error when context is empty object", async () => {
    const result = await pipeline_store.execute!({ key: "STATE.md", content: "x" }, {} as any)
    expect(result).toContain("no workspace context")
  })

  it("uses worktree when both worktree and directory set", async () => {
    const result = await pipeline_store.execute!({ key: "STATE.md", content: "z" }, { ...MOCK_CONTEXT, directory: "/other/path" })
    expect(result).toContain("Stored")
  })

  it("falls back to directory when worktree is empty", async () => {
    const result = await pipeline_store.execute!({ key: "STATE.md", content: "z" }, { worktree: "", directory: TEST_WS } as any)
    expect(result).toContain("Stored")
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
    const result = await pipeline_load.execute!({ key: "STATE.md" }, MOCK_CONTEXT)
    expect(result).toContain("content-here")
  })

  it("returns not-found message for missing file", async () => {
    const result = await pipeline_load.execute!({ key: "STATE.md" }, MOCK_CONTEXT)
    expect(result).toContain("No saved state")
  })

  it("rejects invalid key", async () => {
    const result = await pipeline_load.execute!({ key: "hacked.md" }, MOCK_CONTEXT)
    expect(result).toContain("Invalid key")
  })

  it("lines=0 returns full content", async () => {
    await storeState(wsId, "STATE.md", "full\ncontent")
    const result = await pipeline_load.execute!({ key: "STATE.md", lines: 0 }, MOCK_CONTEXT)
    expect(result).toContain("full")
    expect(result).toContain("content")
  })

  it("negative lines returns full content", async () => {
    await storeState(wsId, "STATE.md", "data")
    const result = await pipeline_load.execute!({ key: "STATE.md", lines: -5 }, MOCK_CONTEXT)
    expect(result).toContain("data")
  })

  it("NaN lines returns full content", async () => {
    await storeState(wsId, "STATE.md", "data")
    const result = await pipeline_load.execute!({ key: "STATE.md", lines: NaN }, MOCK_CONTEXT)
    expect(result).toContain("data")
  })

  it("Infinity lines returns full content", async () => {
    await storeState(wsId, "STATE.md", "data")
    const result = await pipeline_load.execute!({ key: "STATE.md", lines: Infinity }, MOCK_CONTEXT)
    expect(result).toContain("data")
  })

  it("string lines cast to number", async () => {
    const content = Array.from({ length: 10 }, (_, i) => `line${i}`).join("\n")
    await storeState(wsId, "STATE.md", content)
    const result = await pipeline_load.execute!({ key: "STATE.md", lines: "3" as unknown as number }, MOCK_CONTEXT)
    expect(result).toContain("line9")
  })

  it("large lines value returns full content", async () => {
    await storeState(wsId, "STATE.md", "x")
    const result = await pipeline_load.execute!({ key: "STATE.md", lines: 1000000 }, MOCK_CONTEXT)
    expect(result).toContain("x")
  })

  it("returns error when no workspace context", async () => {
    const result = await pipeline_load.execute!({ key: "STATE.md" }, {} as any)
    expect(result).toContain("no workspace context")
  })

  it("loads stored DECISION_REGISTER.md content", async () => {
    await pipeline_store.execute!(
      { key: "DECISION_REGISTER.md", content: "## ADR-001: Test decision", mode: "write" },
      MOCK_CONTEXT
    )
    const result = await pipeline_load.execute!(
      { key: "DECISION_REGISTER.md" },
      MOCK_CONTEXT
    )
    expect(result).toContain("ADR-001")
    expect(result).toContain("Test decision")
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
    expect(await pipeline_status.execute!({}, MOCK_CONTEXT)).toContain("Has PRD: true")
  })

  it("detects LLD", async () => {
    await storeState(wsId, "LLD.md", "test")
    expect(await pipeline_status.execute!({}, MOCK_CONTEXT)).toContain("Has LLD: true")
  })

  it("shows state preview when STATE.md exists", async () => {
    await storeState(wsId, "STATE.md", "phase=4,progress=80%")
    expect(await pipeline_status.execute!({}, MOCK_CONTEXT)).toContain("State preview:")
  })

  it("shows last session when history exists", async () => {
    await appendHistory(wsId, "completed | test feature")
    expect(await pipeline_status.execute!({}, MOCK_CONTEXT)).toContain("Last session:")
  })

  it("full workspace status", async () => {
    await storeState(wsId, "STATE.md", "phase=5")
    await storeState(wsId, "PRD.md", "build feature X")
    await storeState(wsId, "LLD.md", "detailed plan")
    await appendHistory(wsId, "finished session")
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    expect(result).toContain("Has PRD: true")
    expect(result).toContain("Has LLD: true")
    expect(result).toContain("State preview:")
    expect(result).toContain("Last session:")
  })

  it("state preview longer than 300 chars is truncated", async () => {
    const long = "x".repeat(500)
    await storeState(wsId, "STATE.md", long)
    const result = await pipeline_status.execute!({}, MOCK_CONTEXT)
    const previewLine = result.split("\n").find(l => l.startsWith("State preview:"))
    expect(previewLine).toBeTruthy()
    if (previewLine) {
      expect(previewLine.length).toBeLessThanOrEqual(317) // "State preview: " (15) + 300 chars + "..." margin
    }
  })

  it("returns error when no workspace context", async () => {
    const result = await pipeline_status.execute!({}, {} as any)
    expect(result).toContain("no workspace context")
  })
})
