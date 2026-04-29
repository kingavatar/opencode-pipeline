import type { Plugin } from "@opencode-ai/plugin"
import type { AgentConfig } from "@opencode-ai/sdk"
import { createAllAgents } from "./agents"
import { pipeline_store, pipeline_load, pipeline_status } from "./tools"
import { PIPELINE_COMMANDS } from "./commands"
import { createSessionHooks, createCompactionHook } from "./hooks"
import { loadConfig } from "./config/loader"
import { DEFAULT_CONFIG } from "./config/types"

const PipelinePlugin: Plugin = async (ctx) => {
  const cwd = ctx.worktree || ctx.directory
  if (!cwd) {
    console.error("[pipeline] No worktree or directory in context, plugin disabled")
    return {}
  }

  let config
  try {
    config = await loadConfig(cwd)
  } catch (err) {
    console.error("[pipeline] Failed to load config, using defaults:", err)
    config = DEFAULT_CONFIG
  }

  const agents = createAllAgents(config)

  const sessionHooks = createSessionHooks(
    { worktree: ctx.worktree, directory: ctx.directory },
    {
      autoBranch: config.git.autoBranch,
      branchPrefix: config.git.branchPrefix,
      autoCleanup: config.git.autoCleanupBranches,
      baseBranch: config.git.baseBranch,
    },
  )

  const compactionHook = createCompactionHook()

  return {
    config: async (cfg: Record<string, unknown>) => {
      const existingAgents = (cfg.agent ?? {}) as Record<string, AgentConfig>
      cfg.agent = { ...existingAgents, ...agents }

      const existingCommands = (cfg.command ?? {}) as Record<string, unknown>
      cfg.command = { ...existingCommands, ...PIPELINE_COMMANDS }
    },

    tool: {
      pipeline_store,
      pipeline_load,
      pipeline_status,
    },

    event: async ({ event }) => {
      try {
        if (event.type === "session.created") {
          const props = event.properties as { sessionID?: string } | undefined
          const sessionID = props?.sessionID
          if (sessionID) {
            await sessionHooks.onSessionCreated(sessionID)
          }
        }

        if (event.type === "session.idle") {
          const props = event.properties as { sessionID?: string } | undefined
          const sessionID = props?.sessionID
          if (sessionID) {
            await sessionHooks.onSessionIdle(sessionID)
          }
        }
      } catch (err) {
        console.error("[pipeline] Event handler error:", err)
      }
    },

    "experimental.session.compacting": async (
      input: { sessionID?: string },
      output: { context: string[] },
    ) => {
      if (output?.context) {
        compactionHook(input, output)
      }
    },
  }
}

export default PipelinePlugin
