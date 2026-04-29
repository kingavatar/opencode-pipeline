# OpenCode Agent Pipeline

A cost-efficient, doc-grounded, multi-agent development pipeline plugin for [OpenCode](https://opencode.ai).

8 specialized agents work through an 8-phase workflow: **Research → Requirements → Architecture → Plan Check → Code → Dual Review → Filter → Commit**. Only the orchestrator talks to you. Everything else is automated.

Built on DeepSeek V4 API (Pro + Flash). Flash is 12x cheaper on output — the plugin assigns the cheapest model that can do each job.

## Installation

### One command

```bash
cd ~/dev/personal/opencode-pipeline && bun run deploy
```

This builds the plugin, copies command markdown files to `~/.config/opencode/commands/`, and ensures the `file:///` entry is in your `opencode.json` plugin array. Commands use OpenCode's file auto-discovery (GSD pattern) — no config hook injection, no web server crashes.

### Manual

```bash
cd ~/dev/personal/opencode-pipeline
bun install
bun run deploy
```

Then add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "file:///home/emperor/dev/personal/opencode-pipeline/dist/index.js"
  ]
}
```

For local filesystem plugins, OpenCode uses `file:///` URIs in the `plugin` array. The flat file copy to `~/.config/opencode/plugins/pipeline.js` serves as a secondary load path for auto-discovery.

Restart OpenCode. The `Pipeline Orchestrator` agent appears in your Tab cycle.

**To update after changes:**
```bash
cd ~/dev/personal/opencode-pipeline && bun run deploy
```

### Uninstall

```bash
cd ~/dev/personal/opencode-pipeline && bun run uninstall
```

This removes the plugin file and the `file:///` entry from `opencode.json`.
Pipeline storage (`~/.local/share/opencode/pipeline/`) is preserved — remove manually if desired:
```bash
rm -rf ~/.local/share/opencode/pipeline
```

### npm (future)

```
npm install @emperor/opencode-pipeline
```

Then add to `opencode.json`:

```json
{
  "plugin": ["@emperor/opencode-pipeline"]
}
```

## Usage

### Getting Started

1. Open any project in OpenCode
2. Tab-switch to `Pipeline Orchestrator`
3. Run `/pipeline-init`
4. Describe what you want to build

The orchestrator interviews you, fetches research, creates architecture plans, writes code, reviews it, and commits — all with your approval at each major decision point.

### Commands

| Command | Action |
|---|---|
| `/pipeline-init` | Initialize pipeline. Detects prior state, starts Phase 0 |
| `/pipeline-resume` | Resume from last saved state |
| `/pipeline-status` | Show current phase, branch, decisions, progress |
| `/pipeline-help` | Full workflow overview and agent reference |

### Workflow

```
PHASE 0: EARLY RESEARCH        domain/tech scan → informs questions
PHASE 1: REQUIREMENTS          interview user → lock PRD
PHASE 2: ARCHITECTURE          HLD → user approve → XML LLD
PHASE 3: PLAN CHECK            verify LLD addresses all PRD items
PHASE 4: CODE                  write code, JIT docs, run tests
PHASE 5: DUAL REVIEW (para)    linter (approval) + auditor (rejection)
PHASE 6: FILTER & PRESENT      verify findings, present to user
PHASE 7: COMMIT                git add/commit/push
```

## Agent Roster

| Agent | Model | Mode | Cost/Cycle | Role |
|---|---|---|---|---|
| **Pipeline Orchestrator** | Pro | Primary | $0.03 | User interface, workflow driver, commit handler |
| **docs-researcher** | Flash | Hidden | $0.002 | JIT doc scraping, web search, codebase exploration |
| **architect** | Pro | Hidden | $0.05 | PRD → HLD → XML LLD |
| **plan-checker** | Flash | Hidden | $0.002 | Pre-execution LLD vs PRD verification |
| **coder** | Flash | Hidden | $0.007 | Routine code implementation |
| **coder-pro** | Pro | Hidden | $0.05 | Complex algorithmic implementation |
| **linter** | Flash | Hidden | $0.002 | Approval-biased LLD compliance check |
| **auditor** | Pro | Hidden | $0.04 | Rejection-biased bug/security/perf audit |

**Total: ~$0.13 per cycle (closed coder), ~$0.18 (pro coder).**

Hidden agents are invoked automatically by the orchestrator via the Task tool. They never appear in the @mention menu and never talk to you directly.

### Model Assignment Rationale

- **Flash (13B active)**: docs-researcher, plan-checker, linter — read/fetch or checklist pattern-matching. Flash is 12x cheaper on output.
- **Pro (49B active)**: orchestrator, architect, auditor — user-facing quality, deep reasoning for planning, subtle bug detection.
- **coder defaults to Flash**: Spec-driven coding from LLD + docs is a translation task. Flash's 13B active params are sufficient. `coder-pro` is the fallback for complex algorithms.

