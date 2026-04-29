import { describe, it, expect } from "bun:test"
import { DEFAULT_CONFIG } from "../config/types"

function stripJsonComments(raw: string): string {
  const lines = raw.split("\n")
  const out: string[] = []
  let inBlockComment = false

  for (const line of lines) {
    if (inBlockComment) {
      const end = line.indexOf("*/")
      if (end === -1) continue
      inBlockComment = false
      out.push(" ".repeat(end + 2) + line.slice(end + 2))
      continue
    }

    let result = ""
    let inString = false
    let stringChar = ""

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]

      if (!inString) {
        if (ch === "/" && line[i + 1] === "/") break
        if (ch === "/" && line[i + 1] === "*") {
          inBlockComment = true
          const rest = line.slice(i + 2)
          const end = rest.indexOf("*/")
          if (end !== -1) {
            i = i + 2 + end + 1
            inBlockComment = false
            result += " ".repeat(end + 4)
            continue
          }
          break
        }
        if (ch === '"' || ch === "'") {
          inString = true
          stringChar = ch
        }
        result += ch
      } else {
        result += ch
        if (ch === "\\") {
          i++
          if (i < line.length) result += line[i]
          continue
        }
        if (ch === stringChar) {
          inString = false
        }
      }
    }

    out.push(result)
  }

  return out.join("\n").replace(/,\s*([}\]])/g, "$1")
}

