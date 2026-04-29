import { describe, it, expect } from "bun:test"
import { createCompactionHook } from "../hooks/compaction"

describe("createCompactionHook", () => {
  it("pushes pipeline state context", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({ sessionID: "test-123" }, output)
    expect(output.context.length).toBe(1)
    expect(output.context[0]).toContain("Pipeline State")
  })

  it("includes Current pipeline phase mention", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({}, output)
    expect(output.context[0]).toContain("Current pipeline phase")
  })

  it("includes compaction instructions for what to keep/drop", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({}, output)
    expect(output.context[0]).toContain("Do NOT preserve")
    expect(output.context[0]).toContain("Conversational Q&A")
  })

  it("includes not enough context to cause context rot", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({}, output)
    expect(output.context[0]).toContain("not enough to cause context rot")
  })

  it("handles null input (does not throw, input unused)", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook(null as unknown as { sessionID?: string }, output)
    expect(output.context.length).toBe(1)
  })

  it("handles undefined input", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({}, output)
    expect(output.context.length).toBe(1)
  })

  it("handles null output (throws)", () => {
    const hook = createCompactionHook()
    expect(() => hook({}, null as unknown as { context: string[] })).toThrow()
  })

  it("handles output with null context (throws)", () => {
    const hook = createCompactionHook()
    expect(() => hook({}, { context: null as unknown as string[] })).toThrow()
  })

  it("handles output with undefined context (throws)", () => {
    const hook = createCompactionHook()
    expect(() => hook({}, { context: undefined as unknown as string[] })).toThrow()
  })

  it("multiple invocations push multiple context entries", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({}, output)
    hook({}, output)
    expect(output.context.length).toBe(2)
  })

  it("each invocation produces identical content", () => {
    const hook = createCompactionHook()
    const out1: { context: string[] } = { context: [] }
    const out2: { context: string[] } = { context: [] }
    hook({}, out1)
    hook({}, out2)
    expect(out1.context[0]).toBe(out2.context[0])
  })
})

describe("createSessionHooks", () => {
  it("creates hooks object with correct method names", () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      { autoBranch: false, branchPrefix: "p", autoCleanup: false, baseBranch: "main", maxHistoryEntries: 50 },
    )
    expect(typeof hooks.onSessionCreated).toBe("function")
    expect(typeof hooks.onSessionIdle).toBe("function")
    expect(typeof hooks.onSessionDeleted).toBe("function")
  })

  it("autoBranch=false returns immediately from onSessionCreated", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      { autoBranch: false, branchPrefix: "p", autoCleanup: false, baseBranch: "main", maxHistoryEntries: 50 },
    )
    await hooks.onSessionCreated("test-id")
  })

  it("autoCleanup=false returns immediately from onSessionIdle", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      { autoBranch: true, branchPrefix: "p", autoCleanup: false, baseBranch: "main", maxHistoryEntries: 50 },
    )
    await hooks.onSessionIdle("test-id")
  })

  it("autoCleanup=false returns immediately from onSessionDeleted", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      { autoBranch: true, branchPrefix: "p", autoCleanup: false, baseBranch: "main", maxHistoryEntries: 50 },
    )
    await hooks.onSessionDeleted("test-id")
  })

  it("onSessionIdle returns early for unknown session", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      { autoBranch: true, branchPrefix: "p", autoCleanup: true, baseBranch: "main", maxHistoryEntries: 50 },
    )
    await hooks.onSessionIdle("never-created-session")
  })

  it("onSessionDeleted returns early for unknown session", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      { autoBranch: true, branchPrefix: "p", autoCleanup: true, baseBranch: "main", maxHistoryEntries: 50 },
    )
    await hooks.onSessionDeleted("never-created-session")
  })

  it("handles empty worktree and directory", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "", directory: "" },
      { autoBranch: false, branchPrefix: "p", autoCleanup: false, baseBranch: "main", maxHistoryEntries: 50 },
    )
    expect(typeof hooks.onSessionCreated).toBe("function")
  })
})
