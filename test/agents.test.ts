import { describe, it, expect } from "bun:test"
import { createAllAgents } from "../agents"
import { perms } from "../agents/helpers"
import { DEFAULT_CONFIG } from "../config/types"
import {
  NO_FLUFF,
  TECH_STACK_BASELINE_NOTICE,
  CIRCUIT_BREAKER,
  LLD_ESCAPE_HATCH,
  STRICT_GROUNDING,
} from "../agents/prompt-utils"

describe("perms helper", () => {
  it("returns the same object reference (identity)", () => {
    const obj = { read: "allow", edit: "deny" } as Record<string, unknown>
    expect(perms(obj)).toBe(obj)
  })

  it("passes through empty object", () => {
    expect(perms({})).toEqual({})
  })

  it("passes through null (no runtime guard)", () => {
    expect(perms(null as unknown as Record<string, unknown>)).toBe(null)
  })

  it("passes through undefined", () => {
    expect(perms(undefined as unknown as Record<string, unknown>)).toBe(undefined)
  })

  it("passes through string (no type guard)", () => {
    expect(perms("hello" as unknown as Record<string, unknown>)).toBe("hello")
  })

  it("passes through number", () => {
    expect(perms(42 as unknown as Record<string, unknown>)).toBe(42)
  })

  it("passes through array", () => {
    const arr = ["a", "b"]
    expect(perms(arr as unknown as Record<string, unknown>)).toBe(arr)
  })

  it("passes nested permission config with task scoping", () => {
    const obj = {
      edit: "allow",
      bash: { "*": "ask", "git status": "allow" },
      task: { "*": "deny", coder: "allow" },
      question: "allow",
    }
    expect(perms(obj)).toBe(obj)
  })
})

describe("prompt-utils constants", () => {
  it("all constants are non-empty strings", () => {
    const constants = [NO_FLUFF, TECH_STACK_BASELINE_NOTICE, CIRCUIT_BREAKER, LLD_ESCAPE_HATCH, STRICT_GROUNDING]
    for (const c of constants) {
      expect(typeof c).toBe("string")
      expect(c.length).toBeGreaterThan(10)
    }
  })

  it("TECH_STACK_BASELINE_NOTICE contains tech stack reference", () => {
    expect(TECH_STACK_BASELINE_NOTICE).toContain("TECH_STACK_BASELINE.md")
    expect(TECH_STACK_BASELINE_NOTICE).toContain("ecosystem")
  })

  it("NO_FLUFF contains code block exemption", () => {
    expect(NO_FLUFF).toContain("CRITICAL EXCEPTION")
    expect(NO_FLUFF).toContain("Do not minify or truncate code")
    expect(NO_FLUFF).toContain("NO-FLUFF INSTRUCTION")
  })

  it("LLD_ESCAPE_HATCH contains all 3 error codes", () => {
    expect(LLD_ESCAPE_HATCH).toContain("DOC_CONTRADICTION")
    expect(LLD_ESCAPE_HATCH).toContain("MISSING_API")
    expect(LLD_ESCAPE_HATCH).toContain("RUNTIME_IMPOSSIBILITY")
  })

  it("LLD_ESCAPE_HATCH mentions rejection for invalid codes", () => {
    expect(LLD_ESCAPE_HATCH).toContain("REJECT")
  })

  it("CIRCUIT_BREAKER enforces 3 failure limit", () => {
    expect(CIRCUIT_BREAKER).toContain("3 CONSECUTIVE")
    expect(CIRCUIT_BREAKER).toContain("IMMEDIATELY HALT")
    expect(CIRCUIT_BREAKER).toContain("Do not attempt a 4th")
  })

  it("STRICT_GROUNDING enforces doc-first approach", () => {
    expect(STRICT_GROUNDING).toContain("Do NOT use any parameter")
    expect(STRICT_GROUNDING).toContain("Do not guess")
    expect(STRICT_GROUNDING).toContain("verify the exact")
    expect(STRICT_GROUNDING).toContain("signature from the DOCS")
  })
})