## Architecture Decisions

### JIT Docs Only — No Pre-Fetch Wall
50K token doc walls trigger "lost in the middle" syndrome, especially on Flash. The coder fetches 5-10 specific function signatures via docs-researcher as needed — not 50K tokens upfront.

### State on Disk, Not in Context
All artifacts (PRD.md, LLD.md, reports) live on disk in `.planning/`. Agents read files directly. The orchestrator's context stays at 30-40% capacity, preventing context rot and enabling session pause/resume.

### Dual-Biased Review (Weave's Weft/Warp Pattern)
A single reviewer with a generic "find issues" prompt either fabricates issues or misses real bugs. Two reviewers with opposite biases, invoked in parallel:
- **linter**: Approval-biased. Default answer is PASS. Only flags CRITICAL LLD deviations.
- **auditor**: Rejection-biased. Skeptical. Finds bugs, edge cases, security gaps, performance issues. Every finding requires `file:line + doc quote` as evidence.

Neither controls the verdict alone. The orchestrator synthesizes both.

### Strict Grounding — Not "No Memory"
LLMs cannot suppress pre-training. The coder's prompt enforces: "For EVERY library call, verify the exact signature from DOCS provided by docs-researcher. Do NOT use any parameter, return type, or pattern not explicitly documented. If DOCS lack needed info, invoke docs-researcher. Do not guess."

### LLD Escape Hatch with Enum Typing
If the LLD contradicts reality (wrong data structure, impossible API), the coder can propose an `LLD_UPDATE_REQUEST` — but only with 3 exact error codes: `DOC_CONTRADICTION`, `MISSING_API`, `RUNTIME_IMPOSSIBILITY`. Style preferences are rejected.

### Circuit Breaker
If the coder's tests fail 3 consecutive times on the same test, it halts and reports to the orchestrator instead of looping silently.

### Pre-Execution Plan Verification
A flash-based plan-checker ($0.002) catches LLD gaps before coding. Fixing a missing requirement at the plan stage costs $0.002. Fixing it after coding costs a full coder + review cycle.

### Literal Bash Commands in `<verify>` Tags
The architect writes exact, executable test commands. The coder executes them verbatim and appends raw stdout. Prevents hallucinated test results.

### Rolling Context Summary
After Phase 2 (LLD approved) and Phase 6 (review filtered), the orchestrator summarizes conversation into decisions and flushes raw Q&A. Keeps context lean.

### No-Fluff Output (Subagents Only)
All subagents strip filler words, pleasantries, and hedging. Saves 20-30% output tokens. Code blocks are exempted — they retain comprehensive JSDoc and clear error messages.

### Max 2 Refine Cycles
Without a guard, coder → auditor → coder could loop indefinitely. The orchestrator enforces a hard limit.

## Configuration

Create `~/.config/opencode/pipeline-config.jsonc` (global) or `.opencode/pipeline-config.jsonc` (per-project):

```jsonc
{
  "debug": false,
  "storage": {
    "maxHistoryEntries": 50
  },
  "models": {
    "orchestrator": "deepseek-oai/deepseek-v4-pro",
    "docsResearcher": "deepseek-oai/deepseek-v4-flash",
    "architect": "deepseek-oai/deepseek-v4-pro",
    "planChecker": "deepseek-oai/deepseek-v4-flash",
    "coder": "deepseek-oai/deepseek-v4-flash",
    "coderPro": "deepseek-oai/deepseek-v4-pro",
    "linter": "deepseek-oai/deepseek-v4-flash",
    "auditor": "deepseek-oai/deepseek-v4-pro"
  },
  "workflow": {
    "maxRefineCycles": 2,
    "skipPlanCheck": false,
    "skipAudit": false,
    "skipLinter": false,
    "autoCompact": true,
    "assumptionsMode": false
  },
  "git": {
    "autoBranch": true,
    "branchPrefix": "pipeline",
    "autoCleanupBranches": true,
    "baseBranch": "main"
  }
}
```

### Configuration Options

| Key | Default | Description |
|---|---|---|
| `debug` | `false` | Enable `[pipeline]` debug logs at startup |
| `models.*` | DeepSeek Flash/Pro | Override any agent's model (e.g. swap coder to a local model) |
| `git.baseBranch` | `main` | Base branch to merge pipeline branches into |
| `git.autoBranch` | `true` | Create isolated git branch per session |
| `storage.maxHistoryEntries` | 50 | Max session entries in HISTORY.md before pruning |

### Workflow Toggles

| Toggle | Default | Effect |
|---|---|---|
| `skipPlanCheck` | false | Skip Phase 3 plan verification |
| `skipAudit` | false | Skip auditor in Phase 5 (linter still runs) |
| `skipLinter` | false | Skip linter in Phase 5 (auditor still runs) |
| `maxRefineCycles` | 2 | Max code → review → fix loops |
| `assumptionsMode` | false | Codebase-first for brownfield projects |

