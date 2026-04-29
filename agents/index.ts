import type { AgentConfig } from "@opencode-ai/sdk"
import type { PipelineConfig } from "../config/types"
import { createOrchestrator } from "./orchestrator"
import { createDocsResearcher } from "./docs-researcher"
import { createAdvisor } from "./advisor"
import { createArchitect } from "./architect"
import { createPlanChecker } from "./plan-checker"
import { createCoder, createCoderPro } from "./coder"
import { createLinter, createAuditor } from "./linter"

export function createAllAgents(config: PipelineConfig): Record<string, AgentConfig> {
  const m = config.models

  return {
    "Advisor": createAdvisor(m.advisor),
    "Pipeline Orchestrator": createOrchestrator(m.orchestrator),
    "docs-researcher": createDocsResearcher(m.docsResearcher),
    "architect": createArchitect(m.architect),
    "plan-checker": createPlanChecker(m.planChecker),
    "coder": createCoder(m.coder),
    "coder-pro": createCoderPro(m.coderPro),
    "linter": createLinter(m.linter),
    "auditor": createAuditor(m.auditor),
  }
}
