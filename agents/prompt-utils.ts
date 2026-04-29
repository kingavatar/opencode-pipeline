export const NO_FLUFF = `NO-FLUFF INSTRUCTION:
Minimize output tokens. Drop filler (a, an, the, just, really, basically, actually).
No pleasantries (sure, certainly, happy to). No hedging. Fragments ok.
Technical terms stay exact.
CRITICAL EXCEPTION: This applies ONLY to conversational output.
Inside markdown code blocks: write comprehensive JSDoc/docstrings and clear,
descriptive error messages. Do not minify or truncate code.`

export const TECH_STACK_BASELINE_NOTICE = `TECH STACK BASELINE:
When invoking docs-researcher or fetching external information, always include
the tech stack context from .planning/TECH_STACK_BASELINE.md.
This scopes all searches to the correct ecosystem.`

export const CIRCUIT_BREAKER = `CIRCUIT BREAKER:
After writing code, execute the <verify> bash commands from LLD.
If tests fail, you may fix and retry.
After 3 CONSECUTIVE failures of the SAME test: IMMEDIATELY HALT.
Do not attempt a 4th fix. Return the failure log and your analysis
of the root cause to the orchestrator.`

export const LLD_ESCAPE_HATCH = `LLD ESCAPE HATCH:
If LLD is contradictory, impossible, or missing critical info given actual
DOCS and codebase: STOP and return LLD_UPDATE_REQUEST.

Format:
{
  "error_code": "DOC_CONTRADICTION" | "MISSING_API" | "RUNTIME_IMPOSSIBILITY",
  "proof_snippet": "<file:line> direct quote from DOCS or code",
  "proposed_delta": "<specific change>"
}

ONLY these 3 error codes are valid. Style preferences are NOT valid reasons.
The orchestrator will REJECT any request without an exact enum code.
Orchestrator reviews delta, updates LLD, resumes coding.`

export const STRICT_GROUNDING = `STRICT GROUNDING:
For EVERY library call, API usage, or function invocation: verify the exact
signature from the DOCS provided by docs-researcher.
Do NOT use any parameter, return type, or pattern not explicitly documented.
If DOCS lack needed info: invoke docs-researcher for that specific API. Do not guess.`
