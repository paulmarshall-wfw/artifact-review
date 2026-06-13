import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "./components/StatusPill";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import {
  acceptAiSuggestion,
  activateWorkflowDefinition,
  addAnnotation,
  addEvidence,
  addQuestion,
  executeWorkflowAction,
  exportDocument,
  getDocumentDetail,
  getDocumentWorkflowActions,
  getProviderReadiness,
  getProviderReadinessForTask,
  getProviderSettings,
  getSetupReadiness,
  getTaskRun,
  getWorkflowStatus,
  ingestFile,
  ingestUrl,
  listDocuments,
  rejectAiSuggestion,
  saveDocument,
  saveProviderSettings,
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
  type ProviderReadiness,
  type ProviderSettings,
  type SetupReadiness,
  type TaskRun,
  type WorkflowStatus,
  type WorkflowValidationResult
} from "./lib/api";
import { isTauriRuntime, revealExportedFile, selectExportDestination } from "./lib/tauri";

const fixtureDefinition = workflowFixture as unknown;
const suggestComponentRevisionTaskKey = "suggest-component-revision";
const defaultFileContent =
  "Paste or type text for review. Each sentence becomes a review component. Add enough content to make the workspace useful.";

type PendingKey =
  | "initial"
  | "workflow-validate"
  | "workflow-activate"
  | "provider-settings"
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

