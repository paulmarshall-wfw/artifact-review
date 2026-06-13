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
  getDocumentDetail,
  getDocumentWorkflowActions,
  getProviderReadiness,
  getSetupReadiness,
  getWorkflowStatus,
  ingestFile,
  ingestUrl,
  listDocuments,
  rejectAiSuggestion,
  saveDocument,
  setHighlight,
  suggestComponentRevision,
  updateComponentText,
  validateWorkflowDefinition,
  type AutosaveSnapshot,
  type DocumentDetail,
  type DocumentSummary,
  type DocumentWorkflowActions,
  type EvidenceKind,
  type ProviderReadiness,
  type SetupReadiness,
  type WorkflowStatus,
  type WorkflowValidationResult
} from "./lib/api";

const fixtureDefinition = workflowFixture as unknown;
const defaultFileContent =
  "Paste or type text for review. Each sentence becomes a review component. Add enough content to make the workspace useful.";

type PendingKey =
  | "initial"
  | "workflow-validate"
  | "workflow-activate"
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
  | "workflow-action";

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

type ComponentSection = {
  id: string;
  label: string;
  components: DocumentDetail["components"];
};

export function App() {
  const [setupReadiness, setSetupReadiness] = useState<SetupReadiness | null>(null);
  const [providerReadiness, setProviderReadiness] = useState<ProviderReadiness | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [workflowValidation, setWorkflowValidation] = useState<WorkflowValidationResult | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [documentDetail, setDocumentDetail] = useState<DocumentDetail | null>(null);
  const [documentActions, setDocumentActions] = useState<DocumentWorkflowActions | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [componentSearch, setComponentSearch] = useState("");
  const [expandedSectionIds, setExpandedSectionIds] = useState<Set<string>>(() => new Set());
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(true);
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
  const [lastAutosave, setLastAutosave] = useState<AutosaveSnapshot | null>(null);
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
  const selectedDraftChanged = selectedComponent
    ? (componentDrafts[selectedComponent.id] ?? selectedComponent.currentText) !== selectedComponent.currentText
    : false;

  const latestVersion = documentDetail?.versions.at(-1) ?? null;
  const ingestBlocked = !workflowStatus?.active;
  const isPending = useCallback((key: PendingKey) => pending.has(key), [pending]);

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
    const [setup, provider, workflow, documentList] = await Promise.all([
      getSetupReadiness(),
      getProviderReadiness(),
      getWorkflowStatus(),
      listDocuments()
    ]);
    setSetupReadiness(setup);
    setProviderReadiness(provider);
    setWorkflowStatus(workflow);
    setDocuments(documentList.documents);
    setSelectedDocumentId((current) => current ?? documentList.documents[0]?.id ?? null);
  }, []);

  const refreshDetail = useCallback(
    async (documentId: string) => {
      const [detail, actions] = await Promise.all([
        getDocumentDetail(documentId),
        getDocumentWorkflowActions(documentId).catch(() => null)
      ]);
      setDocumentDetail(detail);
      setDocumentActions(actions);
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
    },
    []
  );

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

  async function handleToggleHighlight() {
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    await handleToggleComponentHighlight(selectedComponent.id, !selectedHighlight?.enabled);
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

  async function handleSuggestComponentRevision() {
    if (!selectedComponent || !selectedDocumentId) {
      return;
    }

    setError(null);
    const response = await runPending("ai-suggest", () => suggestComponentRevision(selectedComponent.id));
    setProviderReadiness(response.readiness);
    await refreshDetail(selectedDocumentId);
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

  function handleSelectComponent(componentId: string) {
    setSelectedComponentId(componentId);
    setDetailDrawerOpen(true);
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
    setDetailDrawerOpen(true);
  }

  function expandAllSections() {
    setExpandedSectionIds(new Set(componentSections.map((section) => section.id)));
  }

  function collapseAllSections() {
    setExpandedSectionIds(new Set());
  }

  function reportActionError(action: () => Promise<void>) {
    action().catch((unknownError: unknown) => {
      setError(unknownError instanceof Error ? unknownError.message : "Action failed.");
    });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <div className="brand">Artifact Review</div>
            <div className="version">v0.1.0</div>
          </div>
          <button className="icon-button" aria-label="Toggle theme" title="Toggle theme">
            ◐
          </button>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <a className="nav-item active" href="#review">Review</a>
          <a className="nav-item" href="#workflow">Workflow</a>
          <a className="nav-item" href="#ingest">Ingest</a>
          <a className="nav-item" href="#providers">Providers</a>
        </nav>
        <section className="document-nav" aria-label="Documents">
          <div className="side-heading">Documents</div>
          {documents.length === 0 ? <p className="muted compact">No documents yet.</p> : null}
          {documents.map((document) => (
            <button
              className={document.id === selectedDocumentId ? "document-button selected" : "document-button"}
              key={document.id}
              onClick={() => setSelectedDocumentId(document.id)}
            >
              <span>{document.name}</span>
              <small>{document.currentWorkflowItemRef ?? "No workflow state"}</small>
            </button>
          ))}
        </section>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <div className="page-label">Review Workspace</div>
            <h1>Document Review</h1>
          </div>
          <div className="topbar-actions">
            <StatusPill
              item={{
                key: "workflow",
                label: "Workflow",
                ready: Boolean(workflowStatus?.active),
                reason: workflowStatus?.active ? undefined : "Activate the document workflow before ingest."
              }}
            />
            <button
              disabled={!selectedDocumentId || isPending("save")}
              onClick={() => reportActionError(handleSaveDocument)}
            >
              {isPending("save") ? "Saving" : "Save"}
            </button>
          </div>
        </header>

        <section className="status-strip" aria-live="polite">
          <div className="status-message">
            {error ? <span className="error-text">{error}</span> : null}
            {!error && notice ? <span>{notice}</span> : null}
            {!error && !notice && lastAutosave ? <span>Autosaved {formatDateTime(lastAutosave.createdAt)}</span> : null}
            {!error && !notice && !lastAutosave ? <span>Workspace ready for service-backed review.</span> : null}
          </div>
          <button onClick={() => reportActionError(refreshGlobal)} disabled={isPending("initial")}>
            Refresh
          </button>
        </section>

        <section className="setup-strip" id="workflow">
          <div>
            <strong>Workflow setup</strong>
            <p>Validate the bundled document workflow, then import and activate it before ingesting documents.</p>
          </div>
          <div className="setup-actions">
            <button disabled={isPending("workflow-validate")} onClick={() => reportActionError(handleValidateWorkflow)}>
              {isPending("workflow-validate") ? "Validating" : "Validate Fixture"}
            </button>
            <button disabled={isPending("workflow-activate")} onClick={() => reportActionError(handleActivateWorkflow)}>
              {isPending("workflow-activate") ? "Activating" : "Import And Activate"}
            </button>
          </div>
          <div className="readiness-grid">
            {workflowStatus?.readiness.checks.map((item) => (
              <div className="readiness-item" key={item.key}>
                <span>{item.label}</span>
                <StatusPill item={item} />
              </div>
            ))}
          </div>
          <div className="workflow-summary">
            <dl>
              <dt>Active workflow</dt>
              <dd>{workflowStatus?.workflow ? workflowStatus.workflow.id : "None"}</dd>
              <dt>Definition</dt>
              <dd>{workflowStatus?.workflow ? workflowStatus.workflow.definitionVersion : "Not active"}</dd>
              <dt>Entry state</dt>
              <dd>{workflowStatus?.workflow?.entryStates.join(", ") ?? "Not available"}</dd>
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

        <section className="setup-strip" id="providers">
          <div>
            <strong>Readiness</strong>
            <p>Provider actions remain blocked until registry/profile readiness passes.</p>
          </div>
          <div className="readiness-grid wide">
            {setupReadiness?.checks.map((item) => (
              <div className="readiness-item" key={item.key}>
                <span>{item.label}</span>
                <StatusPill item={item} />
              </div>
            ))}
          </div>
          <div className="readiness-grid wide">
            {providerReadiness?.checks.map((item) => (
              <div className="readiness-item" key={item.key}>
                <span>{item.label}</span>
                <StatusPill item={item} />
              </div>
            ))}
          </div>
        </section>

        <section className="ingest-panel" id="ingest" aria-disabled={ingestBlocked}>
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
              <button disabled={ingestBlocked || isPending("file-ingest")} type="submit">
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
              <button disabled={ingestBlocked || !urlForm.url.trim() || isPending("url-ingest")} type="submit">
                {isPending("url-ingest") ? "Ingesting" : "Ingest URL"}
              </button>
            </form>
          </div>
        </section>

        <section className={detailDrawerOpen ? "review-layout" : "review-layout drawer-collapsed"} id="review">
          <div className="section-list">
            <div className="review-section">
              <div className="section-header">
                <div>
                  <h2>{documentDetail?.document.name ?? "No document selected"}</h2>
                  <p>
                    {documentDetail
                      ? `${documentDetail.components.length} components · version ${latestVersion?.versionNumber ?? 0}`
                      : "Ingest a document to start review."}
                  </p>
                </div>
                <div className="segmented">
                  <span>{documentActions?.currentState ?? documentDetail?.document.currentWorkflowItemRef ?? "No state"}</span>
                  {documentActions?.actions.map((action) => (
                    <button
                      disabled={isPending("workflow-action")}
                      key={action.id}
                      onClick={() => reportActionError(() => handleWorkflowAction(action.id))}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="review-tools">
                <label className="search-field">
                  Search components
                  <input
                    placeholder="Search text, kind, or section"
                    value={componentSearch}
                    onChange={(event) => setComponentSearch(event.target.value)}
                  />
                </label>
                <div className="detail-actions">
                  <button disabled={!selectedComponent} onClick={focusSelectedComponent}>
                    Focus
                  </button>
                  <button disabled={componentSections.length === 0} onClick={expandAllSections}>
                    Expand
                  </button>
                  <button disabled={componentSections.length === 0} onClick={collapseAllSections}>
                    Collapse
                  </button>
                  <button disabled={!selectedComponent} onClick={() => setDetailDrawerOpen((current) => !current)}>
                    {detailDrawerOpen ? "Hide Detail" : "Show Detail"}
                  </button>
                </div>
              </div>
              <div className="component-list">
                {componentSections.map((section) => {
                  const expanded = expandedSectionIds.has(section.id) || Boolean(componentSearch.trim());
                  return (
                    <section className="component-section" key={section.id}>
                      <button className="section-toggle" onClick={() => toggleSection(section.id)}>
                        <span>{section.label}</span>
                        <small>{section.components.length} components</small>
                        <span>{expanded ? "Collapse" : "Expand"}</span>
                      </button>
                      {expanded ? (
                        <div className="component-stack">
                          {section.components.map((component) => {
                            const isSelected = component.id === selectedComponent?.id;
                            const highlight = documentDetail?.review.highlights.find((item) => item.componentId === component.id);
                            const reviewCount = documentDetail
                              ? documentDetail.review.annotations.filter((item) => item.componentId === component.id).length +
                                documentDetail.review.questions.filter((item) => item.componentId === component.id).length +
                                documentDetail.review.evidenceSources.filter((item) => item.componentId === component.id).length
                              : 0;
                            const suggestionCount =
                              documentDetail?.review.aiSuggestions.filter(
                                (item) => item.componentId === component.id && item.status === "proposed"
                              ).length ?? 0;
                            return (
                              <article
                                className={isSelected ? "review-component selected" : "review-component"}
                                key={component.id}
                              >
                                <button className="component-select" onClick={() => handleSelectComponent(component.id)}>
                                  <span className="component-text">{component.currentText}</span>
                                  <span className="component-meta">
                                    {component.kind} · {component.sectionId}
                                    {highlight?.enabled ? " · highlighted" : ""}
                                    {reviewCount > 0 ? ` · ${reviewCount} review notes` : ""}
                                    {suggestionCount > 0 ? ` · ${suggestionCount} AI proposals` : ""}
                                  </span>
                                </button>
                                <div className="component-inline-actions">
                                  <button onClick={() => handleSelectComponent(component.id)}>Detail</button>
                                  <button
                                    disabled={isPending("highlight")}
                                    onClick={() =>
                                      reportActionError(() => handleToggleComponentHighlight(component.id, !highlight?.enabled))
                                    }
                                  >
                                    {highlight?.enabled ? "Unmark" : "Mark"}
                                  </button>
                                </div>
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
                {isPending("detail") ? <div className="empty-state">Loading document detail.</div> : null}
              </div>
            </div>
          </div>

          <aside className={detailDrawerOpen ? "detail-panel" : "detail-panel hidden"} aria-hidden={!detailDrawerOpen}>
            <div className="panel-heading">
              <div>
                <h2>Component Detail</h2>
                <p>{selectedComponent ? selectedComponent.id : "Select a component."}</p>
              </div>
              <div className="detail-actions">
                <button
                  disabled={!selectedComponent || isPending("highlight")}
                  onClick={() => reportActionError(handleToggleHighlight)}
                >
                  {selectedHighlight?.enabled ? "Unhighlight" : "Highlight"}
                </button>
                <button onClick={() => setDetailDrawerOpen(false)}>Close</button>
              </div>
            </div>

            {selectedComponent ? (
              <>
                <label>
                  Current text
                  <textarea
                    rows={8}
                    value={componentDrafts[selectedComponent.id] ?? selectedComponent.currentText}
                    onChange={(event) =>
                      setComponentDrafts((current) => ({ ...current, [selectedComponent.id]: event.target.value }))
                    }
                  />
                </label>
                <div className="detail-actions">
                  {selectedDraftChanged ? <span className="draft-state">Unsaved text draft</span> : null}
                  <button disabled={isPending("edit")} onClick={() => reportActionError(handleComponentEdit)}>
                    {isPending("edit") ? "Autosaving" : "Autosave Text"}
                  </button>
                  <button
                    disabled={!providerReadiness?.ready || isPending("ai-suggest")}
                    title={providerReadiness?.ready ? "Create a proposed AI suggestion" : providerBlocker(providerReadiness)}
                    onClick={() => reportActionError(handleSuggestComponentRevision)}
                  >
                    {isPending("ai-suggest") ? "Suggesting" : "AI Suggest"}
                  </button>
                </div>

                <div className="suggestion-panel">
                  <div className="suggestion-heading">
                    <h3>AI Suggestions</h3>
                    <StatusPill
                      item={{
                        key: "provider-suggestions",
                        label: "Provider",
                        ready: Boolean(providerReadiness?.ready),
                        reason: providerBlocker(providerReadiness)
                      }}
                    />
                  </div>
                  {suggestionsForComponent.length === 0 ? (
                    <p className="muted compact">No proposed suggestions for this component.</p>
                  ) : (
                    <div className="suggestion-list">
                      {suggestionsForComponent.map((suggestion) => (
                        <article className="suggestion-card" key={suggestion.id}>
                          <div className="suggestion-heading">
                            <strong>{suggestion.status}</strong>
                            <span>{Math.round(suggestion.confidence * 100)}%</span>
                          </div>
                          <p>{suggestion.proposedText}</p>
                          <small>{suggestion.rationale}</small>
                          {Array.isArray(suggestion.warnings) && suggestion.warnings.length > 0 ? (
                            <small>Warnings: {suggestion.warnings.join(", ")}</small>
                          ) : null}
                          <small>
                            Task run {suggestion.taskRunId ?? "not recorded"} · {formatDateTime(suggestion.createdAt)}
                          </small>
                          {suggestion.decidedAt ? <small>Decided {formatDateTime(suggestion.decidedAt)}</small> : null}
                          {suggestion.status === "proposed" ? (
                            <div className="suggestion-actions">
                              <button
                                className="primary-button"
                                disabled={selectedDraftChanged || isPending("ai-suggestion-action")}
                                title={
                                  selectedDraftChanged
                                    ? "Save or discard the text draft before accepting this suggestion."
                                    : "Accept this suggestion and create an audited revision."
                                }
                                onClick={() => reportActionError(() => handleAcceptSuggestion(suggestion.id))}
                              >
                                Accept
                              </button>
                              <button
                                disabled={isPending("ai-suggestion-action")}
                                onClick={() => reportActionError(() => handleRejectSuggestion(suggestion.id))}
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="review-note-grid">
                  <label>
                    Annotation
                    <textarea
                      rows={3}
                      value={reviewNoteForm.annotation}
                      onChange={(event) =>
                        setReviewNoteForm((current) => ({ ...current, annotation: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    disabled={!reviewNoteForm.annotation.trim() || isPending("annotation")}
                    onClick={() => reportActionError(handleAddAnnotation)}
                  >
                    Add Annotation
                  </button>

                  <label>
                    Question
                    <textarea
                      rows={3}
                      value={reviewNoteForm.question}
                      onChange={(event) => setReviewNoteForm((current) => ({ ...current, question: event.target.value }))}
                    />
                  </label>
                  <button
                    disabled={!reviewNoteForm.question.trim() || isPending("question")}
                    onClick={() => reportActionError(handleAddQuestion)}
                  >
                    Add Question
                  </button>

                  <label>
                    Evidence kind
                    <select
                      value={reviewNoteForm.evidenceKind}
                      onChange={(event) =>
                        setReviewNoteForm((current) => ({
                          ...current,
                          evidenceKind: event.target.value as EvidenceKind
                        }))
                      }
                    >
                      <option value="source">source</option>
                      <option value="link">link</option>
                      <option value="repo_path">repo_path</option>
                      <option value="screenshot_path">screenshot_path</option>
                      <option value="note">note</option>
                    </select>
                  </label>
                  <label>
                    Evidence
                    <input
                      value={reviewNoteForm.evidenceValue}
                      onChange={(event) =>
                        setReviewNoteForm((current) => ({ ...current, evidenceValue: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    disabled={!reviewNoteForm.evidenceValue.trim() || isPending("evidence")}
                    onClick={() => reportActionError(handleAddEvidence)}
                  >
                    Add Evidence
                  </button>
                </div>

                <div className="review-records">
                  <h3>Review Records</h3>
                  <RecordList
                    emptyLabel="No annotations."
                    records={annotationsForComponent.map((annotation) => annotation.body)}
                  />
                  <RecordList
                    emptyLabel="No questions."
                    records={questionsForComponent.map((question) => `${question.status}: ${question.body}`)}
                  />
                  <RecordList
                    emptyLabel="No evidence."
                    records={evidenceForComponent.map((evidence) => `${evidence.kind}: ${evidence.value}`)}
                  />
                </div>
              </>
            ) : (
              <div className="empty-state">No component loaded.</div>
            )}
          </aside>
        </section>
      </main>
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

function RecordList({ emptyLabel, records }: { emptyLabel: string; records: string[] }) {
  if (records.length === 0) {
    return <p className="muted compact">{emptyLabel}</p>;
  }

  return (
    <ul>
      {records.map((record) => (
        <li key={record}>{record}</li>
      ))}
    </ul>
  );
}

function providerBlocker(readiness: ProviderReadiness | null) {
  if (!readiness || readiness.ready) {
    return undefined;
  }

  return readiness.checks.find((check) => !check.ready)?.reason ?? "Provider readiness is blocked.";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
