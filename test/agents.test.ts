import { describe, it, expect } from "bun:test"
import { createAllAgents } from "../agents"
import { DEFAULT_CONFIG } from "../config/types"
import { NO_FLUFF, TECH_STACK_BASELINE_NOTICE, CIRCUIT_BREAKER, LLD_ESCAPE_HATCH, STRICT_GROUNDING } from "../agents/prompt-utils"

describe("createAllAgents", () => {
  const agents = createAllAgents(DEFAULT_CONFIG)

  it("creates all 8 agents", () => {
    const keys = Object.keys(agents)
    expect(keys.length).toBe(8)
  })

  it("Pipeline Orchestrator is primary mode", () => {
    const orchestrator = agents["Pipeline Orchestrator"]
    expect(orchestrator).toBeDefined()
    expect(orchestrator.mode).toBe("primary")
    expect(orchestrator.hidden).toBeFalsy()
  })

  it("all subagents are hidden", () => {
    const subagentKeys = Object.keys(agents).filter(k => k !== "Pipeline Orchestrator")
    for (const key of subagentKeys) {
      expect(agents[key].hidden).toBe(true)
    }
  })

  it("all agents have prompts", () => {
    for (const [key, agent] of Object.entries(agents)) {
      expect(agent.prompt).toBeTruthy()
      expect(typeof agent.prompt).toBe("string")
      expect((agent.prompt as string).length).toBeGreaterThan(100)
    }
  })

  it("all agents have temperature set", () => {
    for (const agent of Object.values(agents)) {
      expect(agent.temperature).toBeDefined()
    }
  })

  it("all agents have color set", () => {
    for (const [key, agent] of Object.entries(agents)) {
      expect(agent.color).toBeDefined()
    }
  })
})

describe("agent prompts", () => {
  const agents = createAllAgents(DEFAULT_CONFIG)

  it("orchestrator prompt contains workflow phases", () => {
    const prompt = agents["Pipeline Orchestrator"].prompt as string
    expect(prompt).toContain("PHASE 0")
    expect(prompt).toContain("PHASE 7")
    expect(prompt).toContain("docs-researcher")
    expect(prompt).toContain("architect")
    expect(prompt).toContain("plan-checker")
    expect(prompt).toContain("coder")
    expect(prompt).toContain("coder-pro")
    expect(prompt).toContain("linter")
    expect(prompt).toContain("auditor")
    expect(prompt).toContain("MAX 2 REFINE CYCLES")
  })

  it("coder prompt contains strict grounding", () => {
    const prompt = agents["coder"].prompt as string
    expect(prompt).toContain("STRICT GROUNDING")
    expect(prompt).toContain("LLD ESCAPE HATCH")
    expect(prompt).toContain("CIRCUIT BREAKER")
    expect(prompt).toContain("3 CONSECUTIVE")
  })

  it("coder-pro prompt contains complexity marker", () => {
    const prompt = agents["coder-pro"].prompt as string
    expect(prompt).toContain("COMPLEX")
  })

  it("architect prompt contains XML LLD format", () => {
    const prompt = agents["architect"].prompt as string
    expect(prompt).toContain("<task")
    expect(prompt).toContain("<verify>")
    expect(prompt).toContain("LITERAL BASH COMMAND")
  })

  it("linter prompt is approval-biased", () => {
    const prompt = agents["linter"].prompt as string
    expect(prompt).toContain("DEFAULT ANSWER IS PASS")
    expect(prompt).toContain("CRITICAL")
  })

  it("auditor prompt is rejection-biased", () => {
    const prompt = agents["auditor"].prompt as string
    expect(prompt).toContain("skeptical")
    expect(prompt).toContain("file:")
    expect(prompt).toContain("line:")
    expect(prompt).toContain("violation:")
  })

  it("all subagents contain NO_FLUFF", () => {
    for (const [key, agent] of Object.entries(agents)) {
      if (key === "Pipeline Orchestrator") continue
      const prompt = agent.prompt as string
      expect(prompt).toContain("Minimize output tokens")
    }
  })

  it("orchestrator does NOT contain NO_FLUFF", () => {
    const prompt = agents["Pipeline Orchestrator"].prompt as string
    expect(prompt).not.toContain("Minimize output tokens")
  })

  it("coder and architect contain TECH_STACK_BASELINE", () => {
    const coderPrompt = agents["coder"].prompt as string
    const architectPrompt = agents["architect"].prompt as string
    expect(coderPrompt).toContain("TECH_STACK_BASELINE.md")
    expect(architectPrompt).toContain("TECH_STACK_BASELINE.md")
  })
})

describe("prompt-utils", () => {
  it("NO_FLUFF contains code block exemption", () => {
    expect(NO_FLUFF).toContain("CRITICAL EXCEPTION")
    expect(NO_FLUFF).toContain("Do not minify or truncate code")
  })

  it("LLD_ESCAPE_HATCH contains all 3 error codes", () => {
    expect(LLD_ESCAPE_HATCH).toContain("DOC_CONTRADICTION")
    expect(LLD_ESCAPE_HATCH).toContain("MISSING_API")
    expect(LLD_ESCAPE_HATCH).toContain("RUNTIME_IMPOSSIBILITY")
  })

  it("CIRCUIT_BREAKER enforces 3 failure limit", () => {
    expect(CIRCUIT_BREAKER).toContain("3 CONSECUTIVE")
    expect(CIRCUIT_BREAKER).toContain("IMMEDIATELY HALT")
    expect(CIRCUIT_BREAKER).toContain("Do not attempt a 4th")
  })

  it("STRICT_GROUNDING enforces doc-first approach", () => {
    expect(STRICT_GROUNDING).toContain("Do NOT use any parameter")
    expect(STRICT_GROUNDING).toContain("Do not guess")
  })
})

describe("permissions", () => {
  const agents = createAllAgents(DEFAULT_CONFIG)

  it("orchestrator has question allow", () => {
    const perm = agents["Pipeline Orchestrator"].permission as any
    expect(perm?.question).toBe("allow")
  })

  it("docs-researcher has edit deny and docs-mcp-server allow", () => {
    const perm = agents["docs-researcher"].permission as any
    expect(perm?.edit).toBe("deny")
    expect(perm?.["docs-mcp-server_*"]).toBe("allow")
  })

  it("coder has edit allow and bash allow", () => {
    const perm = agents["coder"].permission as any
    expect(perm?.edit).toBe("allow")
    expect(perm?.bash).toBe("allow")
  })

  it("linter has edit deny and bash deny", () => {
    const perm = agents["linter"].permission as any
    expect(perm?.edit).toBe("deny")
    expect(perm?.bash).toBe("deny")
  })

  it("auditor has edit deny and bash deny", () => {
    const perm = agents["auditor"].permission as any
    expect(perm?.edit).toBe("deny")
    expect(perm?.bash).toBe("deny")
  })

  it("orchestrator task restricts to pipeline subagents only", () => {
    const perm = agents["Pipeline Orchestrator"].permission as any
    const task = perm?.task
    expect(task).toBeDefined()
    expect(task["*"]).toBe("deny")
    expect(task["coder"]).toBe("allow")
    expect(task["architect"]).toBe("allow")
  })

  it("all subagents have question deny", () => {
    for (const [key, agent] of Object.entries(agents)) {
      if (key === "Pipeline Orchestrator") continue
      const perm = agent.permission as any
      expect(perm?.question).toBe("deny")
    }
  })
})