describe("stripJsonComments", () => {
  // Basic
  it("strips // line comments", () => {
    const input = `{\n  "key": "value", // comment\n}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("comment")
  })

  it("strips /* block comments */", () => {
    const input = `{\n  /* block */\n  "key": "value"\n}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("block")
  })

  // Strings with comment-like content
  it("does NOT strip // inside string values", () => {
    const input = `{ "url": "https://example.com/path" }`
    const result = stripJsonComments(input)
    expect(result).toContain("https://example.com/path")
  })

  it("does NOT strip /* inside string values", () => {
    const input = `{ "desc": "use /* and */ in strings" }`
    const result = stripJsonComments(input)
    expect(result).toContain("use /* and */ in strings")
  })

  // Escaped quotes
  it("handles escaped quotes inside strings", () => {
    const input = `{ "key": "val \\"quote\\"", "x": 1 }`
    const result = stripJsonComments(input)
    expect(result).toContain('\\"quote\\"')
  })

  it("handles escaped backslash before quote", () => {
    const input = `{ "path": "C:\\\\Users\\\\test" }`
    const result = stripJsonComments(input)
    expect(result).toContain("C:\\\\Users\\\\test")
  })

  // Mixed quotes
  it("handles mixed single and double quotes", () => {
    const input = `{ "d": "v", 's': 'val' // comment\n}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("comment")
    expect(result).toContain("'val'")
  })

  it("handles // in single-quoted string", () => {
    const input = `{ 'url': 'https://example.com' }`
    const result = stripJsonComments(input)
    expect(result).toContain("https://example.com")
  })

  // Trailing commas
  it("strips trailing commas before }", () => {
    const input = `{ "a": 1,\n  "b": 2,\n}`
    const result = stripJsonComments(input)
    expect(result).not.toMatch(/,\s*\}/)
  })

  it("strips trailing commas before ]", () => {
    const input = `{ "arr": [1, 2, 3,] }`
    const result = stripJsonComments(input)
    expect(result).not.toMatch(/,\s*\]/)
  })

  // Empty / edge inputs
  it("handles empty string", () => {
    expect(stripJsonComments("")).toBe("")
  })

  it("handles whitespace-only input", () => {
    const result = stripJsonComments("   \n  \n   ")
    expect(result.trim()).toBe("")
  })

  it("handles comment-only line", () => {
    expect(stripJsonComments("// just a comment")).toBe("")
  })

  it("handles block-comment-only line", () => {
    const result = stripJsonComments("/* nothing */")
    expect(result.trim()).toBe("")
  })

  // Block comments
  it("handles inline block comment", () => {
    const input = `{ "a": 1, /* inline */ "b": 2 }`
    const result = stripJsonComments(input)
    expect(result).not.toContain("inline")
  })

  it("handles multi-line block comment", () => {
    const input = `{\n  /* start\n     middle\n  */\n  "b": 2\n}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("start")
    expect(result).not.toContain("middle")
    expect(result).toContain('"b"')
  })

  it("handles // at position 0", () => {
    const result = stripJsonComments("// top comment\n{ \"k\": \"v\" }")
    expect(result).not.toContain("top comment")
    expect(result).toContain('"k"')
  })

  // Edge cases from real configs
  it("handles a realistic config with comments", () => {
    const input = `{
  // storage settings
  "storage": {
    "maxHistoryEntries": 50  // keep 50 sessions
  },
  /* model assignments */
  "models": {
    "coder": "deepseek-oai/deepseek-v4-flash"
  }
}`
    const result = stripJsonComments(input)
    const parsed = JSON.parse(result)
    expect(parsed.storage.maxHistoryEntries).toBe(50)
    expect(parsed.models.coder).toBe("deepseek-oai/deepseek-v4-flash")
  })

  it("handles unclosed string at EOF gracefully", () => {
    const input = `{ "key": "unclosed`
    const result = stripJsonComments(input)
    expect(result).toContain('"key"')
  })

  it("handles string containing escaped escaped-quote", () => {
    const input = `{ "key": "\\\\\\"value" }`
    const result = stripJsonComments(input)
    expect(result).toContain("value")
  })

  it("handles // not at start of line but mid-code", () => {
    const input = `  "value": 42, // answer\n}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("answer")
  })
})

describe("DEFAULT_CONFIG", () => {
  it("has all 8 model entries", () => {
    const m = DEFAULT_CONFIG.models
    expect(m.orchestrator).toContain("deepseek")
    expect(m.docsResearcher).toContain("flash")
    expect(m.architect).toContain("pro")
    expect(m.planChecker).toContain("flash")
    expect(m.coder).toContain("flash")
    expect(m.coderPro).toContain("pro")
    expect(m.linter).toContain("flash")
    expect(m.auditor).toContain("pro")
  })

  it("has workflow defaults", () => {
    expect(DEFAULT_CONFIG.workflow.maxRefineCycles).toBe(2)
    expect(DEFAULT_CONFIG.workflow.skipPlanCheck).toBe(false)
    expect(DEFAULT_CONFIG.workflow.skipAudit).toBe(false)
    expect(DEFAULT_CONFIG.workflow.skipLinter).toBe(false)
    expect(DEFAULT_CONFIG.workflow.autoCompact).toBe(true)
    expect(DEFAULT_CONFIG.workflow.assumptionsMode).toBe(false)
  })

  it("has git defaults", () => {
    expect(DEFAULT_CONFIG.git.autoBranch).toBe(true)
    expect(DEFAULT_CONFIG.git.branchPrefix).toBe("pipeline")
    expect(DEFAULT_CONFIG.git.baseBranch).toBe("main")
    expect(DEFAULT_CONFIG.git.autoCleanupBranches).toBe(true)
  })

  it("has storage defaults", () => {
    expect(DEFAULT_CONFIG.storage.maxHistoryEntries).toBeGreaterThan(0)
    expect(DEFAULT_CONFIG.storage.root).toBe("")
  })

  it("models object has exactly 8 keys", () => {
    expect(Object.keys(DEFAULT_CONFIG.models).length).toBe(8)
  })

  it("workflow object has exactly 6 keys", () => {
    expect(Object.keys(DEFAULT_CONFIG.workflow).length).toBe(6)
  })

  it("git object has exactly 4 keys", () => {
    expect(Object.keys(DEFAULT_CONFIG.git).length).toBe(4)
  })

  it("storage object has exactly 2 keys", () => {
    expect(Object.keys(DEFAULT_CONFIG.storage).length).toBe(2)
  })
})
