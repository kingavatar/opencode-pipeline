import type { Plugin } from "@opencode-ai/plugin"
import type { AgentConfig } from "@opencode-ai/sdk"
import { createAllAgents } from "./agents"
import { pipeline_store, pipeline_load, pipeline_status } from "./tools"
import { createSessionHooks, createCompactionHook } from "./hooks"
import { loadConfig } from "./config/loader"
import { DEFAULT_CONFIG } from "./config/types"

function log(debug: boolean, ...args: unknown[]) {
  if (debug) console.log("[pipeline]", ...args)
}

function permissionToTools(p: unknown): Record<string, boolean> {
  const perm = p as Record<string, unknown> | undefined
  if (!perm || typeof perm !== "object") return {}

  const tools: Record<string, boolean> = {}

  if (perm.edit === "deny") {
    tools.write = false
    tools.edit = false
  }
  if (perm.bash === "deny") {
    tools.bash = false
  }
  if (perm.task === "deny") {
    tools.task = false
  }
  if (perm.webfetch === "deny") tools.webfetch = false
  if (perm.websearch === "deny") tools.websearch = false
  if (perm.question === "deny") tools.question = false
  if (perm.skill === "deny") tools.skill = false
  if (perm.lsp === "deny") tools.lsp = false
  if (perm.codesearch === "deny") tools.codesearch = false
  if (perm.todowrite === "deny") tools.todowrite = false

  return tools
}

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

  const debug = !!config.debug
  log(debug, "Loaded config, debug enabled")

  const agents = createAllAgents(config)
  log(debug, "Created", Object.keys(agents).length, "agents")

  const sessionHooks = createSessionHooks(
    { worktree: ctx.worktree, directory: ctx.directory },
    {
      autoBranch: config.git.autoBranch,
      branchPrefix: config.git.branchPrefix,
      autoCleanup: config.git.autoCleanupBranches,
      baseBranch: config.git.baseBranch,
      maxHistoryEntries: config.storage.maxHistoryEntries,
    },
  )

  const compactionHook = createCompactionHook()

  return {
    config: async (cfg: Record<string, unknown>) => {
      const existingAgents = (cfg.agent ?? {}) as Record<string, AgentConfig>

      // Normalize agents: use tools boolean map (Weave pattern).
      // Preserve permission object (minus external_directory) for agents
      // with scoped task/bash so the runtime can enforce scope.
      // Flat-only agents get permission=undefined (tools map is sufficient).
      const normalized: Record<string, AgentConfig> = {}
      for (const [name, agent] of Object.entries(agents)) {
        const perm = agent.permission as Record<string, unknown> | undefined
        let cleanedPermission: Record<string, unknown> | undefined = undefined

        if (perm && typeof perm === "object") {
          // Strip external_directory — it crashes the web server
          const { external_directory, ...rest } = perm
          const hasScopedTask = typeof rest.task === "object" && rest.task !== null
          const hasScopedBash = typeof rest.bash === "object" && rest.bash !== null

          if (hasScopedTask || hasScopedBash) {
            cleanedPermission = rest
          }
        }

        normalized[name] = {
          ...agent,
          permission: cleanedPermission,
          tools: permissionToTools(cleanedPermission),
        }
      }

      cfg.agent = { ...existingAgents, ...normalized }
      log(debug, "Registered", Object.keys(normalized).length, "agents")
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

        if (event.type === "session.deleted") {
          const props = event.properties as { sessionID?: string } | undefined
          const sessionID = props?.sessionID
          if (sessionID) {
            await sessionHooks.onSessionDeleted(sessionID)
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
