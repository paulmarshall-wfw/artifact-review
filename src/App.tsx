import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { StatusPill } from "./components/StatusPill";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import {
  acceptAiSuggestion,
  activateWorkflowDefinition,
  addAnnotation,
  addEvidence,
  addQuestion,
  createProcessingHook,
  deleteProcessingHook,
  executeWorkflowAction,
  exportDocument,
  getDocumentDetail,
  getDocumentWorkflowActions,
  getProviderReadinessForTask,
  getProviderReadiness,
  getRenderSlotActions,
  getSettingsSummary,
  getSetupReadiness,
  getTaskRun,
  getWorkflowStatus,
  ingestFile,
  ingestUrl,
  listDocuments,
  rejectAiSuggestion,
  saveDocument,
  saveDatabaseSettings,
  saveProviderRegistrySettings,
  saveTaskRoute,
  setHighlight,
  suggestComponentRevision,
  updateComponentText,
  validateWorkflowDefinition,
  type AutosaveSnapshot,
  type DocumentDetail,
  type DocumentSummary,
  type DocumentWorkflowActions,
  type EvidenceKind,
  type ExportedFile,
  type DatabaseSettings,
  type ProviderReadiness,
  type ProviderSettings,
  type ProcessingHookSummary,
  type RenderSlotAction,
  type RenderSlotSummary,
  type SettingsSummary,
  type SetupReadiness,
  type TaskRouteSaveRequest,
  type TaskRouteSummary,
  type TaskRun,
  type WorkflowStatus,
  type WorkflowValidationResult
} from "./lib/api";
import { isTauriRuntime, revealExportedFile, selectExportDestination } from "./lib/tauri";

const fixtureDefinition = workflowFixture as unknown;
const suggestComponentRevisionTaskKey = "suggest-component-revision";
const inlineAiSuggestSlot = "component.inline.aiSuggest";
const defaultFileContent =
  "Paste or type text for review. Each sentence becomes a review component. Add enough content to make the workspace useful.";

type PendingKey =
  | "initial"
  | "database-settings"
  | "processing-hook-create"
  | "processing-hook-delete"
  | "workflow-validate"
  | "workflow-activate"
  | "workflow-file-read"
  | "provider-settings"
  | "provider-refresh"
  | "task-route"
  | "file-read"
  | "file-ingest"
  | "url-ingest"
  | "detail"
  | "edit"
  | "annotation"
  | "question"
  | "evidence"
  | "highlight"
  | "ai-suggest"
  | "ai-suggestion-action"
  | "save"
  | "export"
  | "workflow-action";

type AppPage = "review" | "settings";
type SettingsSection = "database" | "workflow" | "provider" | "processing-hooks" | "tasks" | "landing" | "diagnostics" | "ingest";
type ReviewViewMode = "normal" | "focus";
type InlineReviewTab = "text" | "annotations" | "questions" | "evidence" | "ai";

type FileForm = {
  name: string;
  format: "txt" | "md" | "html" | "htm";
  content: string;
};

type UrlForm = {
  url: string;
  name: string;
  snapshotHtml: string;
};

type ReviewNoteForm = {
  annotation: string;
  question: string;
  evidenceKind: EvidenceKind;
  evidenceValue: string;
};

type ProviderSettingsForm = {
  registryUrl: string;
  selectedProviderProfileKey: string;
  demoProviderMode: boolean;
};

type DatabaseSettingsForm = {
  databaseUrl: string;
};

type WorkflowDefinitionSelection = {
  label: string;
  definition: unknown;
  source: "bundled" | "file";
};

type TaskRouteDraft = {
  providerKey: string;
  renderSlot: string;
  hookKey: string;
  displayOrder: string;
  enabled: boolean;
  modelOverride: string;
  displayLabel: string;
  displayDescription: string;
};

type ComponentSection = {
  id: string;
  label: string;
  components: DocumentDetail["components"];
};

type BucketOption = {
  id: string;
  label: string;
  states: string[] | null;
};

type ComponentCounts = {
  annotations: number;
  questions: number;
  evidence: number;
  suggestions: number;
  highlighted: boolean;
};

