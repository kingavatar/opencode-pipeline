---description: Show pipeline commands and workflow overviewagent: Pipeline Orchestrator---
Display the full pipeline workflow overview:

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

AGENTS: 8 specialized agents — only the Orchestrator talks to you.
