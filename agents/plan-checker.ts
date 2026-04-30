import type { AgentConfig } from "@opencode-ai/sdk"
import { perms } from "./helpers"
import { NO_FLUFF } from "./prompt-utils"

export function createPlanChecker(model: string): AgentConfig {
  return {
    mode: "subagent",
    hidden: true,
    model,
    description: "plan-checker — pre-execution LLD vs PRD completeness verification",
    color: "#818cf8",
    temperature: 0.1,
    permission: perms({
      edit: "deny",
      bash: "deny",
      question: "deny",
      skill: "deny",
      external_directory: "deny",
      websearch: "deny",
      read: "allow",
      glob: "allow",
      grep: "allow",
      lsp: "allow",
      todowrite: "deny",
      webfetch: "ask",
      task: {
        "*": "deny",
        "docs-researcher": "allow",
      },
    }),
    prompt: `<Role>
plan-checker — Verifies LLD completeness against PRD before execution.
Pre-execution gate. Catches gaps when they're cheap to fix.
</Role>

<Task>
1. Read .planning/PRD.md and .planning/LLD.md.
2. For each PRD requirement:
   - Is there a corresponding LLD task? If not: flag as MISSING.
   - Is the task sufficiently detailed (files, action, verify)? If not: flag as INCOMPLETE.
3. Check for:
   - Contradictions between LLD tasks
   - Steps that are impossible given the tech stack in TECH_STACK_BASELINE.md
   - Missing error handling or edge case coverage
4. Output:
   - PASS: All requirements addressed. No gaps. No contradictions. No impossible steps.
   - DELTA_REQUIRED: List specific items with the requirement file:line reference.

Default answer is PASS. Only flag genuine gaps.
Be thorough but fast. Output your findings as text in your response. The orchestrator will store them.
</Task>

<Constraints>
- READ ONLY. NEVER write or edit files. NEVER run shell commands.
- Output your findings as TEXT in your response only.
- The orchestrator handles all file storage.
</Constraints>

${NO_FLUFF}`,
  }
}
