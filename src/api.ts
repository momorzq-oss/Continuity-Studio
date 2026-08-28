import type {
  ApprovalState,
  AppSettings,
  BrainMode,
  BrainStatusSnapshot,
  ChangeImpactReport,
  ChangeSourceType,
  CreateProjectInput,
  DiagnosticsSnapshot,
  MovieProject,
  PhaseId,
  ProjectListItem,
  ProductionAssetCategory,
  ReferenceUploadInput,
  RunMode,
} from "./types";

const request = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
};

export const api = {
  listProjects: () => request<ProjectListItem[]>("/api/projects"),
  getProject: (projectId: string) =>
    request<MovieProject>(`/api/projects/${projectId}`),
  changeImpact: (projectId: string, sourceType: ChangeSourceType, sourceId?: string) =>
    request<ChangeImpactReport>(`/api/projects/${projectId}/change-impact`, {
      method: "POST",
      body: JSON.stringify({ sourceType, sourceId }),
    }),
  storyExportUrl: (projectId: string, format: "full" | "structure" | "timeline" | "arcs" | "sequences" | "json") =>
    `/api/projects/${projectId}/story/export?format=${encodeURIComponent(format)}`,
  scriptExportUrl: (projectId: string, format: "full" | "production" | "dialogue" | "shots" | "sequences" | "json") =>
    `/api/projects/${projectId}/script/export?format=${encodeURIComponent(format)}`,
  sequenceReferencePackageUrl: (projectId: string, sequenceId: string, platform: string) =>
    `/api/projects/${projectId}/sequences/${sequenceId}/references?platform=${encodeURIComponent(platform)}`,
  createProject: (input: CreateProjectInput) =>
    request<MovieProject>("/api/projects", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMode: (projectId: string, mode: RunMode) =>
    request<MovieProject>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),
  workflowAction: (projectId: string, action: string, payload: Record<string, unknown> = {}) =>
    request<MovieProject>(`/api/projects/${projectId}/workflow/actions`, {
      method: "POST",
      body: JSON.stringify({ action, payload }),
    }),
  uploadSequenceVideo: async (projectId: string, sequenceId: string, file: File) => {
    const response = await fetch(`/api/projects/${projectId}/sequences/${sequenceId}/video`, {
      method: "POST",
      headers: { "Content-Type": file.type || "video/mp4" },
      body: file,
    });
    const payload = (await response.json().catch(() => ({}))) as MovieProject & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Video upload failed (${response.status}).`);
    return payload;
  },
  updateBrain: (projectId: string, brain: BrainMode) =>
    request<MovieProject>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify({ brain }),
    }),
  updateRule: (projectId: string, ruleId: string, input: { profileId?: string; enabled?: boolean; severity?: "INFO" | "WARNING" | "ERROR" | "BLOCKING"; enforcement?: string; reason?: string }) =>
    request<MovieProject>(`/api/projects/${projectId}/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  updateAssetStatus: (projectId: string, assetId: string, state: ApprovalState, note?: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}`, {
      method: "PATCH",
      body: JSON.stringify({ state, note }),
    }),
  createAssetVersion: (projectId: string, assetId: string, description?: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/versions`, {
      method: "POST",
      body: JSON.stringify({ description }),
    }),
  uploadReference: (projectId: string, input: ReferenceUploadInput) =>
    request<MovieProject>(`/api/projects/${projectId}/references`, { method: "POST", body: JSON.stringify(input) }),
  completeReferenceSetup: (projectId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/reference-setup/complete`, { method: "POST", body: "{}" }),
  updateReference: (projectId: string, referenceId: string, input: { roles?: string[]; storyUsage?: string; priority?: number; sequenceIds?: string[]; label?: string; name?: string }) =>
    request<MovieProject>(`/api/projects/${projectId}/references/${referenceId}`, { method: "PATCH", body: JSON.stringify(input) }),
  replaceReference: (projectId: string, referenceId: string, input: Pick<ReferenceUploadInput, "filename" | "mimeType" | "base64">) =>
    request<MovieProject>(`/api/projects/${projectId}/references/${referenceId}/image`, { method: "PUT", body: JSON.stringify(input) }),
  removeReference: (projectId: string, referenceId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/references/${referenceId}`, { method: "DELETE" }),
  generateReferenceSheet: (projectId: string, referenceId: string, force = false) =>
    request<MovieProject>(`/api/projects/${projectId}/references/${referenceId}/generate-sheet`, { method: "POST", body: JSON.stringify({ force }) }),
  generateAllAssets: (projectId: string, force = false) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/generate-all`, { method: "POST", body: JSON.stringify({ force }) }),
  generateAsset: (projectId: string, assetId: string, force = false, impactMode?: "FUTURE_ONLY" | "APPLY_ALL") =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/generate`, { method: "POST", body: JSON.stringify({ force, impactMode }) }),
  rebuildAssetManifest: (projectId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/rebuild`, { method: "POST", body: "{}" }),
  addAsset: (projectId: string, input: { name: string; category: Exclude<ProductionAssetCategory, "movie_dna" | "character_state">; description: string; storyPurpose?: string; sequenceIds?: string[]; referenceRole?: string; continuityRequirements?: string[] }) =>
    request<{ project: MovieProject; assetId: string }>(`/api/projects/${projectId}/assets`, { method: "POST", body: JSON.stringify(input) }),
  updateManifestAsset: (projectId: string, assetId: string, input: { description?: string; storyPurpose?: string; sequenceIds?: string[]; referenceRoles?: string[]; generationPrompt?: string }) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/manifest`, { method: "PATCH", body: JSON.stringify(input) }),
  decideMissingAsset: (projectId: string, assetId: string, action: "GENERATE" | "UPLOAD" | "IGNORE", reason?: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/missing-decision`, { method: "POST", body: JSON.stringify({ action, reason }) }),
  acceptAssetReplacement: (projectId: string, assetId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/replacement/accept`, { method: "POST", body: "{}" }),
  rejectAssetReplacement: (projectId: string, assetId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/replacement`, { method: "DELETE" }),
  deleteManualAsset: (projectId: string, assetId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/assets/${assetId}/manifest`, { method: "DELETE" }),
  planScenes: (projectId: string) => request<MovieProject>(`/api/projects/${projectId}/scenes/plan`, { method: "POST", body: "{}" }),
  generateAllScenes: (projectId: string, force = false) =>
    request<MovieProject>(`/api/projects/${projectId}/scenes/generate-all`, { method: "POST", body: JSON.stringify({ force }) }),
  generateScene: (projectId: string, sceneId: string, force = false) =>
    request<MovieProject>(`/api/projects/${projectId}/scenes/${sceneId}/generate`, { method: "POST", body: JSON.stringify({ force }) }),
  generateStoryboard: (projectId: string, force = false) =>
    request<MovieProject>(`/api/projects/${projectId}/storyboards/generate`, { method: "POST", body: JSON.stringify({ force }) }),
  compilePrompts: (projectId: string, profileIds?: string[]) =>
    request<MovieProject>(`/api/projects/${projectId}/prompts/compile`, { method: "POST", body: JSON.stringify({ profileIds }) }),
  updateModelProfile: (projectId: string, profileId: string, input: { enabled?: boolean; model?: string; maxDurationSeconds?: number; maxImageReferences?: number; supportsStartFrame?: boolean; supportsEndFrame?: boolean; tagTemplate?: string }) =>
    request<MovieProject>(`/api/projects/${projectId}/model-profiles/${profileId}`, { method: "PATCH", body: JSON.stringify(input) }),
  mediaUrl: (projectId: string, path: string) => `/api/projects/${projectId}/media?path=${encodeURIComponent(path)}`,
  overrideIssue: (projectId: string, issueId: string, reason: string) =>
    request<MovieProject>(`/api/projects/${projectId}/validation-issues/${issueId}/override`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  sendMessage: (projectId: string, content: string, mode: RunMode) =>
    request<MovieProject>(`/api/projects/${projectId}/agent/message`, {
      method: "POST",
      body: JSON.stringify({ content, mode }),
    }),
  approve: (projectId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/agent/approve`, {
      method: "POST",
      body: "{}",
    }),
  regenerate: (projectId: string, phase?: PhaseId, feedback?: string) =>
    request<MovieProject>(`/api/projects/${projectId}/agent/regenerate`, {
      method: "POST",
      body: JSON.stringify({ phase, feedback }),
    }),
  cancel: (projectId: string) =>
    request<MovieProject>(`/api/projects/${projectId}/agent/cancel`, {
      method: "POST",
      body: "{}",
    }),
  recover: (
    projectId: string,
    action: "retry" | "continue_local" | "continue_codex" | "switch_brain" | "cancel",
    brain?: BrainMode,
  ) => request<MovieProject>(`/api/projects/${projectId}/brain/recover`, {
    method: "POST",
    body: JSON.stringify({ action, brain }),
  }),
  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>("/api/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    }),
  brainStatus: () => request<BrainStatusSnapshot>("/api/brains/status"),
  testLocal: () => request<BrainStatusSnapshot["local"]>("/api/brains/local/test", { method: "POST", body: "{}" }),
  testCodex: () => request<BrainStatusSnapshot["codex"]>("/api/brains/codex/test", { method: "POST", body: "{}" }),
  codexModels: () => request<Array<{ id: string; model?: string; displayName?: string; isDefault?: boolean }>>("/api/brains/codex/models"),
  codexLogin: () => request<{ type: string; loginId: string; authUrl?: string; verificationUrl?: string; userCode?: string }>("/api/brains/codex/login", { method: "POST", body: "{}" }),
  codexLogout: () => request<{ ok: boolean }>("/api/brains/codex/logout", { method: "POST", body: "{}" }),
  resolveCodexApproval: (approvalId: string, decision: "allow" | "deny") =>
    request<{ ok: boolean }>(`/api/brains/codex/approvals/${approvalId}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
  diagnostics: (brain?: BrainMode) => request<DiagnosticsSnapshot>(`/api/diagnostics${brain ? `?brain=${brain}` : ""}`),
  exportUrl: (projectId: string) => `/api/projects/${projectId}/export`,
  assetDownloadUrl: (projectId: string, assetId: string) => `/api/projects/${projectId}/assets/${encodeURIComponent(assetId)}/download`,
  assetExportUrl: (projectId: string, scope: "all" | "selected" | "approved" | "locked" = "all", ids: string[] = []) =>
    `/api/projects/${projectId}/assets/export?scope=${scope}${ids.length ? `&ids=${encodeURIComponent(ids.join(","))}` : ""}`,
};
