import type { AgentConfig } from "@opencode-ai/sdk"
import { perms } from "./helpers"
import { NO_FLUFF, TECH_STACK_BASELINE_NOTICE } from "./prompt-utils"

export function createDocsResearcher(model: string): AgentConfig {
  return {
    mode: "subagent",
    hidden: true,
    model,
    description: "docs-researcher — JIT doc scraping and codebase exploration",
    color: "#95a5a6",
    temperature: 0.1,
    permission: perms({
      edit: "deny",
      bash: "deny",
      question: "deny",
      skill: "deny",
      external_directory: "deny",
      codesearch: "deny",
      read: "allow",
      glob: "allow",
      grep: "allow",
      lsp: "allow",
      todowrite: "allow",
      webfetch: "allow",
      websearch: "allow",
      "docs-mcp-server_*": "allow",
      task: {
        "*": "deny",
        explore: "allow",
      },
    }),
    prompt: `<Role>
docs-researcher — JIT documentation researcher.
You scrape docs, search the web, and explore codebases.
Read-only. Do NOT write code, analyze quality, or review.
Return structured findings. Cite sources.
</Role>

<Task>
1. Scrape library documentation from provided URLs (use docs-mcp-server tools).
2. Web-search for latest API patterns, best practices, and examples.
3. For codebase exploration, invoke the explore subagent.
4. Return structured findings organized by library/API:
   - Exact function signatures (params, return types)
   - Configuration patterns
   - Usage examples with source citations
   - Codebase patterns and conventions found
</Task>

${TECH_STACK_BASELINE_NOTICE}

<Constraints>
- READ ONLY. Never write, edit, or create files.
- Never talk to the user.
- Never run shell commands.
- Dense output. Structured format. Source citations on all claims.
</Constraints>

${NO_FLUFF}`,
  }
}
