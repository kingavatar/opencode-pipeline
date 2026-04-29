import { $ } from "bun"
import {
  registerWorkspace,
  getWorkspaceId,
  appendHistory,
  loadState,
} from "../storage"

interface HooksContext {
  worktree: string
  directory: string
}

interface HooksOptions {
  autoBranch: boolean
  branchPrefix: string
  autoCleanup: boolean
  baseBranch: string
}

export function createSessionHooks(ctx: HooksContext, opts: HooksOptions) {
  const sessionBranches = new Map<string, string>()

  return {
    onSessionCreated: async (sessionID: string) => {
      if (!opts.autoBranch) return

      const cwd = ctx.worktree || ctx.directory
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "")
      const shortId = sessionID.slice(0, 8)
      const branchName = `${opts.branchPrefix}/${timestamp}-${shortId}`

      let hadUncommitted = false

      try {
        const existingBranches =
          await $`git -C ${cwd} branch --list ${branchName}`.quiet().text()

        if (existingBranches.trim()) {
          await $`git -C ${cwd} checkout ${branchName}`.quiet()
        } else {
          hadUncommitted =
            (await $`git -C ${cwd} status --porcelain`.quiet().text()).trim().length > 0

          if (hadUncommitted) {
            await $`git -C ${cwd} stash --include-untracked`.quiet()
          }

          await $`git -C ${cwd} checkout -b ${branchName}`.quiet()
        }

        sessionBranches.set(sessionID, branchName)

        if (hadUncommitted) {
          const popResult = await $`git -C ${cwd} stash pop`.nothrow().quiet()
          if (popResult.exitCode !== 0) {
            console.error(
              `[pipeline] CRITICAL: Stash pop produced conflicts on branch ${branchName}. ` +
              `Your changes are in a conflicted state. The stash is preserved. ` +
              `Run 'git stash list' and 'git diff' to inspect.`,
            )
          }
        }

        await registerWorkspace(cwd)
      } catch (err) {
        console.error(
          `[pipeline] Failed to create/switch branch ${branchName}:`,
          err,
        )
      }
    },

    onSessionIdle: async (sessionID: string) => {
      if (!opts.autoBranch || !opts.autoCleanup) return

      const cwd = ctx.worktree || ctx.directory
      const branchName = sessionBranches.get(sessionID)
      if (!branchName) return

      try {
        await $`git -C ${cwd} checkout ${opts.baseBranch} 2>/dev/null`.quiet()
        const mergeResult = await $`git -C ${cwd} merge --no-ff --no-edit ${branchName} 2>/dev/null`.nothrow().quiet()
        sessionBranches.delete(sessionID)
        if (mergeResult.exitCode === 0) {
          const workspaceId = getWorkspaceId(cwd)
          const state = await loadState(workspaceId, "STATE.md")
          const summary = state ? state.split("\n")[0]?.slice(0, 80) : "completed"
          await appendHistory(workspaceId, `completed | ${summary}`)
        }
      } catch {
        // Non-blocking: branch cleanup is optional
      }
    },
  }
}
