export function createCompactionHook() {
  return (input: { sessionID?: string }, output: { context: string[] }) => {
    output.context.push(`## Pipeline State (Persist Across Compaction)
Include these in the continuation summary:

- Current pipeline phase and progress (via pipeline_load('STATE.md'))
- Active git branch if pipeline session
- Any locked decisions from this session
- Next step in the pipeline workflow

Do NOT preserve in detail:
- Conversational Q&A (keep only the DECISIONS made)
- Verbose tool outputs (keep only conclusions)
- Plan drafts that were superseded by approved versions
- Raw API documentation dumps

The goal: the next session gets enough context to resume,
not enough to cause context rot.`)
  }
}