describe("createAllAgents", () => {
  it("creates all 9 agents with DEFAULT_CONFIG", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    const keys = Object.keys(agents)
    expect(keys.length).toBe(9)
  })

  it("returns agents with exact expected keys", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    const keys = Object.keys(agents)
    expect(keys).toContain("Pipeline Orchestrator")
    expect(keys).toContain("docs-researcher")
    expect(keys).toContain("architect")
    expect(keys).toContain("plan-checker")
    expect(keys).toContain("coder")
    expect(keys).toContain("coder-pro")
    expect(keys).toContain("linter")
    expect(keys).toContain("auditor")
    expect(keys).toContain("Advisor")
  })

  it("Pipeline Orchestrator is primary mode", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    expect(agents["Pipeline Orchestrator"].mode).toBe("primary")
    expect(agents["Pipeline Orchestrator"].hidden).toBeFalsy()
  })

  it("all subagents are hidden", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    for (const [key, agent] of Object.entries(agents)) {
      if (key === "Pipeline Orchestrator" || key === "Advisor") continue
      expect(agent.hidden).toBe(true)
    }
  })

  it("all agents have non-empty prompts", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    for (const [key, agent] of Object.entries(agents)) {
      expect(agent.prompt).toBeTruthy()
      expect(typeof agent.prompt).toBe("string")
      expect((agent.prompt as string).length).toBeGreaterThan(100)
    }
  })

  it("all agents have temperature and color set", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    for (const agent of Object.values(agents)) {
      expect(agent.temperature).toBeDefined()
      expect(agent.color).toBeDefined()
    }
  })

  it("all agents have model set", () => {
    const agents = createAllAgents(DEFAULT_CONFIG)
    for (const agent of Object.values(agents)) {
      expect(agent.model).toBeDefined()
      expect(typeof agent.model).toBe("string")
    }
  })

  it("handles null config gracefully", () => {
    expect(() => createAllAgents(null as any)).toThrow()
  })

  it("model assignments propagate correctly", () => {
    const customConfig = {
      ...DEFAULT_CONFIG,
      models: {
        ...DEFAULT_CONFIG.models,
        orchestrator: "custom/model-orch",
        coder: "custom/model-coder",
      },
    }
    const agents = createAllAgents(customConfig)
    expect(agents["Pipeline Orchestrator"].model).toBe("custom/model-orch")
    expect(agents["coder"].model).toBe("custom/model-coder")
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
    expect(prompt).not.toContain("COMPLEX")
    expect(prompt).toContain("STRICT GROUNDING")
    expect(prompt).toContain("LLD ESCAPE HATCH")
    expect(prompt).toContain("CIRCUIT BREAKER")
    expect(prompt).toContain("3 CONSECUTIVE")
  })

  it("coder-pro prompt contains complexity marker", () => {
    const prompt = agents["coder-pro"].prompt as string
    expect(prompt).toContain("COMPLEX")
  })

  it("coder and coder-pro are distinct", () => {
    const coder = agents["coder"].prompt as string
    const coderPro = agents["coder-pro"].prompt as string
    expect(coder).not.toBe(coderPro)
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
      if (key === "Pipeline Orchestrator" || key === "Advisor") continue
      expect((agent.prompt as string)).toContain("Minimize output tokens")
    }
  })

  it("orchestrator does NOT contain NO_FLUFF", () => {
    expect((agents["Pipeline Orchestrator"].prompt as string)).not.toContain("Minimize output tokens")
  })

  it("Advisor does NOT contain NO_FLUFF", () => {
    expect((agents["Advisor"].prompt as string)).not.toContain("Minimize output tokens")
  })

  it("coder and architect contain TECH_STACK_BASELINE", () => {
    expect((agents["coder"].prompt as string)).toContain("TECH_STACK_BASELINE.md")
    expect((agents["architect"].prompt as string)).toContain("TECH_STACK_BASELINE.md")
  })

  it("docs-researcher prompt cites source requirement", () => {
    const prompt = agents["docs-researcher"].prompt as string
    expect(prompt).toContain("Cite sources")
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

  it("docs-researcher has webfetch and websearch allowed", () => {
    const perm = agents["docs-researcher"].permission as any
    expect(perm?.webfetch).toBe("allow")
    expect(perm?.websearch).toBe("allow")
  })

  it("coder has edit allow and bash allow", () => {
    const perm = agents["coder"].permission as any
    expect(perm?.edit).toBe("allow")
    expect(perm?.bash).toBe("allow")
  })

  it("coder has question deny", () => {
    const perm = agents["coder"].permission as any
    expect(perm?.question).toBe("deny")
  })

  it("coder-pro has same permissions as coder", () => {
    const coderPerm = agents["coder"].permission
    const coderProPerm = agents["coder-pro"].permission
    expect(coderProPerm).toEqual(coderPerm)
  })

  it("linter has edit deny and bash deny", () => {
    const perm = agents["linter"].permission as any
    expect(perm?.edit).toBe("deny")
    expect(perm?.bash).toBe("deny")
  })

  it("linter has read/glob/grep allow", () => {
    const perm = agents["linter"].permission as any
    expect(perm?.read).toBe("allow")
    expect(perm?.glob).toBe("allow")
    expect(perm?.grep).toBe("allow")
  })

  it("auditor has edit deny and bash deny", () => {
    const perm = agents["auditor"].permission as any
    expect(perm?.edit).toBe("deny")
    expect(perm?.bash).toBe("deny")
  })

  it("orchestrator task restricts to pipeline subagents only", () => {
    const perm = agents["Pipeline Orchestrator"].permission as any
    const task = perm?.task
    expect(task["*"]).toBe("deny")
    expect(task["coder"]).toBe("allow")
    expect(task["architect"]).toBe("allow")
  })

  it("all subagents have question deny", () => {
    for (const [key, agent] of Object.entries(agents)) {
      if (key === "Pipeline Orchestrator" || key === "Advisor") continue
      const perm = agent.permission as any
      expect(perm?.question).toBe("deny")
    }
  })

  it("all agents have a permission object", () => {
    for (const [key, agent] of Object.entries(agents)) {
      expect(agent.permission).toBeDefined()
      expect(typeof agent.permission).toBe("object")
    }
  })
})