type AppPage = "review" | "admin";
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
  const [reviewViewMode, setReviewViewMode] = useState<ReviewViewMode>("normal");
  const [selectedInlineTab, setSelectedInlineTab] = useState<InlineReviewTab>("text");
  const [selectedBucketId, setSelectedBucketId] = useState("all");
  const [documentSearch, setDocumentSearch] = useState("");
  const [setupReadiness, setSetupReadiness] = useState<SetupReadiness | null>(null);
  const [providerReadiness, setProviderReadiness] = useState<ProviderReadiness | null>(null);
  const [suggestionReadiness, setSuggestionReadiness] = useState<(ProviderReadiness & { taskKey: string }) | null>(null);
  const [providerSettings, setProviderSettings] = useState<ProviderSettings | null>(null);
  const [providerSettingsForm, setProviderSettingsForm] = useState<ProviderSettingsForm>({
    registryUrl: "",
    selectedProviderProfileKey: "",
    demoProviderMode: false
  });
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

  const refreshGlobal = useCallback(async () => {
    const [setup, provider, suggestionProvider, settings, workflow, documentList] = await Promise.all([
      getSetupReadiness(),
      getProviderReadiness(),
      getProviderReadinessForTask(suggestComponentRevisionTaskKey),
      getProviderSettings(),
      getWorkflowStatus(),
      listDocuments()
    ]);
    setSetupReadiness(setup);
    setProviderReadiness(provider);
    setSuggestionReadiness(suggestionProvider);
    setProviderSettings(settings);
    setProviderSettingsForm({
      registryUrl: settings.registryUrl,
      selectedProviderProfileKey: settings.selectedProviderProfileKey,
      demoProviderMode: settings.demoProviderMode
    });
    setWorkflowStatus(workflow);
    setDocuments(documentList.documents);
    setSelectedDocumentId((current) => current ?? documentList.documents[0]?.id ?? null);
  }, []);

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
    const validation = await runPending("workflow-validate", () => validateWorkflowDefinition(fixtureDefinition));
    setWorkflowValidation(validation);
    setNotice(validation.valid ? "Workflow fixture validated." : "Workflow fixture needs changes before activation.");
  }

  async function handleActivateWorkflow() {
    setError(null);
    setNotice(null);
    await runPending("workflow-activate", () => activateWorkflowDefinition(fixtureDefinition));
    setWorkflowValidation(null);
    await refreshGlobal();
    setNotice("Workflow fixture is active. Ingest is now available.");
  }

  async function handleSaveProviderSettings() {
    setError(null);
    setNotice(null);
    const response = await runPending("provider-settings", () =>
      saveProviderSettings({
        registryUrl: providerSettingsForm.registryUrl.trim() || null,
        selectedProviderProfileKey: providerSettingsForm.selectedProviderProfileKey.trim() || null,
        demoProviderMode: providerSettingsForm.demoProviderMode
      })
    );
    setProviderSettings(response.settings);
    setProviderReadiness(response.readiness);
    setSuggestionReadiness(await getProviderReadinessForTask(suggestComponentRevisionTaskKey));
    setProviderSettingsForm({
      registryUrl: response.settings.registryUrl,
      selectedProviderProfileKey: response.settings.selectedProviderProfileKey,
      demoProviderMode: response.settings.demoProviderMode
    });
    await refreshGlobal();
    setNotice("Provider settings saved.");
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
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("ai-suggest", () => suggestComponentRevision(selectedComponent.id));
    setSuggestionReadiness({ ...response.readiness, taskKey: suggestComponentRevisionTaskKey });
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

  const pageName = activePage === "review" ? "Document Review" : "Admin / Setup";

  return (
    <div className={`app-shell ${activePage === "review" ? "review-page-shell" : "admin-page-shell"} ${reviewViewMode === "focus" ? "focus-mode" : ""}`}>
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
              className={activePage === "admin" ? "nav-tab active" : "nav-tab"}
              type="button"
              onClick={() => setActivePage("admin")}
            >
              Admin / Setup
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
                <span>Review can continue for existing documents, but ingest is handled from Admin / Setup after activation.</span>
                <button className="btn btn-secondary" type="button" onClick={() => setActivePage("admin")}>
                  Open Admin / Setup
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
        <main className="admin-workspace">
          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <h2>Workflow Setup</h2>
                <p>Validate the bundled document workflow, then import and activate it before ingesting documents.</p>
              </div>
              <div className="setup-actions">
                <button className="btn btn-secondary" disabled={isPending("workflow-validate")} type="button" onClick={() => reportActionError(handleValidateWorkflow)}>
                  {isPending("workflow-validate") ? "Validating" : "Validate Fixture"}
                </button>
                <button className="btn btn-primary" disabled={isPending("workflow-activate")} type="button" onClick={() => reportActionError(handleActivateWorkflow)}>
                  {isPending("workflow-activate") ? "Activating" : "Import And Activate"}
                </button>
              </div>
            </div>
            <ReadinessGrid checks={workflowStatus?.readiness.checks ?? []} />
            <div className="workflow-summary">
              <dl>
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
          </section>

          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <h2>Readiness</h2>
                <p>Setup and provider checks determine whether provider-backed review actions can run.</p>
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
          </section>

          <section className="admin-panel">
            <div className="panel-heading">
              <div>
                <h2>Provider Settings</h2>
                <p>Configure durable provider runtime defaults for this app.</p>
              </div>
            </div>
            <form
              className="provider-settings-form"
              onSubmit={(event) => {
                event.preventDefault();
                reportActionError(handleSaveProviderSettings);
              }}
            >
              <label>
                Registry URL
                <input
                  value={providerSettingsForm.registryUrl}
                  onChange={(event) =>
                    setProviderSettingsForm((current) => ({ ...current, registryUrl: event.target.value }))
                  }
                  placeholder="http://127.0.0.1:5181"
                />
                <small>{settingSourceLabel(providerSettings?.sources.registryUrl)}</small>
              </label>
              <label>
                Profile
                <input
                  value={providerSettingsForm.selectedProviderProfileKey}
                  onChange={(event) =>
                    setProviderSettingsForm((current) => ({
                      ...current,
                      selectedProviderProfileKey: event.target.value
                    }))
                  }
                  placeholder="profile-key"
                />
                <small>{settingSourceLabel(providerSettings?.sources.selectedProviderProfileKey)}</small>
              </label>
              <label className="inline-check">
                <input
                  checked={providerSettingsForm.demoProviderMode}
                  type="checkbox"
                  onChange={(event) =>
                    setProviderSettingsForm((current) => ({ ...current, demoProviderMode: event.target.checked }))
                  }
                />
                Demo mode
              </label>
              <button className="btn btn-primary" disabled={isPending("provider-settings")} type="submit">
                {isPending("provider-settings") ? "Saving" : "Save Settings"}
              </button>
            </form>
            <div className="settings-summary">
              <div>
                <span>Registry source</span>
                <strong>{settingSourceLabel(providerSettings?.sources.registryUrl)}</strong>
              </div>
              <div>
                <span>Profile source</span>
                <strong>{settingSourceLabel(providerSettings?.sources.selectedProviderProfileKey)}</strong>
              </div>
              <div>
                <span>Demo mode</span>
                <strong>{providerSettingsForm.demoProviderMode ? "Enabled" : "Disabled"}</strong>
              </div>
            </div>
          </section>

          <section className="admin-panel ingest-panel" aria-disabled={ingestBlocked}>
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
                  reportActionError(handleFileIngest);
                }}
              >
                <label>
                  Select file
                  <input
                    accept=".txt,.md,.html,.htm,text/plain,text/markdown,text/html"
                    disabled={ingestBlocked || isPending("file-read")}
                    type="file"
                    onChange={(event) => reportActionError(() => handleSelectedFile(event.currentTarget.files?.[0] ?? null))}
                  />
                </label>
                <label>
                  Name
                  <input
                    disabled={ingestBlocked}
                    value={fileForm.name}
                    onChange={(event) => setFileForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label>
                  Format
                  <select
                    disabled={ingestBlocked}
                    value={fileForm.format}
                    onChange={(event) =>
                      setFileForm((current) => ({
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
                    onChange={(event) => setFileForm((current) => ({ ...current, content: event.target.value }))}
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
                  reportActionError(handleUrlIngest);
                }}
              >
                <label>
                  URL
                  <input
                    disabled={ingestBlocked}
                    placeholder="https://example.com"
                    value={urlForm.url}
                    onChange={(event) => setUrlForm((current) => ({ ...current, url: event.target.value }))}
                  />
                </label>
                <label>
                  Name
                  <input
                    disabled={ingestBlocked}
                    placeholder="Optional"
                    value={urlForm.name}
                    onChange={(event) => setUrlForm((current) => ({ ...current, name: event.target.value }))}
                  />
                </label>
                <label className="full-span">
                  Snapshot HTML
                  <textarea
                    disabled={ingestBlocked}
                    rows={6}
                    placeholder="Optional captured HTML. Leave blank to fetch the URL."
                    value={urlForm.snapshotHtml}
                    onChange={(event) => setUrlForm((current) => ({ ...current, snapshotHtml: event.target.value }))}
                  />
                </label>
                <button className="btn btn-primary" disabled={ingestBlocked || !urlForm.url.trim() || isPending("url-ingest")} type="submit">
                  {isPending("url-ingest") ? "Ingesting" : "Ingest URL"}
                </button>
              </form>
            </div>
          </section>
        </main>
      )}
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
              disabled={!suggestionReady || isPending("ai-suggest")}
              title={suggestionReady ? "Create a proposed AI suggestion" : providerBlocker(suggestionReadiness)}
              type="button"
              onClick={() => reportActionError(onSuggest)}
            >
              {isPending("ai-suggest") ? "Suggesting" : "AI Suggest"}
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

function settingSourceLabel(source: ProviderSettings["sources"]["registryUrl"] | undefined) {
  if (source === "saved") {
    return "Saved in app settings";
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
