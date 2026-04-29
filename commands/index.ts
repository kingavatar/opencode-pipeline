export const PIPELINE_COMMANDS: Record<
  string,
  {
    description: string
    agent: string
    prompt: string
  }
> = {
  "pipeline-init": {
    description:
      "Initialize the multi-agent pipeline in this workspace",
    agent: "Pipeline Orchestrator",
    prompt: `Initialize a new pipeline session for this workspace.

Step 1: Use pipeline_status tool to check if prior state exists.
Step 2: If prior state exists, show the user a summary (last phase, progress, decisions) and ask: resume or start fresh?
Step 3: If starting fresh OR no prior state, begin Pipeline Phase 0 (Early Research).
  - Ask the user what they want to build.
  - Then invoke docs-researcher for a lightweight domain/tech scan.
  - Write .planning/RESEARCH_NOTES.md and .planning/TECH_STACK_BASELINE.md using pipeline_store.

Proceed to Phase 1 after user confirms readiness.`,
  },
  "pipeline-resume": {
    description:
      "Resume pipeline from last saved state",
    agent: "Pipeline Orchestrator",
    prompt: `Load pipeline state from storage using pipeline_load.

Show the user:
- Current phase and progress
- Active decisions
- Active git branch
- Last session's outcome

Ask: Continue from here?
If yes: proceed from the current phase.
If no: offer to start a fresh pipeline session.`,
  },
  "pipeline-status": {
    description:
      "Show current pipeline status",
    agent: "Pipeline Orchestrator",
    prompt: `Use pipeline_status tool and pipeline_load for STATE.md.

Display: workspace, current phase, completed phases,
open issues, active branch, last commit, history preview.`,
  },
  "pipeline-help": {
    description:
      "Show pipeline commands and workflow overview",
    agent: "Pipeline Orchestrator",
    prompt: `Display the full pipeline workflow overview:

8 PHASES:
0. Early Research — domain/tech scan
1. Requirements — interview user, lock PRD
2. Architecture — HLD → user approve → XML LLD
3. Plan Check — verify LLD completeness (skip with /pipeline-skip-plancheck)
4. Code — write code, JIT docs, circuit breaker
5. Dual Review (parallel) — linter (approval) + auditor (rejection)
6. Filter — present findings, user decides
7. Commit — git add/commit/push

COMMANDS: pipeline-init, pipeline-resume, pipeline-status, pipeline-help
TOGGLES: In pipeline-config.jsonc: skipPlanCheck, skipAudit, skipLinter
COST: ~$0.13 per cycle (flash coder), ~$0.18 (pro coder)

AGENTS: 8 specialized agents — only the Orchestrator talks to you.`,
  },
}
