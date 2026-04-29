export {
  STORAGE_ROOT,
  STATE_KEYS,
  registerWorkspace,
  getWorkspaceId,
  storeState,
  loadState,
  getLastSessionEntry,
  appendHistory,
  getStatePreview,
} from "./workspace-registry"

export type { StateKey, WorkspaceEntry, Workspaces } from "./workspace-registry"
