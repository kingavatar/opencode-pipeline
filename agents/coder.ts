import type { AgentConfig } from "@opencode-ai/sdk"
import { perms } from "./helpers"
import {
  NO_FLUFF,
  CIRCUIT_BREAKER,
  LLD_ESCAPE_HATCH,
  STRICT_GROUNDING,
  TECH_STACK_BASELINE_NOTICE,
} from "./prompt-utils"

function coderPrompt(complexity: string): string {
  return `<Role>
coder — Writes code from LLD specifications and documentation.
For ${complexity} tasks. Spec-driven, doc-grounded implementation.
</Role>

<Task>
1. Read .planning/LLD.md. Implement exactly. Do not deviate.
2. For each LLD task: write the specified files with the specified logic.
3. After writing: execute the EXACT <verify> bash commands from LLD.
   Append raw stdout (pass/fail/coverage) to .planning/CODE_SUMMARY.md.
4. Write .planning/CODE_SUMMARY.md listing all changed files + test results.
</Task>

${STRICT_GROUNDING}
${TECH_STACK_BASELINE_NOTICE}
${LLD_ESCAPE_HATCH}
${CIRCUIT_BREAKER}

<Constraints>
- Only write code for which <verify> commands and API signatures are documented.
- If tests fail: fix, retry. Max 3 consecutive SAME-test failures. Then halt.
- If LLD contradicts reality: LLD_UPDATE_REQUEST with valid enum code.
- Do NOT reformat untouched code. Do NOT add "improvements" outside LLD scope.
</Constraints>

${NO_FLUFF}`
}

const coderPerms = perms({
  edit: "allow",
  read: "allow",
  glob: "allow",
  grep: "allow",
  lsp: "allow",
  codesearch: "allow",
  todowrite: "allow",
  question: "deny",
  skill: "deny",
  external_directory: "deny",
  webfetch: "deny",
  websearch: "deny",
  bash: "allow",
  task: {
    "*": "deny",
    "docs-researcher": "allow",
  },
})

export function createCoder(model: string): AgentConfig {
  return {
    mode: "subagent",
    hidden: true,
    model,
    description: "coder — routine code implementation (Flash)",
    color: "#4ade80",
    temperature: 0.1,
    permission: coderPerms,
    prompt: coderPrompt("routine/boilerplate"),
  }
}

export function createCoderPro(model: string): AgentConfig {
  return {
    mode: "subagent",
    hidden: true,
    model,
    description: "coder-pro — complex code implementation (Pro)",
    color: "#22c55e",
    temperature: 0.1,
    permission: coderPerms,
    prompt: coderPrompt("COMPLEX algorithmic, multi-file refactor, novel pattern"),
  }
}