describe("Advisor agent", () => {
  const agents = createAllAgents(DEFAULT_CONFIG)
  const advisor = agents["Advisor"]

  it("is registered as primary agent", () => {
    expect(advisor.mode).toBe("primary")
  })

  it("is not hidden", () => {
    expect(advisor.hidden).toBeFalsy()
  })

  it("has correct color and temperature", () => {
    expect(advisor.color).toBe("#7C3AED")
    expect(advisor.temperature).toBe(0.1)
  })

  it("uses the configured advisor model", () => {
    expect(advisor.model).toBe(DEFAULT_CONFIG.models.advisor)
  })

  it("model is configurable via config", () => {
    const customConfig = {
      ...DEFAULT_CONFIG,
      models: { ...DEFAULT_CONFIG.models, advisor: "custom/advisor-model" },
    }
    const customAgents = createAllAgents(customConfig)
    expect(customAgents["Advisor"].model).toBe("custom/advisor-model")
  })

  it("has question allow", () => {
    const perm = advisor.permission as any
    expect(perm?.question).toBe("allow")
  })

  it("has edit deny and bash deny", () => {
    const perm = advisor.permission as any
    expect(perm?.edit).toBe("deny")
    expect(perm?.bash).toBe("deny")
  })

  it("has webfetch and websearch allow", () => {
    const perm = advisor.permission as any
    expect(perm?.webfetch).toBe("allow")
    expect(perm?.websearch).toBe("allow")
  })

  it("has docs-mcp-server_* allow", () => {
    const perm = advisor.permission as any
    expect(perm?.["docs-mcp-server_*"]).toBe("allow")
  })

  it("has glob and grep allow", () => {
    const perm = advisor.permission as any
    expect(perm?.glob).toBe("allow")
    expect(perm?.grep).toBe("allow")
  })

  it("has read allow", () => {
    const perm = advisor.permission as any
    expect(perm?.read).toBe("allow")
  })

  it("task restricts to docs-researcher and explore only", () => {
    const perm = advisor.permission as any
    const task = perm?.task
    expect(task["*"]).toBe("deny")
    expect(task["docs-researcher"]).toBe("allow")
    expect(task["explore"]).toBe("allow")
    expect(task["coder"]).toBeUndefined()
    expect(task["architect"]).toBeUndefined()
    expect(task["plan-checker"]).toBeUndefined()
  })

  it("prompt contains Advisor role description", () => {
    expect(advisor.prompt).toContain("Advisor")
  })

  it("prompt contains clarifying questions requirement", () => {
    expect(advisor.prompt).toContain("ASK CLARIFYING QUESTIONS")
  })

  it("prompt contains citation requirement", () => {
    expect(advisor.prompt).toContain("CITE SOURCES")
  })

  it("prompt contains reasoning/tradeoffs/alternatives requirement", () => {
    expect(advisor.prompt).toContain("reasoning, tradeoffs, alternatives")
  })

  it("prompt contains TECH_STACK_BASELINE.md reference", () => {
    expect(advisor.prompt).toContain("TECH_STACK_BASELINE.md")
  })

  it("prompt does NOT contain NO_FLUFF", () => {
    expect(advisor.prompt).not.toContain("Minimize output tokens")
  })

  it("prompt contains docs-researcher delegation instruction", () => {
    expect(advisor.prompt).toContain("docs-researcher")
  })
})
