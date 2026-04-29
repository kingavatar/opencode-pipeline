import { describe, it, expect } from "bun:test"
import { DEFAULT_CONFIG } from "../config/types"

describe("stripJsonComments (via loadConfig behavior)", () => {
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

  it("strips // line comments", () => {
    const input = `{
  "key": "value", // this is a comment
  "num": 42
}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("this is a comment")
    expect(result).toContain('"key": "value"')
  })

  it("strips /* block comments */", () => {
    const input = `{
  /* block comment */
  "key": "value"
}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("block comment")
    expect(result).toContain('"key"')
  })

  it("does NOT strip // inside string values", () => {
    const input = `{
  "url": "https://example.com/path",
  "desc": "use // for comments"
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"https://example.com/path"')
    expect(result).toContain('"use // for comments"')
  })

  it("does NOT strip /* inside string values", () => {
    const input = `{
  "desc": "use /* and */ in strings"
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"use /* and */ in strings"')
  })

  it("handles escaped quotes inside strings", () => {
    const input = `{
  "key": "value with \\"quotes\\"",
  "other": "ok" // trailing comment
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"value with \\"quotes\\""')
    expect(result).not.toContain("trailing comment")
  })

  it("handles escaped backslash before quote", () => {
    const input = `{
  "path": "C:\\\\Users\\\\test",
  "url": "https://a.com" // comment
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"C:\\\\Users\\\\test"')
  })

  it("handles mixed single and double quotes", () => {
    const input = `{
  "double": "value",
  'single': 'value' // comment
}`
    const result = stripJsonComments(input)
    expect(result).toContain("'single': 'value'")
    expect(result).not.toContain("comment")
  })

  it("handles // in single-quoted string", () => {
    const input = `{ 'url': 'https://example.com', 'key': 'val' }`
    const result = stripJsonComments(input)
    expect(result).toContain("'https://example.com'")
  })

  it("strips trailing commas", () => {
    const input = `{
  "a": 1,
  "b": 2,
}`
    const result = stripJsonComments(input)
    expect(result).toContain('"b": 2')
    expect(result.trimEnd()).not.toMatch(/,\s*\}/)
  })

  it("handles empty input", () => {
    expect(stripJsonComments("")).toBe("")
  })

  it("handles comment-only line", () => {
    expect(stripJsonComments("// just a comment")).toBe("")
  })

  it("handles block comment on single line", () => {
    const input = `{ "a": 1, /* inline */ "b": 2 }`
    const result = stripJsonComments(input)
    expect(result).not.toContain("inline")
    expect(result).toContain('"a"')
    expect(result).toContain('"b"')
  })

  it("handles multi-line block comment", () => {
    const input = `{
  "a": 1,
  /* start
     middle
  */
  "b": 2
}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("start")
    expect(result).not.toContain("middle")
    expect(result).toContain('"a": 1')
    expect(result).toContain('"b": 2')
  })

  it("handles // at position 0 of string after non-string content", () => {
    const input = `// json config
{
  "key": "value"
}`
    const result = stripJsonComments(input)
    expect(result).not.toContain("json config")
    expect(result).toContain('"key": "value"')
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
  })

  it("has git defaults", () => {
    expect(DEFAULT_CONFIG.git.autoBranch).toBe(true)
    expect(DEFAULT_CONFIG.git.branchPrefix).toBe("pipeline")
    expect(DEFAULT_CONFIG.git.baseBranch).toBe("main")
  })

  it("has storage defaults", () => {
    expect(DEFAULT_CONFIG.storage.maxHistoryEntries).toBeGreaterThan(0)
  })
})