export function App() {
  const [activePage, setActivePage] = useState<AppPage>("review");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("database");
  const [reviewViewMode, setReviewViewMode] = useState<ReviewViewMode>("normal");
  const [selectedInlineTab, setSelectedInlineTab] = useState<InlineReviewTab>("text");
  const [selectedBucketId, setSelectedBucketId] = useState("all");
  const [documentSearch, setDocumentSearch] = useState("");
  const [setupReadiness, setSetupReadiness] = useState<SetupReadiness | null>(null);
  const [providerReadiness, setProviderReadiness] = useState<ProviderReadiness | null>(null);
  const [suggestionReadiness, setSuggestionReadiness] = useState<(ProviderReadiness & { taskKey: string }) | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [settingsSummary, setSettingsSummary] = useState<SettingsSummary | null>(null);
  const [inlineAiSuggestActions, setInlineAiSuggestActions] = useState<RenderSlotAction[]>([]);
  const [databaseSettingsForm, setDatabaseSettingsForm] = useState<DatabaseSettingsForm>({
    databaseUrl: ""
  });
  const [providerSettingsForm, setProviderSettingsForm] = useState<ProviderSettingsForm>({
    registryUrl: "",
    selectedProviderProfileKey: "",
    demoProviderMode: false
  });
  const [workflowDefinitionSelection, setWorkflowDefinitionSelection] = useState<WorkflowDefinitionSelection>({
    label: "Bundled fixture",
    definition: fixtureDefinition,
    source: "bundled"
  });
  const [newProcessingHookKey, setNewProcessingHookKey] = useState("");
  const [processingHookKeyInFlight, setProcessingHookKeyInFlight] = useState<string | null>(null);
  const [taskRouteDrafts, setTaskRouteDrafts] = useState<Record<string, TaskRouteDraft>>({});
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [workflowValidation, setWorkflowValidation] = useState<WorkflowValidationResult | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [documentActions, setDocumentActions] = useState<DocumentWorkflowActions | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState("");
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => new Set());
  const [componentDrafts, setComponentDrafts] = useState<Record<string, string>>({});
  const [fileForm, setFileForm] = useState<FileForm>({
    name: "Imported review document",
    format: "txt",
    content: defaultFileContent
  });
  const [urlForm, setUrlForm] = useState<UrlForm>({ url: "", name: "", snapshotHtml: "" });
  const [reviewNoteForm, setReviewNoteForm] = useState<ReviewNoteForm>({
    annotation: "",
    question: "",
    evidenceKind: "note",
    evidenceValue: ""
  });
  const [includeReviewBundle, setIncludeReviewBundle] = useState(false);
  const [lastAutosave, setLastAutosave] = useState<AutosaveSnapshot | null>(null);
  const [taskRunsById, setTaskRunsById] = useState<Record<string, TaskRun>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<PendingKey>>(() => new Set());

  const selectedComponent = useMemo(() => {
    if (!documentDetail) {
      return null;
    }
    return (
      documentDetail.components.find((component) => component.id === selectedComponentId) ??
      documentDetail.components[0] ??
      null
    );
  }, [documentDetail, selectedComponentId]);

  const annotationsForComponent = useMemo(
    () =>
      selectedComponent
        ? documentDetail?.review.annotations.filter((annotation) => annotation.componentId === selectedComponent.id) ?? []
        : [],
    [documentDetail, selectedComponent]
  );
  const questionsForComponent = useMemo(
    () =>
      selectedComponent
        ? documentDetail?.review.questions.filter((question) => question.componentId === selectedComponent.id) ?? []
        : [],
    [documentDetail, selectedComponent]
  );
  const evidenceForComponent = useMemo(
    () =>
      selectedComponent
        ? documentDetail?.review.evidenceSources.filter((evidence) => evidence.componentId === selectedComponent.id) ?? []
        : [],
    [documentDetail, selectedComponent]
  );
  const selectedHighlight = useMemo(
    () =>
      selectedComponent
        ? documentDetail?.review.highlights.find((highlight) => highlight.componentId === selectedComponent.id) ?? null
        : null,
    [documentDetail, selectedComponent]
  );
  const suggestionsForComponent = useMemo(
    () =>
      selectedComponent
        ? documentDetail?.review.aiSuggestions.filter((suggestion) => suggestion.componentId === selectedComponent.id) ?? []
        : [],
    [documentDetail, selectedComponent]
  );
  const filteredComponents = useMemo(() => {
    if (!documentDetail) {
      return [];
    }

    const search = componentSearch.trim().toLowerCase();
    if (!search) {
      return documentDetail.components;
    }

    return documentDetail.components.filter((component) =>
      [component.currentText, component.kind, component.sectionId].some((value) => value.toLowerCase().includes(search))
    );
  }, [componentSearch, documentDetail]);
  const componentSections = useMemo<ComponentSection[]>(() => {
    const sections = new Map<string, ComponentSection>();
    for (const component of filteredComponents) {
      const existing = sections.get(component.sectionId);
      if (existing) {
        existing.components.push(component);
      } else {
        sections.set(component.sectionId, {
          id: component.sectionId,
          label: component.sectionId === "root" ? "Root" : component.sectionId,
          components: [component]
        });
      }
    }
    return Array.from(sections.values());
  }, [filteredComponents]);

  const bucketOptions = useMemo<BucketOption[]>(() => {
    const buckets = workflowStatus?.workflow?.buckets.filter((bucket) => bucket.visible) ?? [];
    return [
      { id: "all", label: "All Documents", states: null },
      ...buckets.map((bucket) => ({
        id: bucket.id,
        label: bucket.label,
        states: bucket.states
      }))
    ];
  }, [workflowStatus]);
  const selectedBucket = bucketOptions.find((bucket) => bucket.id === selectedBucketId) ?? bucketOptions[0];
  const filteredDocuments = useMemo(() => {
    const search = documentSearch.trim().toLowerCase();
    return documents.filter((document) => {
      const inBucket =
        !selectedBucket?.states || selectedBucket.states.includes(document.currentWorkflowItemRef ?? "__none__");
      const matchesSearch =
        !search ||
        [document.name, document.originalFormat, document.currentWorkflowItemRef ?? ""].some((value) =>
          value.toLowerCase().includes(search)
        );
      return inBucket && matchesSearch;
    });
  }, [documentSearch, documents, selectedBucket]);
  const bucketCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const bucket of bucketOptions) {
      counts.set(
        bucket.id,
        bucket.states
          ? documents.filter((document) => bucket.states?.includes(document.currentWorkflowItemRef ?? "__none__")).length
          : documents.length
      );
    }
    return counts;
  }, [bucketOptions, documents]);

  const selectedDraftChanged = selectedComponent
    ? (componentDrafts[selectedComponent.id] ?? selectedComponent.currentText) !== selectedComponent.currentText
    : false;
  const latestVersion = documentDetail?.versions.at(-1) ?? null;
  const ingestBlocked = !workflowStatus?.active;
  const suggestionInvocation = suggestionReadiness?.invocation ?? null;
  const suggestionReady = Boolean(suggestionReadiness?.ready);
  const isPending = useCallback((key: PendingKey) => pending.has(key), [pending]);
  const reviewStats = useMemo(
    () =>
      documentDetail
        ? {
            annotations: documentDetail.review.annotations.length,
            questions: documentDetail.review.questions.length,
            evidence: documentDetail.review.evidenceSources.length,
            suggestions: documentDetail.review.aiSuggestions.filter((suggestion) => suggestion.status === "proposed").length,
            highlights: documentDetail.review.highlights.filter((highlight) => highlight.enabled).length
          }
        : { annotations: 0, questions: 0, evidence: 0, suggestions: 0, highlights: 0 },
    [documentDetail]
  );

  const runPending = useCallback(async <T,>(key: PendingKey, action: () => Promise<T>): Promise<T> => {
    setPending((current) => new Set(current).add(key));
    try {
      return await action();
    } finally {
      setPending((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const applySettingsSummary = useCallback((summary: SettingsSummary) => {
    setSettingsSummary(summary);
    setDatabaseSettingsForm({
      databaseUrl: summary.database.saved.databaseUrl ?? summary.database.databaseUrl
    });
    setProviderSettings(summary.providerRegistry);
    setProviderSettingsForm({
      registryUrl: summary.providerRegistry.registryUrl,
      selectedProviderProfileKey: summary.providerRegistry.selectedProviderProfileKey,
      demoProviderMode: summary.providerRegistry.demoProviderMode
    });
    setWorkflowStatus(summary.workflow);
    setSetupReadiness(summary.readiness);
    setTaskRouteDrafts((current) => {
      const next: Record<string, TaskRouteDraft> = {};
      for (const route of summary.taskRoutes) {
        next[route.taskKey] = current[route.taskKey] ?? taskRouteToDraft(route);
      }
      return next;
    });
  }, []);

  const refreshGlobal = useCallback(async () => {
    const [setup, provider, suggestionProvider, settings, aiSuggestActions, workflow, documentList] = await Promise.all([
      getSetupReadiness(),
      getProviderReadiness(),
      getProviderReadinessForTask(suggestComponentRevisionTaskKey),
      getSettingsSummary(),
      getRenderSlotActions(inlineAiSuggestSlot),
      getWorkflowStatus(),
      listDocuments()
    ]);
    setSetupReadiness(setup);
    setProviderReadiness(provider);
    setSuggestionReadiness(suggestionProvider);
    setInlineAiSuggestActions(aiSuggestActions.actions);
    applySettingsSummary(settings);
    setWorkflowStatus(workflow);
    setDocuments(documentList.documents);
    setSelectedDocumentId((current) => current ?? documentList.documents[0]?.id ?? null);
  }, [applySettingsSummary]);

  const refreshDetail = useCallback(async (documentId: string) => {
    const [detail, actions] = await Promise.all([
      getDocumentDetail(documentId),
      getDocumentWorkflowActions(documentId).catch(() => null)
    ]);
    const taskRunIds = Array.from(
      new Set(detail.review.aiSuggestions.map((suggestion) => suggestion.taskRunId).filter(isString))
    );
    const taskRunEntries = await Promise.all(
      taskRunIds.map(async (taskRunId) => {
        try {
          const response = await getTaskRun(taskRunId);
          return [taskRunId, response.taskRun] as const;
        } catch {
          return null;
        }
      })
    );
    setDocumentDetail(detail);
    setDocumentActions(actions);
    setTaskRunsById(Object.fromEntries(taskRunEntries.filter(isTaskRunEntry)));
    setSelectedComponentId((current) => {
      const currentExists = detail.components.some((component) => component.id === current);
      return currentExists ? current : detail.components[0]?.id ?? null;
    });
    setComponentDrafts((current) => {
      const next: Record<string, string> = {};
      for (const component of detail.components) {
        next[component.id] = current[component.id] ?? component.currentText;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!documentDetail) {
      setExpandedSectionIds(new Set());
      return;
    }

    const sectionIds = new Set(documentDetail.components.map((component) => component.sectionId));
    setExpandedSectionIds((current) => {
      const next = new Set(Array.from(current).filter((id) => sectionIds.has(id)));
      return next.size > 0 ? next : sectionIds;
    });
  }, [documentDetail]);

  useEffect(() => {
    if (!bucketOptions.some((bucket) => bucket.id === selectedBucketId)) {
      setSelectedBucketId("all");
    }
  }, [bucketOptions, selectedBucketId]);

  useEffect(() => {
    runPending("initial", refreshGlobal).catch((unknownError: unknown) => {
      setError(unknownError instanceof Error ? unknownError.message : "Unable to load workspace.");
    });
  }, [refreshGlobal, runPending]);

  useEffect(() => {
    if (!selectedDocumentId) {
      setDocumentDetail(null);
      setDocumentActions(null);
      return;
    }

    runPending("detail", () => refreshDetail(selectedDocumentId)).catch((unknownError: unknown) => {
      setError(unknownError instanceof Error ? unknownError.message : "Unable to load document detail.");
    });
  }, [refreshDetail, runPending, selectedDocumentId]);

  async function handleValidateWorkflow() {
    setError(null);
    setNotice(null);
    const validation = await runPending("workflow-validate", () =>
      validateWorkflowDefinition(workflowDefinitionSelection.definition)
    );
    setWorkflowValidation(validation);
    setNotice(
      validation.valid
        ? `${workflowDefinitionSelection.label} validated.`
        : `${workflowDefinitionSelection.label} needs changes before activation.`
    );
  }

  async function handleActivateWorkflow() {
    setError(null);
    setNotice(null);
    await runPending("workflow-activate", () => activateWorkflowDefinition(workflowDefinitionSelection.definition));
    setWorkflowValidation(null);
    await refreshGlobal();
    setNotice(`${workflowDefinitionSelection.label} is active. Ingest is now available.`);
  }

  async function handleSelectedWorkflowFile(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setNotice(null);
    const content = await runPending("workflow-file-read", () => file.text());
    const definition = JSON.parse(content) as unknown;
    setWorkflowDefinitionSelection({
      label: file.name,
      definition,
      source: "file"
    });
    setWorkflowValidation(null);
    setNotice(`Selected workflow definition ${file.name}.`);
  }

  async function handleUseBundledWorkflow() {
    setError(null);
    setNotice(null);
    setWorkflowDefinitionSelection({
      label: "Bundled fixture",
      definition: fixtureDefinition,
      source: "bundled"
    });
    setWorkflowValidation(null);
    setNotice("Selected bundled workflow fixture.");
  }

  async function handleSaveDatabaseSettings() {
    setError(null);
    setNotice(null);
    const summary = await runPending("database-settings", () =>
      saveDatabaseSettings({
        databaseUrl: databaseSettingsForm.databaseUrl.trim() || null
      })
    );
    applySettingsSummary(summary);
    setNotice(
      summary.database.restartRequired
        ? "Database URL saved. Restart Artifact Review to apply it."
        : "Database URL saved and active."
    );
  }

  async function handleCreateProcessingHook() {
    setError(null);
    setNotice(null);
    const hookKey = newProcessingHookKey.trim();
    const response = await runPending("processing-hook-create", () => createProcessingHook(hookKey));
    applySettingsSummary(response.summary);
    setNewProcessingHookKey("");
    setNotice(`Processing hook ${response.processingHook.hookKey} created.`);
  }

  async function handleDeleteProcessingHook(hook: ProcessingHookSummary) {
    setError(null);
    setNotice(null);
    setProcessingHookKeyInFlight(hook.hookKey);
    try {
      const response = await runPending("processing-hook-delete", () => deleteProcessingHook(hook.hookKey));
      applySettingsSummary(response.summary);
      setNotice(`Processing hook ${response.hookKey} deleted.`);
    } finally {
      setProcessingHookKeyInFlight(null);
    }
  }

  async function handleSaveProviderSettings() {
    setError(null);
    setNotice(null);
    const summary = await runPending("provider-settings", () =>
      saveProviderRegistrySettings({
        registryUrl: providerSettingsForm.registryUrl.trim() || null,
        selectedProviderProfileKey: providerSettingsForm.selectedProviderProfileKey.trim() || null,
        demoProviderMode: providerSettingsForm.demoProviderMode
      })
    );
    applySettingsSummary(summary);
    setProviderReadiness(await getProviderReadiness());
    setSuggestionReadiness(await getProviderReadinessForTask(suggestComponentRevisionTaskKey));
    setInlineAiSuggestActions((await getRenderSlotActions(inlineAiSuggestSlot)).actions);
    await refreshGlobal();
    setNotice("Provider settings saved.");
  }

  async function handleRefreshProviders() {
    setError(null);
    setNotice(null);
    await runPending("provider-refresh", refreshGlobal);
    setNotice("Provider readiness refreshed.");
  }

  async function handleSaveTaskRoute(taskKey: string) {
    const draft = taskRouteDrafts[taskKey];
    if (!draft) {
      return;
    }

    setError(null);
    setNotice(null);
    const payload: TaskRouteSaveRequest = {
      providerKey: draft.providerKey.trim() || null,
      renderSlot: draft.renderSlot.trim(),
      hookKey: draft.hookKey.trim(),
      displayOrder: Number(draft.displayOrder || 0),
      enabled: draft.enabled,
      modelOverride: draft.modelOverride.trim() || null,
      displayLabel: draft.displayLabel.trim() || null,
      displayDescription: draft.displayDescription.trim() || null
    };
    await runPending("task-route", () => saveTaskRoute(taskKey, payload));
    await refreshGlobal();
    setNotice(`Saved route for ${taskKey}.`);
  }

  async function handleFileIngest() {
    setError(null);
    setNotice(null);
    const response = await runPending("file-ingest", () =>
      ingestFile({
        name: fileForm.name.trim(),
        format: fileForm.format,
        content: fileForm.content
      })
    );
    await refreshGlobal();
    setSelectedDocumentId(response.document.id);
    setActivePage("review");
    setDocumentActions({
      documentId: response.document.id,
      currentState: response.workflow.currentState,
      actions: response.workflow.actions
    });
    setNotice(`Ingested ${response.document.name}.`);
  }

  async function handleSelectedFile(file: File | null) {
    if (!file) {
      return;
    }

    setError(null);
    setNotice(null);
    const content = await runPending("file-read", () => file.text());
    setFileForm({
      name: file.name,
      format: formatFromFileName(file.name),
      content
    });
    setNotice(`Loaded ${file.name} for ingest.`);
  }

  async function handleUrlIngest() {
    setError(null);
    setNotice(null);
    const response = await runPending("url-ingest", () =>
      ingestUrl({
        url: urlForm.url.trim(),
        name: urlForm.name.trim() || undefined,
        snapshotHtml: urlForm.snapshotHtml.trim() || undefined
      })
    );
    await refreshGlobal();
    setSelectedDocumentId(response.document.id);
    setActivePage("review");
    setDocumentActions({
      documentId: response.document.id,
      currentState: response.workflow.currentState,
      actions: response.workflow.actions
    });
    setNotice(`Ingested ${response.document.name}.`);
  }

  async function handleComponentEdit() {
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    setError(null);
    const currentText = componentDrafts[selectedComponent.id]?.trim() ?? "";
    const response = await runPending("edit", () => updateComponentText(selectedComponent.id, currentText));
    setLastAutosave(response.autosave);
    await refreshDetail(selectedDocumentId);
    setNotice("Component saved and autosaved.");
  }

  async function handleAddAnnotation() {
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("annotation", () => addAnnotation(selectedComponent.id, reviewNoteForm.annotation));
    setLastAutosave(response.autosave);
    setReviewNoteForm((current) => ({ ...current, annotation: "" }));
    await refreshDetail(selectedDocumentId);
    setNotice("Annotation added.");
  }

  async function handleAddQuestion() {
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("question", () => addQuestion(selectedComponent.id, reviewNoteForm.question));
    setLastAutosave(response.autosave);
    setReviewNoteForm((current) => ({ ...current, question: "" }));
    await refreshDetail(selectedDocumentId);
    setNotice("Question added.");
  }

  async function handleAddEvidence() {
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("evidence", () =>
      addEvidence(selectedComponent.id, reviewNoteForm.evidenceKind, reviewNoteForm.evidenceValue)
    );
    setLastAutosave(response.autosave);
    setReviewNoteForm((current) => ({ ...current, evidenceValue: "" }));
    await refreshDetail(selectedDocumentId);
    setNotice("Evidence added.");
  }

  async function handleToggleComponentHighlight(componentId: string, enabled: boolean) {
    if (!selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("highlight", () => setHighlight(componentId, enabled));
    setLastAutosave(response.autosave);
    await refreshDetail(selectedDocumentId);
    setNotice(response.highlight.enabled ? "Highlight enabled." : "Highlight disabled.");
  }

  async function handleSaveDocument() {
    if (!selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("save", () => saveDocument(selectedDocumentId));
    await refreshDetail(selectedDocumentId);
    await refreshGlobal();
    setNotice(`Saved version ${response.version.versionNumber}.`);
  }

  async function handleExportDocument() {
    if (!selectedDocumentId || !documentDetail) {
      return;
    }

    setError(null);
    setNotice(null);

    let destinationPath: string | null = null;
    if (isTauriRuntime()) {
      destinationPath = await selectExportDestination(buildExportFileName(documentDetail.document));
      if (!destinationPath) {
        setNotice("Export canceled.");
        return;
      }
    }

    const response = await runPending("export", () =>
      exportDocument(selectedDocumentId, {
        destinationPath: destinationPath ?? undefined,
        includeReviewBundle
      })
    );

    if (response.written) {
      if (response.export.path) {
        await revealExportedFile(response.export.path);
      }
      setNotice(
        response.reviewBundle?.path
          ? `Exported ${response.export.fileName} and review bundle.`
          : `Exported ${response.export.fileName}.`
      );
      return;
    }

    downloadExportedFile(response.export);
    if (response.reviewBundle) {
      downloadExportedFile(response.reviewBundle);
    }
    setNotice(
      response.reviewBundle
        ? `Downloaded ${response.export.fileName} and review bundle.`
        : `Downloaded ${response.export.fileName}.`
    );
  }

  async function handleSuggestComponentRevision() {
    if (!selectedComponent || !selectedDocumentId || !aiSuggestAction) {
      return;
    }

    setError(null);
    const response = await runPending("ai-suggest", () => suggestComponentRevision(selectedComponent.id, aiSuggestAction.taskKey));
    setSuggestionReadiness({ ...response.readiness, taskKey: aiSuggestAction.taskKey });
    setTaskRunsById((current) => ({ ...current, [response.taskRun.id]: response.taskRun }));
    await refreshDetail(selectedDocumentId);
    setSelectedInlineTab("ai");
    setNotice(`Stored proposed suggestion ${response.suggestion.id}.`);
  }

  async function handleAcceptSuggestion(suggestionId: string) {
    if (!selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("ai-suggestion-action", () => acceptAiSuggestion(suggestionId));
    setLastAutosave(response.autosave);
    await refreshDetail(selectedDocumentId);
    setComponentDrafts((current) => ({
      ...current,
      [response.component.id]: response.component.currentText
    }));
    setNotice(`Accepted suggestion ${response.suggestion.id}.`);
  }

  async function handleRejectSuggestion(suggestionId: string) {
    if (!selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("ai-suggestion-action", () => rejectAiSuggestion(suggestionId));
    setLastAutosave(response.autosave);
    await refreshDetail(selectedDocumentId);
    setNotice(`Rejected suggestion ${response.suggestion.id}.`);
  }

  async function handleWorkflowAction(actionId: string) {
    if (!selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("workflow-action", () => executeWorkflowAction(selectedDocumentId, actionId));
    setDocumentActions({
      documentId: selectedDocumentId,
      currentState: response.transition.to,
      actions: response.actions
    });
    await refreshDetail(selectedDocumentId);
    await refreshGlobal();
    setNotice(`Moved document to ${response.transition.to}.`);
  }

  function handleSelectComponent(componentId: string, tab: InlineReviewTab = selectedInlineTab) {
    setSelectedComponentId(componentId);
    setSelectedInlineTab(tab);
    setReviewViewMode("normal");
  }

  function toggleSection(sectionId: string) {
    setExpandedSectionIds((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function focusSelectedComponent() {
    if (!selectedComponent) {
      return;
    }

    setComponentSearch("");
    setExpandedSectionIds(new Set([selectedComponent.sectionId]));
  }

  function expandAllSections() {
    setExpandedSectionIds(new Set(componentSections.map((section) => section.id)));
  }

  function collapseAllSections() {
    setExpandedSectionIds(new Set());
  }

  function getComponentCounts(componentId: string): ComponentCounts {
    return {
      annotations: documentDetail?.review.annotations.filter((item) => item.componentId === componentId).length ?? 0,
      questions: documentDetail?.review.questions.filter((item) => item.componentId === componentId).length ?? 0,
      evidence: documentDetail?.review.evidenceSources.filter((item) => item.componentId === componentId).length ?? 0,
      suggestions:
        documentDetail?.review.aiSuggestions.filter(
          (item) => item.componentId === componentId && item.status === "proposed"
        ).length ?? 0,
      highlighted: Boolean(documentDetail?.review.highlights.find((item) => item.componentId === componentId)?.enabled)
    };
  }

  function reportActionError(action: () => Promise<unknown>) {
    action().catch((unknownError: unknown) => {
      setError(unknownError instanceof Error ? unknownError.message : "Action failed.");
    });
  }

  const aiSuggestAction =
    inlineAiSuggestActions.find((action) => action.taskKey === suggestComponentRevisionTaskKey) ??
    inlineAiSuggestActions[0] ??
    null;
  const pageName = activePage === "review" ? "Document Review" : "Settings";

  return (
    <div className={`app-shell ${activePage === "review" ? "review-page-shell" : "settings-page-shell"} ${reviewViewMode === "focus" ? "focus-mode" : ""}`}>
      <header className="primary-nav">
        <div className="primary-nav-left">
          <div className="brand-block">
            <span className="brand">Artifact Review</span>
            <span className="version">v0.1.0</span>
            <button className="icon-button" aria-label="Toggle theme" title="Toggle theme">
              ◐
            </button>
          </div>
          <nav className="nav-tabs" aria-label="Primary">
            <button
              className={activePage === "review" ? "nav-tab active" : "nav-tab"}
              type="button"
              onClick={() => setActivePage("review")}
            >
              Document Review
            </button>
            <button
              className={activePage === "settings" ? "nav-tab active" : "nav-tab"}
              type="button"
              onClick={() => setActivePage("settings")}
            >
              Settings
            </button>
          </nav>
        </div>
        <div className="primary-nav-right">
          <StatusPill
            item={{
              key: "workflow",
              label: "Workflow",
              ready: Boolean(workflowStatus?.active),
              reason: workflowStatus?.active ? undefined : "Activate the document workflow before ingest."
            }}
          />
          <button className="btn btn-ghost" type="button" onClick={() => reportActionError(refreshGlobal)} disabled={isPending("initial")}>
            {isPending("initial") ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </header>

      <div className="page-title-row">
        <div>
          <div className="page-label">Current page</div>
          <h1>{pageName}</h1>
        </div>
        <StatusMessage error={error} notice={notice} lastAutosave={lastAutosave} />
      </div>

      {activePage === "review" ? (
        <>
          <aside className="review-sidebar">
            <section className="review-process" aria-label="Review process">
              <div className="sidebar-label">Review Process</div>
              <div className="bucket-list">
                {bucketOptions.map((bucket) => (
                  <button
                    className={bucket.id === selectedBucketId ? "bucket-item active" : "bucket-item"}
                    key={bucket.id}
                    type="button"
                    onClick={() => setSelectedBucketId(bucket.id)}
                  >
                    <span>{bucket.label}</span>
                    <span className="bucket-count">{bucketCounts.get(bucket.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="doc-list-area" aria-label="Documents">
              <div className="doc-list-header">
                <span className="sidebar-label">Documents</span>
                <span className="doc-count">{filteredDocuments.length}</span>
              </div>
              <label className="doc-search">
                <span className="visually-hidden">Filter documents</span>
                <input
                  value={documentSearch}
                  placeholder="Filter documents"
                  onChange={(event) => setDocumentSearch(event.target.value)}
                />
              </label>
              <div className="doc-list-scroll">
                {filteredDocuments.length === 0 ? <p className="muted compact">No documents match this view.</p> : null}
                {filteredDocuments.map((document) => (
                  <button
                    className={document.id === selectedDocumentId ? "doc-item active" : "doc-item"}
                    key={document.id}
                    type="button"
                    onClick={() => setSelectedDocumentId(document.id)}
                  >
                    <span className="doc-item-title">{document.name}</span>
                    <span className="doc-item-meta">
                      {document.originalFormat} · {document.currentWorkflowItemRef ?? "No workflow state"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <main className="review-canvas">
            {!workflowStatus?.active ? (
              <section className="compact-blocker">
                <strong>Workflow is inactive.</strong>
                <span>Review can continue for existing documents, but ingest is handled from Settings after activation.</span>
                <button className="btn btn-secondary" type="button" onClick={() => setActivePage("settings")}>
                  Open Settings
                </button>
              </section>
            ) : null}

            <section className="doc-toolbar" aria-label="Document toolbar">
              <div className="doc-title-area">
                <h2 className="doc-title">{documentDetail?.document.name ?? "No document selected"}</h2>
                <span className="state-chip">{documentActions?.currentState ?? documentDetail?.document.currentWorkflowItemRef ?? "No state"}</span>
              </div>
              <div className="toolbar-group">
                <div className="view-toggle" aria-label="Review view mode">
                  <button
                    className={reviewViewMode === "normal" ? "view-toggle-btn active" : "view-toggle-btn"}
                    type="button"
                    onClick={() => setReviewViewMode("normal")}
                  >
                    Normal
                  </button>
                  <button
                    className={reviewViewMode === "focus" ? "view-toggle-btn active" : "view-toggle-btn"}
                    type="button"
                    onClick={() => setReviewViewMode("focus")}
                  >
                    Focus
                  </button>
                </div>
                {documentActions?.actions.map((action) => (
                  <button
                    className="btn btn-secondary"
                    disabled={isPending("workflow-action")}
                    key={action.id}
                    type="button"
                    onClick={() => reportActionError(() => handleWorkflowAction(action.id))}
                  >
                    {action.label}
                  </button>
                ))}
                <button
                  className="btn btn-secondary"
                  disabled={!selectedDocumentId || isPending("save")}
                  type="button"
                  onClick={() => reportActionError(handleSaveDocument)}
                >
                  {isPending("save") ? "Saving" : "Save"}
                </button>
                <label className="inline-check">
                  <input
                    checked={includeReviewBundle}
                    type="checkbox"
                    onChange={(event) => setIncludeReviewBundle(event.target.checked)}
                  />
                  JSON bundle
                </label>
                <button
                  className="btn btn-primary"
                  disabled={!selectedDocumentId || isPending("export")}
                  type="button"
                  onClick={() => reportActionError(handleExportDocument)}
                >
                  {isPending("export") ? "Exporting" : "Export"}
                </button>
              </div>
            </section>

            {reviewViewMode === "normal" ? (
              <section className="doc-stats-bar" aria-label="Document review stats">
                <label className="component-search">
                  <span className="visually-hidden">Search components</span>
                  <input
                    placeholder="Search components"
                    value={componentSearch}
                    onChange={(event) => setComponentSearch(event.target.value)}
                  />
                </label>
                <StatItem tone="blue" label={`${reviewStats.annotations} annotations`} />
                <StatItem tone="amber" label={`${reviewStats.questions} questions`} />
                <StatItem tone="green" label={`${reviewStats.evidence} evidence`} />
                <StatItem tone="purple" label={`${reviewStats.suggestions} AI proposals`} />
                <StatItem tone="gold" label={`${reviewStats.highlights} highlighted`} />
                <span className="stats-tail">
                  {documentDetail ? `${documentDetail.components.length} components · v${latestVersion?.versionNumber ?? 0}` : "No document"}
                </span>
              </section>
            ) : null}

            <section className="doc-scroll" aria-label="Document content">
              {!documentDetail && isPending("detail") ? <div className="empty-state">Loading document detail.</div> : null}
              {!documentDetail && !isPending("detail") ? <div className="empty-state">Select or ingest a document to start review.</div> : null}
              {componentSections.map((section) => {
                const expanded = expandedSectionIds.has(section.id) || Boolean(componentSearch.trim()) || reviewViewMode === "focus";
                return (
                  <section className="document-section" key={section.id}>
                    <button
                      className="doc-section-header"
                      disabled={reviewViewMode === "focus"}
                      type="button"
                      onClick={() => toggleSection(section.id)}
                    >
                      <span className="section-name">{section.label}</span>
                      <span className="section-line"></span>
                      <span className="section-count">{section.components.length} components</span>
                    </button>
                    {expanded ? (
                      <div className="component-stack">
                        {section.components.map((component) => {
                          const counts = getComponentCounts(component.id);
                          const isSelected = component.id === selectedComponent?.id;
                          return (
                            <article
                              className={[
                                "component",
                                isSelected ? "active" : "",
                                counts.highlighted ? "highlighted" : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              key={component.id}
                            >
                              <button
                                className="component-select"
                                type="button"
                                onClick={() => handleSelectComponent(component.id, selectedInlineTab)}
                              >
                                <span className="component-body">{component.currentText}</span>
                              </button>
                              {reviewViewMode === "normal" ? (
                                <>
                                  <ComponentIndicators
                                    counts={counts}
                                    onSelect={(tab) => handleSelectComponent(component.id, tab)}
                                  />
                                  <div className="component-gutter" aria-label="Component actions">
                                    <button
                                      className="gutter-btn"
                                      disabled={isPending("highlight")}
                                      title={counts.highlighted ? "Remove highlight" : "Highlight"}
                                      type="button"
                                      onClick={() =>
                                        reportActionError(() => handleToggleComponentHighlight(component.id, !counts.highlighted))
                                      }
                                    >
                                      {counts.highlighted ? "★" : "☆"}
                                    </button>
                                    <button
                                      className="gutter-btn"
                                      title="Edit text"
                                      type="button"
                                      onClick={() => handleSelectComponent(component.id, "text")}
                                    >
                                      T
                                    </button>
                                    <button
                                      className="gutter-btn"
                                      title="Annotations"
                                      type="button"
                                      onClick={() => handleSelectComponent(component.id, "annotations")}
                                    >
                                      A
                                    </button>
                                    <button
                                      className="gutter-btn"
                                      title="Questions"
                                      type="button"
                                      onClick={() => handleSelectComponent(component.id, "questions")}
                                    >
                                      ?
                                    </button>
                                    <button
                                      className="gutter-btn"
                                      title="AI suggestions"
                                      type="button"
                                      onClick={() => handleSelectComponent(component.id, "ai")}
                                    >
                                      AI
                                    </button>
                                  </div>
                                </>
                              ) : null}
                              {reviewViewMode === "normal" && isSelected ? (
                                <InlineReviewPanel
                                  activeTab={selectedInlineTab}
                                  annotations={annotationsForComponent}
                                  component={selectedComponent}
                                  componentDrafts={componentDrafts}
                                  evidence={evidenceForComponent}
                                  isPending={isPending}
                                  onAcceptSuggestion={handleAcceptSuggestion}
                                  onAddAnnotation={handleAddAnnotation}
                                  onAddEvidence={handleAddEvidence}
                                  onAddQuestion={handleAddQuestion}
                                  onChangeDraft={(value) =>
                                    setComponentDrafts((current) => ({ ...current, [component.id]: value }))
                                  }
                                  onChangeEvidenceKind={(value) =>
                                    setReviewNoteForm((current) => ({ ...current, evidenceKind: value }))
                                  }
                                  onChangeEvidenceValue={(value) =>
                                    setReviewNoteForm((current) => ({ ...current, evidenceValue: value }))
                                  }
                                  onChangeAnnotation={(value) =>
                                    setReviewNoteForm((current) => ({ ...current, annotation: value }))
                                  }
                                  onChangeQuestion={(value) =>
                                    setReviewNoteForm((current) => ({ ...current, question: value }))
                                  }
                                  onRejectSuggestion={handleRejectSuggestion}
                                  onSaveText={handleComponentEdit}
                                  onSuggest={handleSuggestComponentRevision}
                                  onTabChange={setSelectedInlineTab}
                                  questions={questionsForComponent}
                                  reportActionError={reportActionError}
                                  reviewNoteForm={reviewNoteForm}
                                  selectedDraftChanged={selectedDraftChanged}
                                  suggestionInvocation={suggestionInvocation}
                                  suggestionAction={aiSuggestAction}
                                  suggestionReadiness={suggestionReadiness}
                                  suggestionReady={suggestionReady}
                                  suggestions={suggestionsForComponent}
                                  taskRunsById={taskRunsById}
                                />
                              ) : null}
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </section>
                );
              })}
              {documentDetail && filteredComponents.length === 0 ? (
                <div className="empty-state">No components match the current search.</div>
              ) : null}
            </section>

            <footer className="canvas-footer">
              <div className="footer-left">
                <span className="footer-dot"></span>
                <span>{lastAutosave ? `Autosaved ${formatDateTime(lastAutosave.createdAt)}` : "No autosave in this session"}</span>
              </div>
              <div className="footer-actions">
                <button className="btn btn-ghost" type="button" disabled={!selectedComponent} onClick={focusSelectedComponent}>
                  Find selected
                </button>
                <button className="btn btn-ghost" type="button" disabled={componentSections.length === 0} onClick={expandAllSections}>
                  Expand
                </button>
                <button className="btn btn-ghost" type="button" disabled={componentSections.length === 0} onClick={collapseAllSections}>
                  Collapse
                </button>
              </div>
            </footer>
          </main>
        </>
      ) : (
        <SettingsWorkspace
          databaseSettings={settingsSummary?.database ?? null}
          databaseSettingsForm={databaseSettingsForm}
          fileForm={fileForm}
          ingestBlocked={ingestBlocked}
          isPending={isPending}
          onActivateWorkflow={handleActivateWorkflow}
          onChangeDatabaseSettingsForm={setDatabaseSettingsForm}
          onChangeFileForm={setFileForm}
          onChangeNewProcessingHookKey={setNewProcessingHookKey}
          onChangeProviderSettingsForm={setProviderSettingsForm}
          onChangeSection={setSettingsSection}
          onChangeTaskRouteDrafts={setTaskRouteDrafts}
          onChangeUrlForm={setUrlForm}
          onFileIngest={handleFileIngest}
          onProviderRefresh={handleRefreshProviders}
          onCreateProcessingHook={handleCreateProcessingHook}
          onDeleteProcessingHook={handleDeleteProcessingHook}
          onSaveDatabaseSettings={handleSaveDatabaseSettings}
          onSaveProviderSettings={handleSaveProviderSettings}
          onSaveTaskRoute={handleSaveTaskRoute}
          onSelectedFile={handleSelectedFile}
          onSelectedWorkflowFile={handleSelectedWorkflowFile}
          onUrlIngest={handleUrlIngest}
          onUseBundledWorkflow={handleUseBundledWorkflow}
          onValidateWorkflow={handleValidateWorkflow}
          providerReadiness={providerReadiness}
          providerSettings={providerSettings}
          providerSettingsForm={providerSettingsForm}
          newProcessingHookKey={newProcessingHookKey}
          processingHookKeyInFlight={processingHookKeyInFlight}
          reportActionError={reportActionError}
          section={settingsSection}
          settingsSummary={settingsSummary}
          setupReadiness={setupReadiness}
          taskRouteDrafts={taskRouteDrafts}
          urlForm={urlForm}
          workflowStatus={workflowStatus}
          workflowDefinitionSelection={workflowDefinitionSelection}
          workflowValidation={workflowValidation}
        />
      )}
    </div>
  );
}

function SettingsWorkspace({
  databaseSettings,
  databaseSettingsForm,
  fileForm,
  ingestBlocked,
  isPending,
  newProcessingHookKey,
  onActivateWorkflow,
  onChangeDatabaseSettingsForm,
  onChangeFileForm,
  onChangeNewProcessingHookKey,
  onChangeProviderSettingsForm,
  onChangeSection,
  onChangeTaskRouteDrafts,
  onChangeUrlForm,
  onFileIngest,
  onCreateProcessingHook,
  onDeleteProcessingHook,
  onProviderRefresh,
  onSaveDatabaseSettings,
  onSaveProviderSettings,
  onSaveTaskRoute,
  onSelectedFile,
  onSelectedWorkflowFile,
  onUrlIngest,
  onUseBundledWorkflow,
  onValidateWorkflow,
  providerReadiness,
  providerSettings,
  providerSettingsForm,
  processingHookKeyInFlight,
  reportActionError,
  section,
  settingsSummary,
  setupReadiness,
  taskRouteDrafts,
  urlForm,
  workflowStatus,
  workflowDefinitionSelection,
  workflowValidation
}: {
  databaseSettings: DatabaseSettings | null;
  databaseSettingsForm: DatabaseSettingsForm;
  fileForm: FileForm;
  ingestBlocked: boolean;
  isPending: (key: PendingKey) => boolean;
  newProcessingHookKey: string;
  onActivateWorkflow: () => Promise<void>;
  onChangeDatabaseSettingsForm: Dispatch<SetStateAction<DatabaseSettingsForm>>;
  onChangeFileForm: Dispatch<SetStateAction<FileForm>>;
  onChangeNewProcessingHookKey: Dispatch<SetStateAction<string>>;
  onChangeProviderSettingsForm: Dispatch<SetStateAction<ProviderSettingsForm>>;
  onChangeSection: (section: SettingsSection) => void;
  onChangeTaskRouteDrafts: Dispatch<SetStateAction<Record<string, TaskRouteDraft>>>;
  onChangeUrlForm: Dispatch<SetStateAction<UrlForm>>;
  onFileIngest: () => Promise<void>;
  onCreateProcessingHook: () => Promise<void>;
  onDeleteProcessingHook: (hook: ProcessingHookSummary) => Promise<void>;
  onProviderRefresh: () => Promise<void>;
  onSaveDatabaseSettings: () => Promise<void>;
  onSaveProviderSettings: () => Promise<void>;
  onSaveTaskRoute: (taskKey: string) => Promise<void>;
  onSelectedFile: (file: File | null) => Promise<void>;
  onSelectedWorkflowFile: (file: File | null) => Promise<void>;
  onUrlIngest: () => Promise<void>;
  onUseBundledWorkflow: () => Promise<void>;
  onValidateWorkflow: () => Promise<void>;
  providerReadiness: ProviderReadiness | null;
  providerSettings: ProviderSettings | null;
  providerSettingsForm: ProviderSettingsForm;
  processingHookKeyInFlight: string | null;
  reportActionError: (action: () => Promise<unknown>) => void;
  section: SettingsSection;
  settingsSummary: SettingsSummary | null;
  setupReadiness: SetupReadiness | null;
  taskRouteDrafts: Record<string, TaskRouteDraft>;
  urlForm: UrlForm;
  workflowStatus: WorkflowStatus | null;
  workflowDefinitionSelection: WorkflowDefinitionSelection;
  workflowValidation: WorkflowValidationResult | null;
}) {
  const sections: { id: SettingsSection; label: string; status?: string }[] = [
    { id: "database", label: "Database", status: databaseSettings?.ready ? "Ready" : "Blocked" },
    { id: "workflow", label: "Workflow", status: workflowStatus?.active ? "Active" : "Blocked" },
    { id: "provider", label: "Provider Registry", status: providerSettings?.status ?? providerSettings?.sources.registryUrl },
    { id: "processing-hooks", label: "Processing Hooks", status: `${settingsSummary?.processingHooks.length ?? 0}` },
    { id: "tasks", label: "AI Tasks", status: `${settingsSummary?.taskRoutes.length ?? 0}` },
    { id: "landing", label: "Landing Areas", status: `${settingsSummary?.renderSlots.length ?? 0}` },
    { id: "diagnostics", label: "Diagnostics", status: providerReadiness?.ready ? "Ready" : "Check" },
    { id: "ingest", label: "Ingest", status: ingestBlocked ? "Blocked" : "Ready" }
  ];

  return (
    <main className="settings-workspace">
      <aside className="settings-nav" aria-label="Settings sections">
        <div className="sidebar-label">Settings</div>
        {sections.map((item) => (
          <button
            className={item.id === section ? "settings-nav-item active" : "settings-nav-item"}
            key={item.id}
            type="button"
            onClick={() => onChangeSection(item.id)}
          >
            <span>{item.label}</span>
            {item.status ? <small>{item.status}</small> : null}
          </button>
        ))}
      </aside>

      <section className="settings-detail">
        {section === "database" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Database</h2>
                <p>Configure the local Postgres connection used for workflow, ingest, review, autosave, and provider task history.</p>
              </div>
              <span className={databaseSettings?.ready ? "status status-ready" : "status status-blocked"}>
                {databaseSettings?.ready ? "Ready" : "Blocked"}
              </span>
            </div>
            <form
              className="database-settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                reportActionError(onSaveDatabaseSettings);
              }}
            >
              <label>
                Database URL
                <input
                  value={databaseSettingsForm.databaseUrl}
                  onChange={(event) =>
                    onChangeDatabaseSettingsForm((current) => ({ ...current, databaseUrl: event.target.value }))
                  }
                  placeholder="postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev"
                  spellCheck={false}
                  type="text"
                />
                <small>
                  {databaseSettings?.restartRequired
                    ? "Saved value is waiting for app restart."
                    : settingSourceLabel(databaseSettings?.sources.databaseUrl)}
                </small>
              </label>
              <button className="btn btn-primary" disabled={isPending("database-settings")} type="submit">
                {isPending("database-settings") ? "Saving" : "Save Database URL"}
              </button>
            </form>
            <div className="settings-summary">
              <div>
                <span>Active source</span>
                <strong>{settingSourceLabel(databaseSettings?.sources.databaseUrl)}</strong>
              </div>
              <div>
                <span>Connection</span>
                <strong>{databaseSettings?.ready ? "Ready" : databaseSettings?.configured ? "Not ready" : "Not configured"}</strong>
              </div>
              <div>
                <span>Restart</span>
                <strong>{databaseSettings?.restartRequired ? "Required" : "Not required"}</strong>
              </div>
            </div>
            {databaseSettings?.reason ? <div className="validation invalid">{databaseSettings.reason}</div> : null}
          </div>
        ) : null}

        {section === "workflow" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Workflow</h2>
                <p>Choose a state-workflow JSON definition, validate it, then import and activate it before ingesting documents.</p>
              </div>
              <div className="setup-actions">
                <label className="btn btn-secondary file-picker-button" aria-disabled={isPending("workflow-file-read")}>
                  {isPending("workflow-file-read") ? "Opening" : "Choose JSON"}
                  <input
                    accept=".json,application/json"
                    disabled={isPending("workflow-file-read")}
                    type="file"
                    onChange={(event) => reportActionError(() => onSelectedWorkflowFile(event.currentTarget.files?.[0] ?? null))}
                  />
                </label>
                <button className="btn btn-secondary" disabled={workflowDefinitionSelection.source === "bundled"} type="button" onClick={() => reportActionError(onUseBundledWorkflow)}>
                  Use Bundled Fixture
                </button>
                <button className="btn btn-secondary" disabled={isPending("workflow-validate")} type="button" onClick={() => reportActionError(onValidateWorkflow)}>
                  {isPending("workflow-validate") ? "Validating" : "Validate"}
                </button>
                <button className="btn btn-primary" disabled={isPending("workflow-activate")} type="button" onClick={() => reportActionError(onActivateWorkflow)}>
                  {isPending("workflow-activate") ? "Activating" : "Import And Activate"}
                </button>
              </div>
            </div>
            <ReadinessGrid checks={workflowStatus?.readiness.checks ?? []} />
            <div className="workflow-summary">
              <dl>
                <div>
                  <dt>Selected definition</dt>
                  <dd>{workflowDefinitionSelection.label}</dd>
                </div>
                <div>
                  <dt>Active workflow</dt>
                  <dd>{workflowStatus?.workflow ? workflowStatus.workflow.id : "None"}</dd>
                </div>
                <div>
                  <dt>Definition</dt>
                  <dd>{workflowStatus?.workflow ? workflowStatus.workflow.definitionVersion : "Not active"}</dd>
                </div>
                <div>
                  <dt>Entry state</dt>
                  <dd>{workflowStatus?.workflow?.entryStates.join(", ") ?? "Not available"}</dd>
                </div>
              </dl>
              {workflowValidation ? (
                <div className={workflowValidation.valid ? "validation valid" : "validation invalid"}>
                  {workflowValidation.valid
                    ? `Validated ${workflowValidation.workflow.id} ${workflowValidation.workflow.definitionVersion}`
                    : workflowValidation.errors.join(" ")}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {section === "provider" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Provider Registry</h2>
                <p>Select the registry profile Artifact Review uses, then inspect the read-only provider catalog for that profile.</p>
              </div>
              <button className="btn btn-secondary" disabled={isPending("provider-refresh")} type="button" onClick={() => reportActionError(onProviderRefresh)}>
                {isPending("provider-refresh") ? "Refreshing" : "Refresh"}
              </button>
            </div>
            <form
              className="provider-registry-profile-card"
              onSubmit={(event) => {
                event.preventDefault();
                reportActionError(onSaveProviderSettings);
              }}
            >
              <div className="task-route-heading">
                <div>
                  <strong>Registry profile</strong>
                  <small>Provider records are managed outside Artifact Review.</small>
                </div>
                <span className={providerSettings?.status === "ready" ? "status status-ready" : "status status-blocked"}>
                  {providerSettings?.status ?? "unknown"}
                </span>
              </div>
              <div className="provider-registry-profile-controls">
                <label>
                  Profile
                  <select
                    value={providerSettingsForm.selectedProviderProfileKey}
                    onChange={(event) =>
                      onChangeProviderSettingsForm((current) => ({
                        ...current,
                        selectedProviderProfileKey: event.target.value
                      }))
                    }
                  >
                    <option value="">Use bootstrap profile</option>
                    {providerSettings?.activeProfileKey &&
                    !(providerSettings.profiles ?? []).some((profile) => profile.profileKey === providerSettings.activeProfileKey) ? (
                      <option value={providerSettings.activeProfileKey}>{providerSettings.activeProfileKey}</option>
                    ) : null}
                    {(providerSettings?.profiles ?? []).map((profile) => (
                      <option value={profile.profileKey} key={profile.profileKey}>
                        {(profile.displayName ?? profile.profileKey)} ({profile.profileKey})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source
                  <input readOnly value={providerSettings?.profileSource ?? providerSettings?.sources.selectedProviderProfileKey ?? "none"} />
                </label>
                <label>
                  Registry URL
                  <input
                    value={providerSettingsForm.registryUrl}
                    onChange={(event) =>
                      onChangeProviderSettingsForm((current) => ({ ...current, registryUrl: event.target.value }))
                    }
                    placeholder="http://127.0.0.1:5181"
                  />
                </label>
                <label className="inline-check">
                  <input
                    checked={providerSettingsForm.demoProviderMode}
                    type="checkbox"
                    onChange={(event) =>
                      onChangeProviderSettingsForm((current) => ({ ...current, demoProviderMode: event.target.checked }))
                    }
                  />
                  Demo mode
                </label>
                <button className="btn btn-primary" disabled={isPending("provider-settings")} type="submit">
                  {isPending("provider-settings") ? "Saving" : "Save"}
                </button>
              </div>
            </form>
            <div className="provider-registry-meta">
              <div>
                <span>URL</span>
                <strong>{providerSettings?.registryUrl || "Not configured"}</strong>
              </div>
              <div>
                <span>Active</span>
                <strong>{providerSettings?.activeProfileKey || "Not configured"}</strong>
              </div>
              <div>
                <span>Bootstrap</span>
                <strong>{providerSettings?.bootstrapProfileKey || "None"}</strong>
              </div>
              <div>
                <span>Providers</span>
                <strong>{providerSettings?.providerCount ?? settingsSummary?.providerCatalog.providers.length ?? 0}</strong>
              </div>
            </div>
            {providerSettings?.activeProfile?.description ? <p>{providerSettings.activeProfile.description}</p> : null}
            {providerSettings?.error ? <div className="validation invalid">{providerSettings.error}</div> : null}
            <ProviderRegistryCatalog providerCatalog={settingsSummary?.providerCatalog ?? null} />
            <ReadinessGrid checks={providerReadiness?.checks ?? []} />
          </div>
        ) : null}

        {section === "processing-hooks" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Processing Hooks</h2>
                <p>Register app-owned hook keys that task routes can dispatch through. Hooks without backend logic remain default no-op.</p>
              </div>
              <span className="section-count">{settingsSummary?.processingHooks.length ?? 0} registered</span>
            </div>
            <form
              className="processing-hook-create-card"
              onSubmit={(event) => {
                event.preventDefault();
                reportActionError(onCreateProcessingHook);
              }}
            >
              <label>
                Hook Key
                <input
                  value={newProcessingHookKey}
                  disabled={isPending("processing-hook-create")}
                  onChange={(event) => onChangeNewProcessingHookKey(event.target.value)}
                  placeholder="custom-review-hook"
                />
              </label>
              <button className="btn btn-primary" disabled={isPending("processing-hook-create")} type="submit">
                {isPending("processing-hook-create") ? "Creating" : "Create Hook"}
              </button>
            </form>
            {(settingsSummary?.processingHooks.length ?? 0) === 0 ? (
              <div className="empty-state">No processing hooks registered.</div>
            ) : (
              <div className="processing-hooks-table" role="table" aria-label="Processing Hooks">
                <div className="processing-hooks-row processing-hooks-header" role="row">
                  <div role="columnheader">Hook key</div>
                  <div role="columnheader">Display name</div>
                  <div role="columnheader">Status</div>
                  <div role="columnheader">Tasks</div>
                  <div role="columnheader">Actions</div>
                </div>
                {(settingsSummary?.processingHooks ?? []).map((hook) => (
                  <div className="processing-hooks-row" role="row" key={hook.hookKey}>
                    <div role="cell">
                      <code>{hook.hookKey}</code>
                    </div>
                    <div role="cell">{hook.displayName}</div>
                    <div role="cell">
                      <span className={hook.implemented ? "status status-ready" : "status status-muted"}>
                        {hook.statusLabel}
                      </span>
                    </div>
                    <div role="cell">{hook.taskUsageCount}</div>
                    <div role="cell">
                      <button
                        className="btn btn-secondary"
                        disabled={processingHookKeyInFlight === hook.hookKey || !hook.deletable}
                        title={hook.deleteBlockedReason ?? `Delete ${hook.displayName}`}
                        type="button"
                        onClick={() => reportActionError(() => onDeleteProcessingHook(hook))}
                      >
                        {processingHookKeyInFlight === hook.hookKey ? "Deleting" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {section === "tasks" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>AI Tasks</h2>
                <p>Edit provider task routing, slot placement, order, enabled state, and model override.</p>
              </div>
            </div>
            <div className="task-route-list">
              {(settingsSummary?.taskRoutes ?? []).map((route) => {
                const draft = taskRouteDrafts[route.taskKey] ?? taskRouteToDraft(route);
                const registeredHooks = settingsSummary?.processingHooks ?? [];
                const selectedHook = registeredHooks.find((hook) => hook.hookKey === draft.hookKey);
                const selectedHookImplemented = selectedHook?.implemented ?? route.hookReady;
                const hasSelectedHookOption = registeredHooks.some((hook) => hook.hookKey === draft.hookKey);
                return (
                  <form
                    className="task-route-card"
                    key={route.taskKey}
                    onSubmit={(event) => {
                      event.preventDefault();
                      reportActionError(() => onSaveTaskRoute(route.taskKey));
                    }}
                  >
                    <div className="task-route-heading">
                      <div>
                        <strong>{route.displayName}</strong>
                        <small>{route.taskKey}</small>
                      </div>
                      <StatusPill
                        item={{
                          key: route.taskKey,
                          label: route.enabled ? "Enabled" : "Disabled",
                          ready: route.enabled && route.hookReady,
                          reason: route.hookReady ? undefined : `Hook ${route.hookKey} is not implemented.`
                        }}
                      />
                    </div>
                    <div className="task-route-grid">
                      <label>
                        Provider key
                        <input
                          value={draft.providerKey}
                          placeholder="Profile capability default"
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { providerKey: event.target.value })}
                        />
                      </label>
                      <label>
                        Render slot
                        <select
                          value={draft.renderSlot}
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { renderSlot: event.target.value })}
                        >
                          {(settingsSummary?.renderSlots ?? []).map((slot) => (
                            <option key={slot.slot} value={slot.slot}>
                              {slot.slot}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Hook
                        <select
                          value={draft.hookKey}
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { hookKey: event.target.value })}
                        >
                          {draft.hookKey && !hasSelectedHookOption ? (
                            <option value={draft.hookKey}>{draft.hookKey} (unregistered)</option>
                          ) : null}
                          {registeredHooks.map((hook) => (
                            <option key={hook.hookKey} value={hook.hookKey}>
                              {hook.displayName} ({hook.statusLabel})
                            </option>
                          ))}
                        </select>
                        {selectedHook && !selectedHook.implemented ? (
                          <small className="field-note">This hook is registered but currently default no-op.</small>
                        ) : null}
                      </label>
                      <label>
                        Order
                        <input
                          inputMode="numeric"
                          value={draft.displayOrder}
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { displayOrder: event.target.value })}
                        />
                      </label>
                      <label>
                        Model override
                        <input
                          value={draft.modelOverride}
                          placeholder="Optional"
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { modelOverride: event.target.value })}
                        />
                      </label>
                      <label>
                        Display label
                        <input
                          value={draft.displayLabel}
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { displayLabel: event.target.value })}
                        />
                      </label>
                      <label className="full-span">
                        Description
                        <input
                          value={draft.displayDescription}
                          onChange={(event) => updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { displayDescription: event.target.value })}
                        />
                      </label>
                    </div>
                    <div className="inline-actions">
                      <label className="inline-check">
                        <input
                          checked={draft.enabled}
                          disabled={!selectedHookImplemented && !draft.enabled}
                          type="checkbox"
                          onChange={(event) => {
                            if (event.target.checked && !selectedHookImplemented) {
                              return;
                            }
                            updateTaskRouteDraft(onChangeTaskRouteDrafts, route.taskKey, { enabled: event.target.checked });
                          }}
                        />
                        Enabled
                      </label>
                      <button className="btn btn-primary" disabled={isPending("task-route") || (draft.enabled && !selectedHookImplemented)} type="submit">
                        {isPending("task-route") ? "Saving" : "Save Route"}
                      </button>
                    </div>
                  </form>
                );
              })}
            </div>
          </div>
        ) : null}

        {section === "landing" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Landing Areas</h2>
                <p>Predefined render slots and their current task assignments.</p>
              </div>
            </div>
            <div className="render-slot-list">
              {(settingsSummary?.renderSlots ?? []).map((slot) => (
                <RenderSlotRow key={slot.slot} slot={slot} />
              ))}
            </div>
          </div>
        ) : null}

        {section === "diagnostics" ? (
          <div className="settings-panel">
            <div className="panel-heading">
              <div>
                <h2>Diagnostics</h2>
                <p>Provider readiness, hook readiness, task readiness, and recent task runs.</p>
              </div>
            </div>
            <div className="admin-two-column">
              <div>
                <h3>Setup</h3>
                <ReadinessGrid checks={setupReadiness?.checks ?? []} />
              </div>
              <div>
                <h3>Providers</h3>
                <ReadinessGrid checks={providerReadiness?.checks ?? []} />
              </div>
            </div>
            <TaskRunTable taskRuns={settingsSummary?.taskRuns ?? []} />
          </div>
        ) : null}

        {section === "ingest" ? (
          <div className="settings-panel ingest-panel" aria-disabled={ingestBlocked}>
            <div className="panel-heading">
              <div>
                <h2>Ingest</h2>
                <p>{ingestBlocked ? "Activate the workflow before ingesting." : "Create documents from file text or URL snapshots."}</p>
              </div>
              {ingestBlocked ? (
                <StatusPill
                  item={{
                    key: "ingest-blocked",
                    label: "Ingest",
                    ready: false,
                    reason: "No active workflow."
                  }}
                />
              ) : null}
            </div>
            <div className="ingest-grid">
              <form
                className="ingest-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  reportActionError(onFileIngest);
                }}
              >
                <label>
                  Select file
                  <input
                    accept=".txt,.md,.html,.htm,text/plain,text/markdown,text/html"
                    disabled={ingestBlocked || isPending("file-read")}
                    type="file"
                    onChange={(event) => reportActionError(() => onSelectedFile(event.currentTarget.files?.[0] ?? null))}
                  />
                </label>
                <label>
                  Name
                  <input
                    disabled={ingestBlocked}
                    value={fileForm.name}
                    onChange={(event) => onChangeFileForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label>
                  Format
                  <select
                    disabled={ingestBlocked}
                    value={fileForm.format}
                    onChange={(event) =>
                      onChangeFileForm((current) => ({
                        ...current,
                        format: event.target.value as FileForm["format"]
                      }))
                    }
                  >
                    <option value="txt">txt</option>
                    <option value="md">md</option>
                    <option value="html">html</option>
                    <option value="htm">htm</option>
                  </select>
                </label>
                <label className="full-span">
                  Content
                  <textarea
                    disabled={ingestBlocked}
                    rows={6}
                    value={fileForm.content}
                    onChange={(event) => onChangeFileForm((current) => ({ ...current, content: event.target.value }))}
                  />
                </label>
                <button className="btn btn-primary" disabled={ingestBlocked || isPending("file-ingest")} type="submit">
                  {isPending("file-ingest") ? "Ingesting" : "Ingest File"}
                </button>
              </form>

              <form
                className="ingest-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  reportActionError(onUrlIngest);
                }}
              >
                <label>
                  URL
                  <input
                    disabled={ingestBlocked}
                    placeholder="https://example.com"
                    value={urlForm.url}
                    onChange={(event) => onChangeUrlForm((current) => ({ ...current, url: event.target.value }))}
                  />
                </label>
                <label>
                  Name
                  <input
                    disabled={ingestBlocked}
                    placeholder="Optional"
                    value={urlForm.name}
                    onChange={(event) => onChangeUrlForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="full-span">
                  Snapshot HTML
                  <textarea
                    disabled={ingestBlocked}
                    rows={6}
                    placeholder="Optional captured HTML. Leave blank to fetch the URL."
                    value={urlForm.snapshotHtml}
                    onChange={(event) => onChangeUrlForm((current) => ({ ...current, snapshotHtml: event.target.value }))}
                  />
                </label>
                <button className="btn btn-primary" disabled={ingestBlocked || !urlForm.url.trim() || isPending("url-ingest")} type="submit">
                  {isPending("url-ingest") ? "Ingesting" : "Ingest URL"}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function RenderSlotRow({ slot }: { slot: RenderSlotSummary }) {
  return (
    <article className="render-slot-row">
      <div>
        <strong>{slot.label}</strong>
        <span>{slot.slot}</span>
        <p>{slot.description}</p>
      </div>
      <div className="render-slot-metrics">
        <span>{slot.actionCount} actions</span>
        <span>{slot.readyActionCount} ready</span>
      </div>
      <div className="render-slot-tasks">
        {slot.taskKeys.length === 0 ? <small>No assigned tasks</small> : slot.taskKeys.map((taskKey) => <small key={taskKey}>{taskKey}</small>)}
      </div>
    </article>
  );
}

function ProviderRegistryCatalog({ providerCatalog }: { providerCatalog: SettingsSummary["providerCatalog"] | null }) {
  if (!providerCatalog) {
    return <div className="empty-state">Provider catalog is not available.</div>;
  }

  if (!providerCatalog.registry.reachable) {
    return (
      <div className="provider-catalog-list">
        <div className="provider-catalog-row">
          <div>
            <strong>Provider registry unavailable</strong>
            <span>{providerCatalog.registry.url || "No registry URL configured"}</span>
          </div>
          <span className="status status-blocked">Unavailable</span>
          {providerCatalog.registry.error ? <p>{providerCatalog.registry.error}</p> : null}
        </div>
      </div>
    );
  }

  if (providerCatalog.providers.length === 0) {
    return <div className="empty-state">No providers are available for the selected profile.</div>;
  }

  return (
    <div className="provider-catalog-list" aria-label="Provider catalog">
      {providerCatalog.providers.map((provider) => (
        <article className="provider-catalog-row" key={provider.providerKey}>
          <div>
            <strong>{provider.displayName ?? provider.providerKey}</strong>
            <span>{provider.providerKey}</span>
          </div>
          <span className={provider.enabled === false ? "status status-blocked" : "status status-ready"}>
            {provider.enabled === false ? "Disabled" : "Enabled"}
          </span>
          <dl className="provider-catalog-meta">
            <div>
              <dt>Kind</dt>
              <dd>{provider.providerKind ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Adapter</dt>
              <dd>{provider.adapterKey ?? "Default"}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{provider.model ?? "Profile default"}</dd>
            </div>
            <div>
              <dt>Health</dt>
              <dd>{provider.health?.status ?? "Unknown"}</dd>
            </div>
          </dl>
          <div className="capability-chip-list">
            {provider.externalSend ? <span>External send</span> : null}
            {(provider.capabilities ?? []).map((capability) => (
              <span key={capability.key}>{capability.displayName ?? capability.key}</span>
            ))}
          </div>
          {provider.health?.message ? <p>{provider.health.message}</p> : null}
        </article>
      ))}
    </div>
  );
}

function TaskRunTable({ taskRuns }: { taskRuns: TaskRun[] }) {
  if (taskRuns.length === 0) {
    return <div className="empty-state">No task runs recorded yet.</div>;
  }

  return (
    <div className="task-run-table" role="table" aria-label="Recent task runs">
      <div className="task-run-row header" role="row">
        <span>Task</span>
        <span>Status</span>
        <span>Provider</span>
        <span>Validation</span>
        <span>Created</span>
      </div>
      {taskRuns.map((taskRun) => (
        <div className="task-run-row" role="row" key={taskRun.id}>
          <span>{taskRun.taskKey}</span>
          <span>{taskRun.status}</span>
          <span>{taskRun.providerKey ?? "Not recorded"}</span>
          <span>{taskRun.validationStatus ?? "Not recorded"}</span>
          <span>{formatDateTime(taskRun.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

function InlineReviewPanel({
  activeTab,
  annotations,
  component,
  componentDrafts,
  evidence,
  isPending,
  onAcceptSuggestion,
  onAddAnnotation,
  onAddEvidence,
  onAddQuestion,
  onChangeAnnotation,
  onChangeDraft,
  onChangeEvidenceKind,
  onChangeEvidenceValue,
  onChangeQuestion,
  onRejectSuggestion,
  onSaveText,
  onSuggest,
  onTabChange,
  questions,
  reportActionError,
  reviewNoteForm,
  selectedDraftChanged,
  suggestionInvocation,
  suggestionAction,
  suggestionReadiness,
  suggestionReady,
  suggestions,
  taskRunsById
}: {
  activeTab: InlineReviewTab;
  annotations: DocumentDetail["review"]["annotations"];
  component: DocumentDetail["components"][number] | null;
  componentDrafts: Record<string, string>;
  evidence: DocumentDetail["review"]["evidenceSources"];
  isPending: (key: PendingKey) => boolean;
  onAcceptSuggestion: (suggestionId: string) => Promise<void>;
  onAddAnnotation: () => Promise<void>;
  onAddEvidence: () => Promise<void>;
  onAddQuestion: () => Promise<void>;
  onChangeAnnotation: (value: string) => void;
  onChangeDraft: (value: string) => void;
  onChangeEvidenceKind: (value: EvidenceKind) => void;
  onChangeEvidenceValue: (value: string) => void;
  onChangeQuestion: (value: string) => void;
  onRejectSuggestion: (suggestionId: string) => Promise<void>;
  onSaveText: () => Promise<void>;
  onSuggest: () => Promise<void>;
  onTabChange: (tab: InlineReviewTab) => void;
  questions: DocumentDetail["review"]["questions"];
  reportActionError: (action: () => Promise<unknown>) => void;
  reviewNoteForm: ReviewNoteForm;
  selectedDraftChanged: boolean;
  suggestionInvocation: ProviderReadiness["invocation"] | null;
  suggestionAction: RenderSlotAction | null;
  suggestionReadiness: (ProviderReadiness & { taskKey: string }) | null;
  suggestionReady: boolean;
  suggestions: DocumentDetail["review"]["aiSuggestions"];
  taskRunsById: Record<string, TaskRun>;
}) {
  if (!component) {
    return null;
  }

  return (
    <div className="inline-review">
      <div className="inline-review-tabs" role="tablist" aria-label="Inline review">
        <InlineTab active={activeTab === "text"} label="Text" onClick={() => onTabChange("text")} />
        <InlineTab active={activeTab === "annotations"} label={`Annotations (${annotations.length})`} onClick={() => onTabChange("annotations")} />
        <InlineTab active={activeTab === "questions"} label={`Questions (${questions.length})`} onClick={() => onTabChange("questions")} />
        <InlineTab active={activeTab === "evidence"} label={`Evidence (${evidence.length})`} onClick={() => onTabChange("evidence")} />
        <InlineTab active={activeTab === "ai"} label={`AI Suggestions (${suggestions.length})`} onClick={() => onTabChange("ai")} />
      </div>

      {activeTab === "text" ? (
        <div className="inline-panel-body">
          <label>
            Current text
            <textarea
              rows={6}
              value={componentDrafts[component.id] ?? component.currentText}
              onChange={(event) => onChangeDraft(event.target.value)}
            />
          </label>
          <div className="inline-actions">
            {selectedDraftChanged ? <span className="draft-state">Unsaved text draft</span> : null}
            <button className="btn btn-primary" disabled={isPending("edit")} type="button" onClick={() => reportActionError(onSaveText)}>
              {isPending("edit") ? "Autosaving" : "Autosave Text"}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "annotations" ? (
        <div className="inline-panel-body">
          <RecordList emptyLabel="No annotations." records={annotations.map((annotation) => annotation.body)} />
          <label>
            Annotation
            <textarea rows={3} value={reviewNoteForm.annotation} onChange={(event) => onChangeAnnotation(event.target.value)} />
          </label>
          <button
            className="btn btn-primary"
            disabled={!reviewNoteForm.annotation.trim() || isPending("annotation")}
            type="button"
            onClick={() => reportActionError(onAddAnnotation)}
          >
            Add Annotation
          </button>
        </div>
      ) : null}

      {activeTab === "questions" ? (
        <div className="inline-panel-body">
          <RecordList emptyLabel="No questions." records={questions.map((question) => `${question.status}: ${question.body}`)} />
          <label>
            Question
            <textarea rows={3} value={reviewNoteForm.question} onChange={(event) => onChangeQuestion(event.target.value)} />
          </label>
          <button
            className="btn btn-primary"
            disabled={!reviewNoteForm.question.trim() || isPending("question")}
            type="button"
            onClick={() => reportActionError(onAddQuestion)}
          >
            Add Question
          </button>
        </div>
      ) : null}

      {activeTab === "evidence" ? (
        <div className="inline-panel-body">
          <RecordList emptyLabel="No evidence." records={evidence.map((item) => `${item.kind}: ${item.value}`)} />
          <div className="evidence-form">
            <label>
              Evidence kind
              <select value={reviewNoteForm.evidenceKind} onChange={(event) => onChangeEvidenceKind(event.target.value as EvidenceKind)}>
                <option value="source">source</option>
                <option value="link">link</option>
                <option value="repo_path">repo_path</option>
                <option value="screenshot_path">screenshot_path</option>
                <option value="note">note</option>
              </select>
            </label>
            <label>
              Evidence
              <input value={reviewNoteForm.evidenceValue} onChange={(event) => onChangeEvidenceValue(event.target.value)} />
            </label>
          </div>
          <button
            className="btn btn-primary"
            disabled={!reviewNoteForm.evidenceValue.trim() || isPending("evidence")}
            type="button"
            onClick={() => reportActionError(onAddEvidence)}
          >
            Add Evidence
          </button>
        </div>
      ) : null}

      {activeTab === "ai" ? (
        <div className="inline-panel-body">
          <div className="suggestion-heading">
            <StatusPill
              item={{
                key: "provider-suggestions",
                label: "Provider",
                ready: suggestionReady,
                reason: providerBlocker(suggestionReadiness)
              }}
            />
            <button
              className="btn btn-secondary"
              disabled={!suggestionAction || !suggestionAction.ready || !suggestionReady || isPending("ai-suggest")}
              title={
                suggestionAction?.ready && suggestionReady
                  ? "Create a proposed AI suggestion"
                  : renderSlotActionBlocker(suggestionAction) ?? providerBlocker(suggestionReadiness)
              }
              type="button"
              onClick={() => reportActionError(onSuggest)}
            >
              {isPending("ai-suggest") ? "Suggesting" : suggestionAction?.displayName ?? "AI Suggest"}
            </button>
          </div>
          <InvocationSummary readiness={suggestionReadiness} summary={suggestionInvocation} />
          {suggestions.length === 0 ? (
            <p className="muted compact">No suggestions for this component.</p>
          ) : (
            <div className="suggestion-list">
              {suggestions.map((suggestion) => {
                const taskRun = suggestion.taskRunId ? taskRunsById[suggestion.taskRunId] : undefined;
                return (
                  <article className="suggestion-card" key={suggestion.id}>
                    <div className="suggestion-card-header">
                      <strong>{suggestion.status}</strong>
                      <span>{Math.round(suggestion.confidence * 100)}% confidence</span>
                    </div>
                    <p>{suggestion.proposedText}</p>
                    <small>{suggestion.rationale}</small>
                    {Array.isArray(suggestion.warnings) && suggestion.warnings.length > 0 ? (
                      <small>Warnings: {suggestion.warnings.join(", ")}</small>
                    ) : null}
                    <TaskRunProvenance taskRun={taskRun} taskRunId={suggestion.taskRunId} />
                    <small>Created {formatDateTime(suggestion.createdAt)}</small>
                    {suggestion.decidedAt ? <small>Decided {formatDateTime(suggestion.decidedAt)}</small> : null}
                    {suggestion.status === "proposed" ? (
                      <div className="suggestion-actions">
                        <button
                          className="btn btn-accept"
                          disabled={selectedDraftChanged || isPending("ai-suggestion-action")}
                          title={
                            selectedDraftChanged
                              ? "Save or discard the text draft before accepting this suggestion."
                              : "Accept this suggestion and create an audited revision."
                          }
                          type="button"
                          onClick={() => reportActionError(() => onAcceptSuggestion(suggestion.id))}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-reject"
                          disabled={isPending("ai-suggestion-action")}
                          type="button"
                          onClick={() => reportActionError(() => onRejectSuggestion(suggestion.id))}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function InlineTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={active ? "inline-tab active" : "inline-tab"} role="tab" aria-selected={active} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function ComponentIndicators({ counts, onSelect }: { counts: ComponentCounts; onSelect: (tab: InlineReviewTab) => void }) {
  return (
    <div className="component-indicators">
      {counts.annotations > 0 ? (
        <button className="indicator indicator-annotation" type="button" onClick={() => onSelect("annotations")}>
          {counts.annotations} annotations
        </button>
      ) : null}
      {counts.questions > 0 ? (
        <button className="indicator indicator-question" type="button" onClick={() => onSelect("questions")}>
          {counts.questions} questions
        </button>
      ) : null}
      {counts.evidence > 0 ? (
        <button className="indicator indicator-evidence" type="button" onClick={() => onSelect("evidence")}>
          {counts.evidence} evidence
        </button>
      ) : null}
      {counts.suggestions > 0 ? (
        <button className="indicator indicator-ai" type="button" onClick={() => onSelect("ai")}>
          {counts.suggestions} AI proposals
        </button>
      ) : null}
    </div>
  );
}

function StatItem({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="stat-item">
      <span className={`stat-dot ${tone}`}></span>
      {label}
    </span>
  );
}

function StatusMessage({
  error,
  notice,
  lastAutosave
}: {
  error: string | null;
  notice: string | null;
  lastAutosave: AutosaveSnapshot | null;
}) {
  return (
    <div className="status-message" aria-live="polite">
      {error ? <span className="error-text">{error}</span> : null}
      {!error && notice ? <span>{notice}</span> : null}
      {!error && !notice && lastAutosave ? <span>Autosaved {formatDateTime(lastAutosave.createdAt)}</span> : null}
      {!error && !notice && !lastAutosave ? <span>Workspace ready for service-backed review.</span> : null}
    </div>
  );
}

function ReadinessGrid({ checks }: { checks: SetupReadiness["checks"] }) {
  if (checks.length === 0) {
    return <div className="empty-state">No readiness checks returned yet.</div>;
  }
  return (
    <div className="readiness-grid">
      {checks.map((item) => (
        <div className="readiness-item" key={item.key}>
          <span>{item.label}</span>
          <StatusPill item={item} />
        </div>
      ))}
    </div>
  );
}

function formatFromFileName(fileName: string): FileForm["format"] {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "md" || extension === "html" || extension === "htm") {
    return extension;
  }
  return "txt";
}

function buildExportFileName(document: DocumentSummary): string {
  const extension =
    document.sourceType === "url" || document.originalFormat === "url_snapshot"
      ? "html"
      : document.originalFormat === "md" || document.originalFormat === "html" || document.originalFormat === "htm"
        ? document.originalFormat
        : "txt";
  const stem = document.name
    .trim()
    .replace(/[\\/:"*?<>|]+/g, "-")
    .replace(/\.(txt|md|html|htm)$/i, "")
    .slice(0, 120);

  return `${stem || "artifact-review-export"}.${extension}`;
}

function downloadExportedFile(file: ExportedFile) {
  if (!file.content) {
    throw new Error(`Export ${file.fileName} did not include downloadable content.`);
  }

  const blob = new Blob([file.content], { type: file.contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function RecordList({ emptyLabel, records }: { emptyLabel: string; records: string[] }) {
  if (records.length === 0) {
    return <p className="muted compact">{emptyLabel}</p>;
  }

  return (
    <ul className="record-list">
      {records.map((record) => (
        <li key={record}>{record}</li>
      ))}
    </ul>
  );
}

function InvocationSummary({
  readiness,
  summary
}: {
  readiness: ProviderReadiness | null;
  summary: ProviderReadiness["invocation"] | null;
}) {
  if (!summary) {
    return (
      <div className="invocation-summary blocked">
        <span>AI Suggest task</span>
        <strong>{providerBlocker(readiness) ?? "Not configured"}</strong>
      </div>
    );
  }

  return (
    <div className={summary.demoMode ? "invocation-summary demo" : "invocation-summary"}>
      <div>
        <span>Provider</span>
        <strong>{summary.providerDisplayName ?? summary.providerKey ?? "Not selected"}</strong>
      </div>
      <div>
        <span>Profile</span>
        <strong>{summary.providerProfileKey ?? "Not configured"}</strong>
      </div>
      <div>
        <span>Adapter</span>
        <strong>{summary.adapterKey ?? "Unavailable"}</strong>
      </div>
      <div>
        <span>Prompt</span>
        <strong>{summary.promptVersion ?? "Missing"}</strong>
      </div>
      <div>
        <span>External send</span>
        <strong>{summary.externalSend ? "Yes" : "No"}</strong>
      </div>
      <div>
        <span>Selection</span>
        <strong>{summary.demoMode ? "Demo mode" : summary.selectionMode}</strong>
      </div>
      {summary.model ? (
        <div>
          <span>Model</span>
          <strong>{summary.model}</strong>
        </div>
      ) : null}
      <p>{summary.readinessBlocker ?? summary.selectionNote}</p>
    </div>
  );
}

function TaskRunProvenance({ taskRun, taskRunId }: { taskRun?: TaskRun; taskRunId: string | null }) {
  if (!taskRun) {
    return <small>Task run {taskRunId ?? "not recorded"}</small>;
  }

  const model = readTaskRunModel(taskRun);
  const failureReason = readTaskRunFailureReason(taskRun);

  return (
    <div className="task-run-detail">
      <div>
        <span>Task run</span>
        <strong>{taskRun.id}</strong>
      </div>
      <div>
        <span>Provider</span>
        <strong>{taskRun.providerKey ?? "Not recorded"}</strong>
      </div>
      <div>
        <span>Profile</span>
        <strong>{taskRun.providerProfileKey ?? "Not recorded"}</strong>
      </div>
      <div>
        <span>Prompt</span>
        <strong>{taskRun.promptVersion}</strong>
      </div>
      <div>
        <span>Validation</span>
        <strong>{taskRun.validationStatus ?? "Not recorded"}</strong>
      </div>
      <div>
        <span>Latency</span>
        <strong>{typeof taskRun.latencyMs === "number" ? `${taskRun.latencyMs} ms` : "Not recorded"}</strong>
      </div>
      <div>
        <span>External send</span>
        <strong>{taskRun.externalSend ? "Yes" : "No"}</strong>
      </div>
      {model ? (
        <div>
          <span>Model</span>
          <strong>{model}</strong>
        </div>
      ) : null}
      {failureReason ? <p>{failureReason}</p> : null}
    </div>
  );
}

function providerBlocker(readiness: ProviderReadiness | null) {
  if (!readiness || readiness.ready) {
    return undefined;
  }

  return readiness.checks.find((check) => !check.ready)?.reason ?? "Provider readiness is blocked.";
}

function renderSlotActionBlocker(action: RenderSlotAction | null) {
  if (!action) {
    return "No task action is assigned to this landing area.";
  }
  if (action.ready) {
    return undefined;
  }
  return action.reasons[0]?.message ?? "Task action readiness is blocked.";
}

function taskRouteToDraft(route: TaskRouteSummary): TaskRouteDraft {
  return {
    providerKey: route.providerKey ?? "",
    renderSlot: route.renderSlot,
    hookKey: route.hookKey,
    displayOrder: String(route.displayOrder),
    enabled: route.enabled,
    modelOverride: route.modelOverride ?? "",
    displayLabel: route.displayName,
    displayDescription: route.description ?? ""
  };
}

function updateTaskRouteDraft(
  setDrafts: Dispatch<SetStateAction<Record<string, TaskRouteDraft>>>,
  taskKey: string,
  patch: Partial<TaskRouteDraft>
) {
  setDrafts((current) => ({
    ...current,
    [taskKey]: {
      ...(current[taskKey] ?? {
        providerKey: "",
        renderSlot: "",
        hookKey: "",
        displayOrder: "0",
        enabled: true,
        modelOverride: "",
        displayLabel: "",
        displayDescription: ""
      }),
      ...patch
    }
  }));
}

function settingSourceLabel(source: ProviderSettings["sources"]["registryUrl"] | DatabaseSettings["sources"]["databaseUrl"] | undefined) {
  if (source === "saved") {
    return "Saved in app settings";
  }
  if (source === "local-env") {
    return "Saved in .env";
  }
  if (source === "env") {
    return "Using environment default";
  }
  return "No saved value";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isTaskRunEntry(value: (readonly [string, TaskRun]) | null): value is readonly [string, TaskRun] {
  return Boolean(value);
}

function readTaskRunModel(taskRun: TaskRun): string | null {
  return readNestedString(taskRun.provenance, ["invokeProviderTaskRun", "model"]);
}

function readTaskRunFailureReason(taskRun: TaskRun): string | null {
  return (
    readNestedString(taskRun.provenance, ["invokeProviderTaskRun", "errorMessage"]) ??
    readNestedString(taskRun.provenance, ["invokeProviderTaskRun", "readinessReasons", "0", "message"])
  );
}

function readNestedString(value: unknown, path: string[]): string | null {
  let current = value;
  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
      continue;
    }

    if (!current || typeof current !== "object") {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" && current.trim() ? current : null;
}
