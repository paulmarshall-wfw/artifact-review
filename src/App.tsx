import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusPill } from "./components/StatusPill";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import {
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
  saveDocument,
  setHighlight,
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
  | "file-ingest"
  | "url-ingest"
  | "detail"
  | "edit"
  | "annotation"
  | "question"
  | "evidence"
  | "highlight"
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

    setError(null);
    const response = await runPending("highlight", () => setHighlight(selectedComponent.id, !selectedHighlight?.enabled));
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
              <button disabled={ingestBlocked || isPending("url-ingest")} type="submit">
                {isPending("url-ingest") ? "Ingesting" : "Ingest URL"}
              </button>
            </form>
          </div>
        </section>

        <section className="review-layout" id="review">
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
              <div className="component-list">
                {documentDetail?.components.map((component) => {
                  const isSelected = component.id === selectedComponent?.id;
                  const highlight = documentDetail.review.highlights.find((item) => item.componentId === component.id);
                  const reviewCount =
                    documentDetail.review.annotations.filter((item) => item.componentId === component.id).length +
                    documentDetail.review.questions.filter((item) => item.componentId === component.id).length +
                    documentDetail.review.evidenceSources.filter((item) => item.componentId === component.id).length;
                  return (
                    <button
                      className={isSelected ? "review-component selected" : "review-component"}
                      key={component.id}
                      onClick={() => setSelectedComponentId(component.id)}
                    >
                      <span className="component-text">{component.currentText}</span>
                      <span className="component-meta">
                        {component.kind} · {component.sectionId}
                        {highlight?.enabled ? " · highlighted" : ""}
                        {reviewCount > 0 ? ` · ${reviewCount} review notes` : ""}
                      </span>
                    </button>
                  );
                })}
                {isPending("detail") ? <div className="empty-state">Loading document detail.</div> : null}
              </div>
            </div>
          </div>

          <aside className="detail-panel">
            <div className="panel-heading">
              <div>
                <h2>Component Detail</h2>
                <p>{selectedComponent ? selectedComponent.id : "Select a component."}</p>
              </div>
              <button
                disabled={!selectedComponent || isPending("highlight")}
                onClick={() => reportActionError(handleToggleHighlight)}
              >
                {selectedHighlight?.enabled ? "Unhighlight" : "Highlight"}
              </button>
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
                  <button disabled={isPending("edit")} onClick={() => reportActionError(handleComponentEdit)}>
                    {isPending("edit") ? "Autosaving" : "Autosave Text"}
                  </button>
                  <button disabled={!providerReadiness?.ready} title="Requires provider readiness">
                    AI Suggest
                  </button>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
