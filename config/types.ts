export interface PipelineStorageConfig {
  root: string
  maxHistoryEntries: number
}

export interface PipelineModelConfig {
  advisor: string
  orchestrator: string
  docsResearcher: string
  architect: string
  planChecker: string
  coder: string
  coderPro: string
  linter: string
  auditor: string
}

export interface PipelineWorkflowConfig {
  maxRefineCycles: number
  maxReviewCycles: number
  maxDecisionsPerReview: number
  skipPlanCheck: boolean
  skipAudit: boolean
  skipLinter: boolean
  autoCompact: boolean
  assumptionsMode: boolean
}

export interface PipelineGitConfig {
  autoBranch: boolean
  branchPrefix: string
  autoCleanupBranches: boolean
  baseBranch: string
}

export interface PipelineConfig {
  debug: boolean
  storage: PipelineStorageConfig
  models: PipelineModelConfig
  workflow: PipelineWorkflowConfig
  git: PipelineGitConfig
}

export const DEFAULT_CONFIG: PipelineConfig = {
  debug: false,
  storage: {
    root: "",
    maxHistoryEntries: 50,
  },
  models: {
    advisor: "deepseek-oai/deepseek-v4-pro",
    orchestrator: "deepseek-oai/deepseek-v4-pro",
    docsResearcher: "deepseek-oai/deepseek-v4-flash",
    architect: "deepseek-oai/deepseek-v4-pro",
    planChecker: "deepseek-oai/deepseek-v4-flash",
    coder: "deepseek-oai/deepseek-v4-flash",
    coderPro: "deepseek-oai/deepseek-v4-pro",
    linter: "deepseek-oai/deepseek-v4-flash",
    auditor: "deepseek-oai/deepseek-v4-pro",
  },
  workflow: {
    maxRefineCycles: 2,
    maxReviewCycles: 3,
    maxDecisionsPerReview: 5,
    skipPlanCheck: false,
    skipAudit: false,
    skipLinter: false,
    autoCompact: true,
    assumptionsMode: false,
  },
  git: {
    autoBranch: true,
    branchPrefix: "pipeline",
    autoCleanupBranches: true,
    baseBranch: "main",
  },
}
