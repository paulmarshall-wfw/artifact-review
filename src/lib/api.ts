export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ReadinessItem = {
  key: string;
  label: string;
  ready: boolean;
  reason?: string;
};

export type ReadinessResponse = {
  ready: boolean;
  checks: ReadinessItem[];
};

export type SetupReadiness = ReadinessResponse;
export type ProviderReadiness = ReadinessResponse;

export type WorkflowState = {
  id: string;
  visible: boolean;
};

export type WorkflowAction = {
  id: string;
  label: string;
  from: string;
  to: string;
  trigger: "user" | "automatic";
  visible: boolean;
};

export type WorkflowBucket = {
  id: string;
  label: string;
  visible: boolean;
  states: string[];
};

export type WorkflowSummary = {
  id: string;
  definitionVersion: string;
  schemaVersion: string;
  states: WorkflowState[];
  buckets: WorkflowBucket[];
  entryStates: string[];
  visibleActions: WorkflowAction[];
};

export type WorkflowStatus = {
  active: boolean;
  workflow: WorkflowSummary | null;
  readiness: ReadinessResponse;
};

export type WorkflowValidationResult =
  | {
      valid: true;
      workflow: WorkflowSummary;
    }
  | {
      valid: false;
      errors: string[];
    };

export type WorkflowActivationResult = {
  active: true;
  workflow: WorkflowSummary;
  initialState: string;
};

export type DocumentSummary = {
  id: string;
  projectId: string | null;
  name: string;
  sourceType: string;
  originalFormat: string;
  currentWorkflowItemRef: string | null;
  ingestedAt: string;
  updatedAt: string;
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  sourceSnapshot: string;
  currentSnapshot: string;
  parserMetadata: JsonValue;
  createdAt: string;
};

export type ReviewComponent = {
  id: string;
  documentId: string;
  kind: string;
  sectionId: string;
  sourceRange: JsonValue;
  currentText: string;
  originalTextHash: string;
  createdAt: string;
  updatedAt: string;
};

export type ComponentRevision = {
  id: string;
  componentId: string;
  previousText: string;
  revisedText: string;
  editSource: string;
  aiSuggestionId: string | null;
  createdAt: string;
};

export type Annotation = {
  id: string;
  componentId: string;
  body: string;
  createdAt: string;
};

export type Question = {
  id: string;
  componentId: string;
  body: string;
  status: string;
  createdAt: string;
};

export type EvidenceKind = "source" | "link" | "repo_path" | "screenshot_path" | "note";

export type EvidenceSource = {
  id: string;
  componentId: string;
  kind: EvidenceKind;
  value: string;
  createdAt: string;
};

export type Highlight = {
  componentId: string;
  enabled: boolean;
  updatedAt: string;
};

export type AiSuggestionStatus = "proposed" | "accepted" | "rejected";

export type AiSuggestion = {
  id: string;
  componentId: string;
  taskRunId: string | null;
  proposedText: string;
  rationale: string;
  confidence: number;
  warnings: JsonValue;
  status: AiSuggestionStatus;
  createdAt: string;
  decidedAt: string | null;
};

export type TaskRun = {
  id: string;
  taskKey: string;
  providerKey: string | null;
  providerProfileKey: string | null;
  promptVersion: string;
  status: string;
  validationStatus: string | null;
  externalSend: boolean;
  latencyMs: number | null;
  provenance: JsonValue;
  createdAt: string;
};

export type AutosaveSnapshot = {
  id: string;
  documentId: string;
  snapshot: JsonValue;
  createdAt: string;
};

export type DocumentDetail = {
  document: DocumentSummary;
  versions: DocumentVersion[];
  components: ReviewComponent[];
  review: {
    annotations: Annotation[];
    questions: Question[];
    evidenceSources: EvidenceSource[];
    highlights: Highlight[];
    aiSuggestions: AiSuggestion[];
  };
};

export type DocumentWorkflowActions = {
  documentId: string;
  currentState: string;
  actions: WorkflowAction[];
};

export type FileIngestRequest = {
  name: string;
  format: "txt" | "md" | "html" | "htm";
  content: string;
};

export type UrlIngestRequest = {
  url: string;
  name?: string;
  snapshotHtml?: string;
};

export type IngestResponse = {
  document: DocumentSummary;
  version: DocumentVersion;
  components: ReviewComponent[];
  workflow: {
    currentState: string;
    actions: WorkflowAction[];
  };
};

export type ComponentEditResponse = {
  component: ReviewComponent;
  revision: ComponentRevision;
  autosave: AutosaveSnapshot;
};

export type ReviewMutationResponse<T> = T & {
  autosave: AutosaveSnapshot;
};

export type SaveDocumentResponse = {
  document: DocumentSummary;
  version: DocumentVersion;
  snapshot: {
    type: "review-state";
    componentCount: number;
    previousVersionNumber: number;
  };
};

export type ExecuteWorkflowActionResponse = {
  document: DocumentSummary;
  transition: {
    actionId: string;
    from: string;
    to: string;
  };
  actions: WorkflowAction[];
};

export type SuggestComponentRevisionResponse = {
  suggestion: AiSuggestion;
  taskRun: TaskRun;
  output: {
    proposedText: string;
    rationale: string;
    confidence: number;
    sourceComponentId: string;
    warnings: string[];
  };
  readiness: ProviderReadiness;
};

const apiBase = import.meta.env.VITE_ARTIFACT_REVIEW_API_BASE ?? "";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? ((await response.json()) as unknown) : await response.text();

  if (!response.ok) {
    throw new Error(readErrorMessage(payload, response.status));
  }

  return payload as T;
}

function readErrorMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const body = payload as { message?: unknown; error?: unknown; errors?: unknown; issues?: unknown };
    if (typeof body.message === "string") {
      return body.message;
    }
    if (Array.isArray(body.errors)) {
      return body.errors.join(" ");
    }
    if (Array.isArray(body.issues)) {
      return body.issues.join(" ");
    }
    if (typeof body.error === "string") {
      return body.error;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return `Request failed with ${status}`;
}

function jsonBody(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body)
  };
}

export async function getSetupReadiness(): Promise<SetupReadiness> {
  return requestJson<SetupReadiness>("/api/setup-readiness");
}

export async function getProviderReadiness(): Promise<ProviderReadiness> {
  return requestJson<ProviderReadiness>("/api/provider-readiness");
}

export async function getProviderReadinessForTask(taskKey: string): Promise<ProviderReadiness & { taskKey: string }> {
  return requestJson<ProviderReadiness & { taskKey: string }>(`/api/provider-readiness/tasks/${encodeURIComponent(taskKey)}`);
}

export async function getWorkflowStatus(): Promise<WorkflowStatus> {
  return requestJson<WorkflowStatus>("/api/workflow/status");
}

export async function validateWorkflowDefinition(definition: unknown): Promise<WorkflowValidationResult> {
  return requestJson<WorkflowValidationResult>("/api/workflow/definitions/validate", {
    method: "POST",
    ...jsonBody(definition)
  });
}

export async function activateWorkflowDefinition(definition: unknown): Promise<WorkflowActivationResult> {
  return requestJson<WorkflowActivationResult>("/api/workflow/activate", {
    method: "POST",
    ...jsonBody(definition)
  });
}

export async function listDocuments(): Promise<{ documents: DocumentSummary[] }> {
  return requestJson<{ documents: DocumentSummary[] }>("/api/documents");
}

export async function getDocumentDetail(documentId: string): Promise<DocumentDetail> {
  return requestJson<DocumentDetail>(`/api/documents/${encodeURIComponent(documentId)}`);
}

export async function getDocumentWorkflowActions(documentId: string): Promise<DocumentWorkflowActions> {
  return requestJson<DocumentWorkflowActions>(`/api/workflow/documents/${encodeURIComponent(documentId)}/actions`);
}

export async function executeWorkflowAction(
  documentId: string,
  actionId: string
): Promise<ExecuteWorkflowActionResponse> {
  return requestJson<ExecuteWorkflowActionResponse>(
    `/api/workflow/documents/${encodeURIComponent(documentId)}/actions/${encodeURIComponent(actionId)}`,
    {
      method: "POST"
    }
  );
}

export async function ingestFile(payload: FileIngestRequest): Promise<IngestResponse> {
  return requestJson<IngestResponse>("/api/ingest/file", {
    method: "POST",
    ...jsonBody(payload)
  });
}

export async function ingestUrl(payload: UrlIngestRequest): Promise<IngestResponse> {
  return requestJson<IngestResponse>("/api/ingest/url", {
    method: "POST",
    ...jsonBody(payload)
  });
}

export async function updateComponentText(componentId: string, currentText: string): Promise<ComponentEditResponse> {
  return requestJson<ComponentEditResponse>(`/api/components/${encodeURIComponent(componentId)}`, {
    method: "PATCH",
    ...jsonBody({ currentText, editSource: "manual" })
  });
}

export async function addAnnotation(
  componentId: string,
  body: string
): Promise<ReviewMutationResponse<{ annotation: Annotation }>> {
  return requestJson<ReviewMutationResponse<{ annotation: Annotation }>>(
    `/api/components/${encodeURIComponent(componentId)}/annotations`,
    {
      method: "POST",
      ...jsonBody({ body })
    }
  );
}

export async function addQuestion(
  componentId: string,
  body: string
): Promise<ReviewMutationResponse<{ question: Question }>> {
  return requestJson<ReviewMutationResponse<{ question: Question }>>(
    `/api/components/${encodeURIComponent(componentId)}/questions`,
    {
      method: "POST",
      ...jsonBody({ body })
    }
  );
}

export async function addEvidence(
  componentId: string,
  kind: EvidenceKind,
  value: string
): Promise<ReviewMutationResponse<{ evidence: EvidenceSource }>> {
  return requestJson<ReviewMutationResponse<{ evidence: EvidenceSource }>>(
    `/api/components/${encodeURIComponent(componentId)}/evidence`,
    {
      method: "POST",
      ...jsonBody({ kind, value })
    }
  );
}

export async function setHighlight(
  componentId: string,
  enabled: boolean
): Promise<ReviewMutationResponse<{ highlight: Highlight }>> {
  return requestJson<ReviewMutationResponse<{ highlight: Highlight }>>(
    `/api/components/${encodeURIComponent(componentId)}/highlight`,
    {
      method: "PATCH",
      ...jsonBody({ enabled })
    }
  );
}

export async function saveDocument(documentId: string): Promise<SaveDocumentResponse> {
  return requestJson<SaveDocumentResponse>(`/api/documents/${encodeURIComponent(documentId)}/save`, {
    method: "POST"
  });
}

export async function suggestComponentRevision(componentId: string): Promise<SuggestComponentRevisionResponse> {
  return requestJson<SuggestComponentRevisionResponse>(
    `/api/components/${encodeURIComponent(componentId)}/ai-suggestions`,
    {
      method: "POST"
    }
  );
}
