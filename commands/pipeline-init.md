---description: Initialize the multi-agent pipeline in this workspaceagent: Pipeline Orchestrator---
Initialize a new pipeline session for this workspace.

Step 1: Use pipeline_status tool to check if prior state exists.
Step 2: If prior state exists, show the user a summary (last phase, progress, decisions) and ask: resume or start fresh?
Step 3: If starting fresh OR no prior state, begin Pipeline Phase 0 (Early Research).
  - Ask the user what they want to build.
  - Then invoke docs-researcher for a lightweight domain/tech scan.
  - Write .planning/RESEARCH_NOTES.md and .planning/TECH_STACK_BASELINE.md using pipeline_store.

Proceed to Phase 1 after user confirms readiness.
