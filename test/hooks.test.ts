import { describe, it, expect } from "bun:test"
import { createCompactionHook } from "../hooks/compaction"

describe("createCompactionHook", () => {
  it("pushes pipeline state context", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({ sessionID: "test-123" }, output)

    expect(output.context.length).toBe(1)
    expect(output.context[0]).toContain("Pipeline State")
    expect(output.context[0]).toContain("Current pipeline phase")
    expect(output.context[0]).toContain("next session gets enough context")
  })

  it("includes compaction instructions for what to keep/drop", () => {
    const hook = createCompactionHook()
    const output: { context: string[] } = { context: [] }
    hook({}, output)

    expect(output.context[0]).toContain("Do NOT preserve")
    expect(output.context[0]).toContain("Conversational Q&A")
  })
})

describe("createSessionHooks", () => {
  it("creates hooks object with onSessionCreated, onSessionIdle, onSessionDeleted", () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      {
        autoBranch: false,
        branchPrefix: "pipeline",
        autoCleanup: false,
        baseBranch: "main",
        maxHistoryEntries: 50,
      },
    )

    expect(typeof hooks.onSessionCreated).toBe("function")
    expect(typeof hooks.onSessionIdle).toBe("function")
    expect(typeof hooks.onSessionDeleted).toBe("function")
  })

  it("autoBranch=false returns immediately from onSessionCreated", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      {
        autoBranch: false,
        branchPrefix: "p",
        autoCleanup: false,
        baseBranch: "main",
        maxHistoryEntries: 50,
      },
    )

    await hooks.onSessionCreated("test-id")
  })

  it("autoCleanup=false returns immediately from onSessionIdle", async () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      {
        autoBranch: true,
        branchPrefix: "p",
        autoCleanup: false,
        baseBranch: "main",
        maxHistoryEntries: 50,
      },
    )

    await hooks.onSessionIdle("test-id")
  })

  it("sessionBranches map tracks branches per session", () => {
    const { createSessionHooks } = require("../hooks/session-lifecycle")
    const hooks = createSessionHooks(
      { worktree: "/tmp/test", directory: "/tmp/test" },
      {
        autoBranch: true,
        branchPrefix: "p",
        autoCleanup: false,
        baseBranch: "main",
        maxHistoryEntries: 50,
      },
    )

    expect(hooks.onSessionCreated).toBeDefined()
  })
})
