import { describe, it, expect } from "bun:test"
import { PIPELINE_COMMANDS } from "../commands"

describe("PIPELINE_COMMANDS", () => {
  it("has exactly 4 commands", () => {
    const keys = Object.keys(PIPELINE_COMMANDS)
    expect(keys).toHaveLength(4)
    expect(keys).toContain("pipeline-init")
    expect(keys).toContain("pipeline-resume")
    expect(keys).toContain("pipeline-status")
    expect(keys).toContain("pipeline-help")
  })

  it("every command has description, agent, prompt as non-empty strings", () => {
    for (const [name, cmd] of Object.entries(PIPELINE_COMMANDS)) {
      expect(cmd.description).toBeTruthy()
      expect(typeof cmd.description).toBe("string")
      expect(cmd.agent).toBeTruthy()
      expect(typeof cmd.agent).toBe("string")
      expect(cmd.prompt).toBeTruthy()
      expect(typeof cmd.prompt).toBe("string")
    }
  })

  it("all commands use Pipeline Orchestrator agent", () => {
    for (const [name, cmd] of Object.entries(PIPELINE_COMMANDS)) {
      expect(cmd.agent).toBe("Pipeline Orchestrator")
    }
  })

  it("pipeline-init prompt references Phase 0 and tools", () => {
    const prompt = PIPELINE_COMMANDS["pipeline-init"].prompt
    expect(prompt).toContain("Phase 0")
    expect(prompt).toContain("pipeline_status")
    expect(prompt).toContain("docs-researcher")
  })

  it("pipeline-resume prompt references pipeline_load", () => {
    const prompt = PIPELINE_COMMANDS["pipeline-resume"].prompt
    expect(prompt).toContain("pipeline_load")
  })

  it("pipeline-status prompt references pipeline_status", () => {
    const prompt = PIPELINE_COMMANDS["pipeline-status"].prompt
    expect(prompt).toContain("pipeline_status")
  })

  it("pipeline-help prompt contains workflow overview", () => {
    const prompt = PIPELINE_COMMANDS["pipeline-help"].prompt
    expect(prompt).toContain("8 PHASES")
    expect(prompt).toContain("COMMANDS:")
    expect(prompt).toContain("TOGGLES:")
    expect(prompt).toContain("COST:")
    expect(prompt).toContain("AGENTS:")
    for (let i = 0; i <= 7; i++) {
      expect(prompt).toContain(`${i}.`)
    }
  })

  it("commands do not contain extra unexpected keys", () => {
    for (const [name, cmd] of Object.entries(PIPELINE_COMMANDS)) {
      const keys = Object.keys(cmd)
      expect(keys).toContain("description")
      expect(keys).toContain("agent")
      expect(keys).toContain("prompt")
      expect(keys.length).toBeLessThanOrEqual(3)
    }
  })
})