For trivial tasks (config changes, doc updates), toggle off plan-check and audit to reduce cost and latency.

## Storage

Pipeline state persists to `~/.local/share/opencode/pipeline/<workspace-id>/`:

```
~/.local/share/opencode/pipeline/
├── workspaces.json
└── <workspace-id>/
    ├── STATE.md                 Current phase, progress, active session
    ├── PRD.md                   Last product requirements
    ├── LLD.md                   Last low-level design
    ├── TECH_STACK_BASELINE.md   Framework/library versions
    ├── HISTORY.md               Session log (decisions only, not full context)
    └── sessions/
        └── <session-id>.json
```

**HISTORY.md stores decisions and outcomes, not full context** — preventing context rot when new sessions reference old work.

## Git Integration

On session start: creates branch `pipeline/<YYYYMMDD>-<short-id>` to isolate work.
On session completion: merges back to main, appends summary to HISTORY.

Git branch isolation only activates in directories that are git repositories. In non-git directories, all git operations silently skip — no errors, no noise. Multiple sessions in the same workspace never collide.

## Cost Model

Medium-complexity feature cycle (~$0.13):

| Agent | Model | Input | Output | Cost |
|---|---|---|---|---|
| orchestrator | Pro | 15K (30% cached) | 3K | $0.031 |
| docs-researcher | Flash | 8K (50% cached) | 2K | $0.002 |
| architect | Pro | 20K (40% cached) | 5K | $0.048 |
| plan-checker | Flash | 10K (40% cached) | 1K | $0.002 |
| coder | Flash | 15K (30% cached) | 8K | $0.007 |
| linter (parallel) | Flash | 10K (30% cached) | 1.5K | $0.002 |
| auditor (parallel) | Pro | 18K (30% cached) | 4K | $0.038 |

With coder-pro: ~$0.18/cycle.

Cache estimates: system prompts are always cache hits ($0.145/M for Pro, $0.028/M for Flash). Dynamic content is cache miss.

## Plugin Architecture

```typescript
// index.ts — plugin entrypoint
export default async (ctx) => {
  const config = await loadConfig(ctx.directory)
  const agents = createAllAgents(config)

  return {
    // Inject agents + commands at startup
    config: async (cfg) => {
      cfg.agent = { ...cfg.agent, ...agents }
      cfg.command = { ...cfg.command, ...PIPELINE_COMMANDS }
    },

    // Custom tools for state persistence
    tool: { pipeline_store, pipeline_load, pipeline_status },

    // Git branch isolation on session start
    event: async ({ event }) => {
      if (event.type === "session.created") createBranch(...)
    },

    // Pipeline-aware compaction
    "experimental.session.compacting": async (input, output) => {
      output.context.push("## Pipeline State: ...")
    },
  }
}
```

### Dependencies

Only 2 runtime deps — both already bundled with OpenCode:
- `@opencode-ai/plugin` — Plugin type, `tool()` helper, `tool.schema`
- `@opencode-ai/sdk` — `AgentConfig` type

No zod, no external packages. Built output: ~32KB.

### Source Structure

```
src/
├── index.ts                     Plugin entry
├── agents/
│   ├── orchestrator.ts          Primary orchestrator (Pro)
│   ├── docs-researcher.ts       JIT doc fetcher (Flash)
│   ├── architect.ts             HLD/LLD planner (Pro)
│   ├── plan-checker.ts          Pre-exec LLD verifier (Flash)
│   ├── coder.ts                 coder + coder-pro (Flash/Pro)
│   ├── linter.ts                linter + auditor (Flash/Pro)
│   ├── prompt-utils.ts          Shared prompt fragments
│   └── helpers.ts               Type utilities
├── tools/index.ts               pipeline_store/load/status
├── commands/index.ts            4 slash commands
├── hooks/
│   ├── session-lifecycle.ts     Git branch isolation
│   └── compaction.ts            Pipeline-aware compaction
├── storage/
│   └── workspace-registry.ts    State persistence + HISTORY.md
├── config/
│   ├── types.ts                 PipelineConfig type
│   └── loader.ts                Config loader with defaults
└── script/build.ts              Bun build
```

## References

- [Weave](https://github.com/pgermishuys/opencode-weave) — Plugin structure, agent registration via config hook, Weft/Warp dual review pattern
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) — Fresh context per plan, state on disk, pre-exec plan check, XML LLD format, research before questions
- [OpenCode Plugin Docs](https://opencode.ai/docs/plugins) — Plugin lifecycle, hooks, events, custom tools
- [OpenCode Agent Docs](https://opencode.ai/docs/agents) — AgentConfig type, modes, permissions, hidden agents

## License

MIT
