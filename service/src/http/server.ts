import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import cors from "cors";
import express from "express";
import type pg from "pg";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { buildSameFormatExport, ExportAssemblyError } from "../domain/exporter.js";
import { checkDatabase } from "../db/pool.js";
import { combineReadiness } from "../domain/readiness.js";
import { parseHtmlToComponents, parseMarkdownToComponents, parsePlainTextToComponents } from "../domain/parser.js";
import { buildProviderReadiness, resolveSelectedProfileSelection, selectProviderForTask } from "../providers/readiness.js";
import { fetchRegistryLookup } from "../providers/registry.js";
import { suggestComponentRevisionOutputSchema } from "../providers/tasks.js";
import type { DocumentSummary, ReviewComponent } from "../repositories/documents.js";
import { createRepositories, type Repositories } from "../repositories/index.js";
import type { ProviderTaskAsset } from "../repositories/providerTasks.js";
import type { ReviewComponentForMutation } from "../repositories/review.js";
import type { JsonValue } from "../repositories/types.js";
import {
  findWorkflowAction,
  getAllowedWorkflowActions,
  getEntryState,
  summarizeWorkflowDefinition,
  validateDocumentWorkflowDefinition
} from "../workflow/definition.js";
import { buildWorkflowReadiness } from "../workflow/readiness.js";

const fileIngestRequestSchema = z.object({
  name: z.string().min(1),
  format: z.enum(["txt", "md", "html", "htm"]),
  content: z.string().min(1)
});

const urlIngestRequestSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).optional(),
  snapshotHtml: z.string().min(1).optional()
});

const componentEditRequestSchema = z.object({
  currentText: z.string().min(1),
  editSource: z.enum(["manual", "accepted_ai_suggestion"]).default("manual")
});

const annotationRequestSchema = z.object({
  body: z.string().min(1)
});

const questionRequestSchema = z.object({
  body: z.string().min(1)
});

const evidenceRequestSchema = z.object({
  kind: z.enum(["source", "link", "repo_path", "screenshot_path", "note"]),
  value: z.string().min(1)
});

const highlightRequestSchema = z.object({
  enabled: z.boolean()
});

const suggestComponentRevisionTaskKey = "suggest-component-revision";

const exportDocumentRequestSchema = z.object({
  destinationPath: z.string().min(1).optional(),
  includeReviewBundle: z.boolean().default(false)
});

function toSafeJson(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

async function createMutationAutosave(
  repositories: Repositories,
  action: string,
  component: ReviewComponentForMutation,
  payload: JsonValue
) {
  return repositories.review.createAutosaveSnapshot(
    component.documentId,
    toSafeJson({
      action,
      documentId: component.documentId,
      componentId: component.id,
      component: {
        id: component.id,
        kind: component.kind,
        sectionId: component.sectionId,
        sourceRange: component.sourceRange,
        currentText: component.currentText,
        originalTextHash: component.originalTextHash
      },
      payload
    })
  );
}

async function getComponentForMutation(repositories: Repositories, componentId: string) {
  return repositories.review.getComponent(componentId);
}

async function buildProviderContext(
  config: AppConfig,
  repositories: Repositories | null,
  taskKey: string = suggestComponentRevisionTaskKey
) {
  const selectedProviderProfileKey = await repositories?.appSettings.getSelectedProviderProfileKey();
  const settings = { selectedProviderProfileKey };
  const selection = resolveSelectedProfileSelection(config, settings);
  const taskAsset = repositories ? await repositories.providerTasks.getTaskAsset(taskKey) : null;
  const registry =
    config.INVOKE_PROVIDERS_REGISTRY_URL && selection.profileKey
      ? await fetchRegistryLookup(config, selection.profileKey)
      : undefined;
  const readiness = buildProviderReadiness(config, settings, {
    taskKey,
    taskAsset,
    registry,
    secretEnv: process.env
  });
  const provider = selectProviderForTask(registry?.providers ?? [], taskAsset);

  return {
    readiness,
    selectedProfileKey: selection.profileKey,
    selectedProfileSource: selection.source,
    taskAsset,
    registry,
    provider
  };
}

async function buildReviewStateSnapshot(
  repositories: Repositories,
  document: DocumentSummary,
  components: ReviewComponent[],
  previousVersionNumber: number
): Promise<JsonValue> {
  const [annotations, questions, evidenceSources, highlights] = await Promise.all([
    repositories.review.listAnnotations(document.id),
    repositories.review.listQuestions(document.id),
    repositories.review.listEvidenceSources(document.id),
    repositories.review.listHighlights(document.id)
  ]);

  return toSafeJson({
    snapshotType: "review-state",
    document: {
      id: document.id,
      name: document.name,
      sourceType: document.sourceType,
      originalFormat: document.originalFormat,
      currentWorkflowItemRef: document.currentWorkflowItemRef
    },
    previousVersionNumber,
    componentCount: components.length,
    components: components.map((component) => ({
      id: component.id,
      kind: component.kind,
      sectionId: component.sectionId,
      sourceRange: component.sourceRange,
      currentText: component.currentText,
      originalTextHash: component.originalTextHash
    })),
    annotations,
    questions,
    evidenceSources,
    highlights
  });
}

function reviewBundlePathForDestination(destinationPath: string): string {
  const parsedPath = path.parse(destinationPath);
  return path.join(parsedPath.dir, `${parsedPath.name}.review-bundle.json`);
}

async function writeExportFiles(
  destinationPath: string,
  exportContent: string,
  reviewBundleContent: string | null
): Promise<{ exportPath: string; reviewBundlePath: string | null }> {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, exportContent, "utf8");

  if (!reviewBundleContent) {
    return {
      exportPath: destinationPath,
      reviewBundlePath: null
    };
  }

  const reviewBundlePath = reviewBundlePathForDestination(destinationPath);
  await writeFile(reviewBundlePath, reviewBundleContent, "utf8");

  return {
    exportPath: destinationPath,
    reviewBundlePath
  };
}

function buildDemoSuggestComponentRevisionOutput(
  component: ReviewComponentForMutation,
  taskAsset: ProviderTaskAsset | null
) {
  const normalizedText = component.currentText.replace(/\s+/g, " ").trim();
  const proposedText = normalizeSuggestionText(normalizedText);
  const changed = proposedText !== component.currentText;

  return {
    proposedText,
    rationale: changed
      ? "Proposed a clearer review revision while preserving the component meaning."
      : "No substantive rewrite was needed; the proposal preserves the current component text.",
    confidence: changed ? 0.78 : 0.62,
    sourceComponentId: component.id,
    warnings: taskAsset?.schema ? [] : ["Structured output schema was unavailable during generation."]
  };
}

function normalizeSuggestionText(value: string): string {
  const simplified = value
    .replace(/\bin order to\b/gi, "to")
    .replace(/\butilize\b/gi, "use")
    .replace(/\bUtilize\b/g, "Use");

  if (!simplified) {
    return value;
  }

  return /[.!?]$/.test(simplified) ? simplified : `${simplified}.`;
}

function parseFileContent(format: "txt" | "md" | "html" | "htm", content: string) {
  if (format === "html" || format === "htm") {
    const components = parseHtmlToComponents(content);
    return {
      components,
      parserMetadata: {
        parser: "html-components",
        componentCount: components.length
      }
    };
  }

  if (format === "md") {
    const components = parseMarkdownToComponents(content);
    return {
      components,
      parserMetadata: {
        parser: "markdown-components",
        componentCount: components.length
      }
    };
  }

  const components = parsePlainTextToComponents(content);
  return {
    components,
    parserMetadata: {
      parser: "plain-text-sentences",
      componentCount: components.length
    }
  };
}

function parseUrlSnapshotContent(
  url: string,
  content: string,
  snapshotSource: "provided" | "fetched",
  fetchMetadata: { status?: number; contentType?: string; finalUrl?: string } = {}
) {
  const components = parseHtmlToComponents(content);
  return {
    components,
    parserMetadata: {
      parser: "url-html-snapshot",
      componentCount: components.length,
      sourceUrl: url,
      snapshotSource,
      ...fetchMetadata
    }
  };
}

function validateHttpUrl(url: string): URL | null {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:" ? parsedUrl : null;
  } catch {
    return null;
  }
}

async function fetchUrlSnapshot(url: string): Promise<{
  content: string;
  metadata: {
    status: number;
    contentType: string;
    finalUrl: string;
  };
}> {
  const fetchResponse = await fetch(url, {
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1"
    }
  });
  const content = await fetchResponse.text();

  if (!fetchResponse.ok) {
    throw new Error(`URL snapshot request failed with HTTP ${fetchResponse.status}.`);
  }

  return {
    content,
    metadata: {
      status: fetchResponse.status,
      contentType: fetchResponse.headers.get("content-type") ?? "",
      finalUrl: fetchResponse.url || url
    }
  };
}

export function createServer(config: AppConfig, pool: pg.Pool | null) {
  const app = express();
  const repositories = pool ? createRepositories(pool) : null;

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "artifact-review-service",
      version: "0.1.0"
    });
  });

  app.get("/ready", async (_request, response) => {
    const database = await checkDatabase(pool);
    response.status(database.ready ? 200 : 503).json(database);
  });

  app.get("/api/setup-readiness", async (_request, response) => {
    const database = await checkDatabase(pool);
    const activeWorkflow = await repositories?.workflows.getActiveDocumentWorkflow();
    const provider = await buildProviderContext(config, repositories);
    const workflow = buildWorkflowReadiness(Boolean(activeWorkflow));

    response.json(
      combineReadiness([
        { key: "database", label: "Database", ready: database.ready, reason: database.reason },
        ...provider.readiness.checks,
        ...workflow.checks
      ])
    );
  });

  app.get("/api/workflow/status", async (_request, response) => {
    const activeWorkflow = await repositories?.workflows.getActiveDocumentWorkflow();

    response.json({
      active: Boolean(activeWorkflow),
      workflow: activeWorkflow ? summarizeWorkflowDefinition(activeWorkflow) : null,
      readiness: buildWorkflowReadiness(Boolean(activeWorkflow))
    });
  });

  app.post("/api/workflow/definitions/validate", (request, response) => {
    const validation = validateDocumentWorkflowDefinition(request.body);

    response.status(validation.valid ? 200 : 422).json(
      validation.valid
        ? {
            valid: true,
            workflow: summarizeWorkflowDefinition(validation.definition)
          }
        : validation
    );
  });

  app.post("/api/workflow/activate", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before activating a document workflow."
      });
      return;
    }

    const validation = validateDocumentWorkflowDefinition(request.body);
    if (!validation.valid) {
      response.status(422).json(validation);
      return;
    }

    await repositories.workflows.setActiveDocumentWorkflow(validation.definition);
    response.json({
      active: true,
      workflow: summarizeWorkflowDefinition(validation.definition),
      initialState: getEntryState(validation.definition)
    });
  });

  app.get("/api/provider-readiness", async (_request, response) => {
    const provider = await buildProviderContext(config, repositories);
    response.json(provider.readiness);
  });

  app.get("/api/provider-readiness/tasks/:taskKey", async (request, response) => {
    const provider = await buildProviderContext(config, repositories, request.params.taskKey);
    response.json({
      taskKey: request.params.taskKey,
      ...provider.readiness
    });
  });

  app.get("/api/documents", async (_request, response) => {
    if (!repositories) {
      response.json({ documents: [] });
      return;
    }

    response.json({ documents: await repositories.documents.listDocuments() });
  });

  app.get("/api/documents/:documentId", async (request, response) => {
    if (!repositories) {
      response.status(404).json({
        error: "document_not_found",
        documentId: request.params.documentId
      });
      return;
    }

    const document = await repositories.documents.getDocument(request.params.documentId);
    if (!document) {
      response.status(404).json({
        error: "document_not_found",
        documentId: request.params.documentId
      });
      return;
    }

    response.json({
      document,
      versions: await repositories.documents.getDocumentVersions(document.id),
      components: await repositories.documents.getReviewComponents(document.id),
      review: {
        annotations: await repositories.review.listAnnotations(document.id),
        questions: await repositories.review.listQuestions(document.id),
        evidenceSources: await repositories.review.listEvidenceSources(document.id),
        highlights: await repositories.review.listHighlights(document.id),
        aiSuggestions: await repositories.aiSuggestions.listSuggestionsForDocument(document.id)
      }
    });
  });

  app.get("/api/workflow/documents/:documentId/actions", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before reading document workflow actions."
      });
      return;
    }

    const [document, activeWorkflow] = await Promise.all([
      repositories.documents.getDocument(request.params.documentId),
      repositories.workflows.getActiveDocumentWorkflow()
    ]);

    if (!document) {
      response.status(404).json({
        error: "document_not_found",
        documentId: request.params.documentId
      });
      return;
    }

    if (!activeWorkflow) {
      response.status(409).json({
        error: "workflow_not_configured",
        message: "Import or activate a user-provided document workflow before reading document actions."
      });
      return;
    }

    const currentState = document.currentWorkflowItemRef ?? getEntryState(activeWorkflow);
    response.json({
      documentId: document.id,
      currentState,
      actions: getAllowedWorkflowActions(activeWorkflow, currentState)
    });
  });

  app.post("/api/workflow/documents/:documentId/actions/:actionId", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before executing document workflow actions."
      });
      return;
    }

    const [document, activeWorkflow] = await Promise.all([
      repositories.documents.getDocument(request.params.documentId),
      repositories.workflows.getActiveDocumentWorkflow()
    ]);

    if (!document) {
      response.status(404).json({
        error: "document_not_found",
        documentId: request.params.documentId
      });
      return;
    }

    if (!activeWorkflow) {
      response.status(409).json({
        error: "workflow_not_configured",
        message: "Import or activate a user-provided document workflow before executing document actions."
      });
      return;
    }

    const currentState = document.currentWorkflowItemRef ?? getEntryState(activeWorkflow);
    const action = findWorkflowAction(activeWorkflow, currentState, request.params.actionId);
    if (!action) {
      response.status(409).json({
        error: "workflow_action_not_allowed",
        documentId: document.id,
        currentState,
        actionId: request.params.actionId
      });
      return;
    }

    const updatedDocument = await repositories.documents.updateDocumentWorkflowState(document.id, action.to);
    response.json({
      document: updatedDocument,
      transition: {
        actionId: action.id,
        from: action.from,
        to: action.to
      },
      actions: getAllowedWorkflowActions(activeWorkflow, action.to)
    });
  });

  app.post("/api/ingest/file", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before ingesting files."
      });
      return;
    }

    const activeWorkflow = await repositories.workflows.getActiveDocumentWorkflow();
    if (!activeWorkflow) {
      response.status(409).json({
        error: "workflow_not_configured",
        message: "Import or activate a user-provided document workflow before ingest."
      });
      return;
    }

    const parsedRequest = fileIngestRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_ingest_file_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const parsedFile = parseFileContent(parsedRequest.data.format, parsedRequest.data.content);
    const parsedComponents = parsedFile.components;
    if (parsedComponents.length === 0) {
      response.status(422).json({
        error: "no_reviewable_components",
        message: "The file content did not contain reviewable text components."
      });
      return;
    }

    const initialState = getEntryState(activeWorkflow);
    const document = await repositories.documents.createDocument({
      name: parsedRequest.data.name,
      sourceType: "file",
      originalFormat: parsedRequest.data.format,
      currentWorkflowItemRef: initialState
    });
    const version = await repositories.documents.createDocumentVersion({
      documentId: document.id,
      versionNumber: 1,
      sourceSnapshot: parsedRequest.data.content,
      currentSnapshot: parsedRequest.data.content,
      parserMetadata: parsedFile.parserMetadata
    });
    const components = await repositories.documents.createReviewComponents(
      parsedComponents.map((component) => ({
        id: component.id,
        documentId: document.id,
        kind: component.kind,
        sectionId: component.sectionId,
        sourceRange: component.sourceRange,
        currentText: component.text,
        originalTextHash: component.originalTextHash
      }))
    );

    response.status(201).json({
      document,
      version,
      components,
      workflow: {
        currentState: initialState,
        actions: getAllowedWorkflowActions(activeWorkflow, initialState)
      }
    });
  });

  app.post("/api/ingest/url", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before ingesting URL snapshots."
      });
      return;
    }

    const activeWorkflow = await repositories.workflows.getActiveDocumentWorkflow();
    if (!activeWorkflow) {
      response.status(409).json({
        error: "workflow_not_configured",
        message: "Import or activate a user-provided document workflow before ingest."
      });
      return;
    }

    const parsedRequest = urlIngestRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_ingest_url_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const parsedUrl = validateHttpUrl(parsedRequest.data.url);
    if (!parsedUrl) {
      response.status(422).json({
        error: "invalid_ingest_url_request",
        issues: ["url: URL must use http or https."]
      });
      return;
    }

    let snapshotContent = parsedRequest.data.snapshotHtml;
    let snapshotSource: "provided" | "fetched" = "provided";
    let fetchMetadata: { status?: number; contentType?: string; finalUrl?: string } = {};

    if (!snapshotContent) {
      snapshotSource = "fetched";
      try {
        const snapshot = await fetchUrlSnapshot(parsedUrl.toString());
        snapshotContent = snapshot.content;
        fetchMetadata = snapshot.metadata;
      } catch (error) {
        response.status(502).json({
          error: "url_snapshot_fetch_failed",
          url: parsedUrl.toString(),
          message: error instanceof Error ? error.message : "URL snapshot request failed."
        });
        return;
      }
    }

    const parsedSnapshot = parseUrlSnapshotContent(parsedUrl.toString(), snapshotContent, snapshotSource, fetchMetadata);
    const parsedComponents = parsedSnapshot.components;
    if (parsedComponents.length === 0) {
      response.status(422).json({
        error: "no_reviewable_components",
        message: "The URL snapshot did not contain reviewable text components."
      });
      return;
    }

    const initialState = getEntryState(activeWorkflow);
    const document = await repositories.documents.createDocument({
      name: parsedRequest.data.name ?? parsedUrl.toString(),
      sourceType: "url",
      originalFormat: "url_snapshot",
      currentWorkflowItemRef: initialState
    });
    const version = await repositories.documents.createDocumentVersion({
      documentId: document.id,
      versionNumber: 1,
      sourceSnapshot: snapshotContent,
      currentSnapshot: snapshotContent,
      parserMetadata: parsedSnapshot.parserMetadata
    });
    const components = await repositories.documents.createReviewComponents(
      parsedComponents.map((component) => ({
        id: component.id,
        documentId: document.id,
        kind: component.kind,
        sectionId: component.sectionId,
        sourceRange: component.sourceRange,
        currentText: component.text,
        originalTextHash: component.originalTextHash
      }))
    );

    response.status(201).json({
      document,
      version,
      components,
      workflow: {
        currentState: initialState,
        actions: getAllowedWorkflowActions(activeWorkflow, initialState)
      }
    });
  });

  app.patch("/api/components/:componentId", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before editing review components."
      });
      return;
    }

    const parsedRequest = componentEditRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_component_edit_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const result = await repositories.review.updateComponentText(
      request.params.componentId,
      parsedRequest.data.currentText,
      parsedRequest.data.editSource
    );
    if (!result) {
      response.status(404).json({
        error: "component_not_found",
        componentId: request.params.componentId
      });
      return;
    }

    const autosave = await createMutationAutosave(repositories, "component_text_edited", result.component, {
      revisionId: result.revision.id,
      previousText: result.revision.previousText,
      revisedText: result.revision.revisedText,
      editSource: result.revision.editSource
    });

    response.json({
      component: result.component,
      revision: result.revision,
      autosave
    });
  });

  app.post("/api/components/:componentId/annotations", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before adding annotations."
      });
      return;
    }

    const parsedRequest = annotationRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_annotation_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const component = await getComponentForMutation(repositories, request.params.componentId);
    if (!component) {
      response.status(404).json({
        error: "component_not_found",
        componentId: request.params.componentId
      });
      return;
    }

    const annotation = await repositories.review.createAnnotation(component.id, parsedRequest.data.body);
    const autosave = await createMutationAutosave(repositories, "annotation_added", component, {
      annotationId: annotation.id,
      body: annotation.body
    });

    response.status(201).json({ annotation, autosave });
  });

  app.post("/api/components/:componentId/questions", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before adding questions."
      });
      return;
    }

    const parsedRequest = questionRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_question_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const component = await getComponentForMutation(repositories, request.params.componentId);
    if (!component) {
      response.status(404).json({
        error: "component_not_found",
        componentId: request.params.componentId
      });
      return;
    }

    const question = await repositories.review.createQuestion(component.id, parsedRequest.data.body);
    const autosave = await createMutationAutosave(repositories, "question_added", component, {
      questionId: question.id,
      body: question.body,
      status: question.status
    });

    response.status(201).json({ question, autosave });
  });

  app.post("/api/components/:componentId/evidence", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before adding evidence."
      });
      return;
    }

    const parsedRequest = evidenceRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_evidence_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const component = await getComponentForMutation(repositories, request.params.componentId);
    if (!component) {
      response.status(404).json({
        error: "component_not_found",
        componentId: request.params.componentId
      });
      return;
    }

    const evidence = await repositories.review.createEvidenceSource(
      component.id,
      parsedRequest.data.kind,
      parsedRequest.data.value
    );
    const autosave = await createMutationAutosave(repositories, "evidence_added", component, {
      evidenceId: evidence.id,
      kind: evidence.kind,
      value: evidence.value
    });

    response.status(201).json({ evidence, autosave });
  });

  app.patch("/api/components/:componentId/highlight", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before updating highlights."
      });
      return;
    }

    const parsedRequest = highlightRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_highlight_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const component = await getComponentForMutation(repositories, request.params.componentId);
    if (!component) {
      response.status(404).json({
        error: "component_not_found",
        componentId: request.params.componentId
      });
      return;
    }

    const highlight = await repositories.review.setHighlight(component.id, parsedRequest.data.enabled);
    const autosave = await createMutationAutosave(repositories, "highlight_updated", component, {
      enabled: highlight.enabled
    });

    response.json({ highlight, autosave });
  });

  app.post("/api/documents/:documentId/save", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before saving documents."
      });
      return;
    }

    const document = await repositories.documents.getDocument(request.params.documentId);
    if (!document) {
      response.status(404).json({
        error: "document_not_found",
        documentId: request.params.documentId
      });
      return;
    }

    const versions = await repositories.documents.getDocumentVersions(document.id);
    const sourceVersion = versions[0];
    if (!sourceVersion) {
      response.status(409).json({
        error: "document_version_missing",
        documentId: document.id,
        message: "The document has no imported source version to preserve."
      });
      return;
    }

    const previousVersionNumber = versions.reduce(
      (highest, version) => Math.max(highest, version.versionNumber),
      sourceVersion.versionNumber
    );
    const components = await repositories.documents.getReviewComponents(document.id);
    const snapshot = await buildReviewStateSnapshot(repositories, document, components, previousVersionNumber);
    const version = await repositories.documents.createDocumentVersion({
      documentId: document.id,
      versionNumber: previousVersionNumber + 1,
      sourceSnapshot: sourceVersion.sourceSnapshot,
      currentSnapshot: JSON.stringify(snapshot, null, 2),
      parserMetadata: {
        parser: "review-state-snapshot",
        savedFrom: "document-save",
        previousVersionNumber,
        componentCount: components.length
      }
    });

    response.status(201).json({
      document,
      version,
      snapshot: {
        type: "review-state",
        componentCount: components.length,
        previousVersionNumber
      }
    });
  });

  app.post("/api/documents/:documentId/export", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before exporting documents."
      });
      return;
    }

    const parsedRequest = exportDocumentRequestSchema.safeParse(request.body ?? {});
    if (!parsedRequest.success) {
      response.status(422).json({
        error: "invalid_export_request",
        issues: parsedRequest.error.issues.map((issue) => `${issue.path.join(".") || "request"}: ${issue.message}`)
      });
      return;
    }

    const document = await repositories.documents.getDocument(request.params.documentId);
    if (!document) {
      response.status(404).json({
        error: "document_not_found",
        documentId: request.params.documentId
      });
      return;
    }

    const [versions, components, annotations, questions, evidenceSources, highlights, aiSuggestions] = await Promise.all([
      repositories.documents.getDocumentVersions(document.id),
      repositories.documents.getReviewComponents(document.id),
      repositories.review.listAnnotations(document.id),
      repositories.review.listQuestions(document.id),
      repositories.review.listEvidenceSources(document.id),
      repositories.review.listHighlights(document.id),
      repositories.aiSuggestions.listSuggestionsForDocument(document.id)
    ]);

    let exportResult;
    try {
      exportResult = buildSameFormatExport({
        document,
        versions,
        components,
        review: {
          annotations,
          questions,
          evidenceSources,
          highlights,
          aiSuggestions
        }
      });
    } catch (error) {
      if (error instanceof ExportAssemblyError) {
        response.status(409).json({
          error: "export_assembly_failed",
          documentId: document.id,
          message: error.message
        });
        return;
      }

      throw error;
    }

    const reviewBundleContent = parsedRequest.data.includeReviewBundle ? exportResult.reviewBundle.content : null;
    const writtenPaths = parsedRequest.data.destinationPath
      ? await writeExportFiles(parsedRequest.data.destinationPath, exportResult.content, reviewBundleContent)
      : null;

    response.status(201).json({
      document,
      written: Boolean(writtenPaths),
      export: {
        format: exportResult.format,
        fileName: exportResult.fileName,
        contentType: exportResult.contentType,
        byteLength: Buffer.byteLength(exportResult.content, "utf8"),
        path: writtenPaths?.exportPath ?? null,
        content: writtenPaths ? undefined : exportResult.content
      },
      reviewBundle: parsedRequest.data.includeReviewBundle
        ? {
            fileName: exportResult.reviewBundle.fileName,
            contentType: exportResult.reviewBundle.contentType,
            byteLength: Buffer.byteLength(exportResult.reviewBundle.content, "utf8"),
            path: writtenPaths?.reviewBundlePath ?? null,
            content: writtenPaths ? undefined : exportResult.reviewBundle.content
          }
        : null
    });
  });

  app.post("/api/components/:componentId/ai-suggestions", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before requesting provider-backed suggestions."
      });
      return;
    }

    const providerContext = await buildProviderContext(config, repositories, suggestComponentRevisionTaskKey);
    const readiness = providerContext.readiness;
    if (!readiness.ready) {
      response.status(409).json({
        error: "provider_not_ready",
        componentId: request.params.componentId,
        readiness
      });
      return;
    }

    const component = await repositories.review.getComponent(request.params.componentId);
    if (!component) {
      response.status(404).json({
        error: "component_not_found",
        componentId: request.params.componentId
      });
      return;
    }

    const startedAt = Date.now();
    const providerOutput = buildDemoSuggestComponentRevisionOutput(component, providerContext.taskAsset);
    const parsedOutput = suggestComponentRevisionOutputSchema.safeParse(providerOutput);
    if (!parsedOutput.success || parsedOutput.data.sourceComponentId !== component.id) {
      const taskRun = await repositories.taskRuns.createTaskRun({
        taskKey: suggestComponentRevisionTaskKey,
        providerKey: providerContext.provider?.providerKey ?? "artifact-review-demo",
        providerProfileKey: providerContext.selectedProfileKey ?? "demo",
        promptVersion: providerContext.taskAsset?.promptVersion ?? "0.1.0",
        status: "failed",
        validationStatus: "invalid",
        externalSend: providerContext.provider?.externalSend ?? false,
        latencyMs: Date.now() - startedAt,
        provenance: toSafeJson({
          providerRuntime: "deterministic-demo",
          selectedProfileSource: providerContext.selectedProfileSource,
          failure: parsedOutput.success ? "source_component_mismatch" : "output_validation_failed"
        })
      });
      response.status(502).json({
        error: "provider_output_invalid",
        componentId: component.id,
        taskRun
      });
      return;
    }

    const output = parsedOutput.data;
    const taskRun = await repositories.taskRuns.createTaskRun({
      taskKey: suggestComponentRevisionTaskKey,
      providerKey: providerContext.provider?.providerKey ?? "artifact-review-demo",
      providerProfileKey: providerContext.selectedProfileKey ?? "demo",
      promptVersion: providerContext.taskAsset?.promptVersion ?? "0.1.0",
      status: "succeeded",
      validationStatus: "valid",
      externalSend: providerContext.provider?.externalSend ?? false,
      latencyMs: Date.now() - startedAt,
      provenance: toSafeJson({
        providerRuntime: "deterministic-demo",
        selectedProfileSource: providerContext.selectedProfileSource,
        hookKey: providerContext.taskAsset?.hookKey,
        renderSlot: providerContext.taskAsset?.renderSlot,
        schemaVersion: providerContext.taskAsset?.schemaVersion,
        registryProfileFound: Boolean(providerContext.registry?.profile)
      })
    });
    const suggestion = await repositories.aiSuggestions.createSuggestion({
      componentId: component.id,
      taskRunId: taskRun.id,
      proposedText: output.proposedText,
      rationale: output.rationale,
      confidence: output.confidence,
      warnings: output.warnings
    });

    response.status(201).json({
      suggestion,
      taskRun,
      output,
      readiness
    });
  });

  app.post("/api/ai-suggestions/:suggestionId/accept", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before accepting AI suggestions."
      });
      return;
    }

    const suggestion = await repositories.aiSuggestions.getSuggestion(request.params.suggestionId);
    if (!suggestion) {
      response.status(404).json({
        error: "suggestion_not_found",
        suggestionId: request.params.suggestionId
      });
      return;
    }

    if (suggestion.status !== "proposed") {
      response.status(409).json({
        error: "suggestion_already_decided",
        suggestionId: suggestion.id,
        status: suggestion.status
      });
      return;
    }

    const result = await repositories.aiSuggestions.acceptSuggestion(suggestion.id);
    if (!result) {
      response.status(409).json({
        error: "suggestion_accept_failed",
        suggestionId: suggestion.id
      });
      return;
    }

    const autosave = await createMutationAutosave(repositories, "ai_suggestion_accepted", result.component, {
      suggestionId: result.suggestion.id,
      revisionId: result.revision.id,
      previousText: result.revision.previousText,
      revisedText: result.revision.revisedText,
      editSource: result.revision.editSource
    });

    response.json({
      suggestion: result.suggestion,
      component: result.component,
      revision: result.revision,
      autosave
    });
  });

  app.post("/api/ai-suggestions/:suggestionId/reject", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before rejecting AI suggestions."
      });
      return;
    }

    const suggestion = await repositories.aiSuggestions.getSuggestion(request.params.suggestionId);
    if (!suggestion) {
      response.status(404).json({
        error: "suggestion_not_found",
        suggestionId: request.params.suggestionId
      });
      return;
    }

    if (suggestion.status !== "proposed") {
      response.status(409).json({
        error: "suggestion_already_decided",
        suggestionId: suggestion.id,
        status: suggestion.status
      });
      return;
    }

    const component = await repositories.review.getComponent(suggestion.componentId);
    if (!component) {
      response.status(404).json({
        error: "component_not_found",
        componentId: suggestion.componentId
      });
      return;
    }

    const rejectedSuggestion = await repositories.aiSuggestions.setSuggestionStatus(suggestion.id, "rejected");
    if (!rejectedSuggestion) {
      response.status(409).json({
        error: "suggestion_reject_failed",
        suggestionId: suggestion.id
      });
      return;
    }

    const autosave = await createMutationAutosave(repositories, "ai_suggestion_rejected", component, {
      suggestionId: rejectedSuggestion.id,
      proposedText: rejectedSuggestion.proposedText,
      status: rejectedSuggestion.status
    });

    response.json({
      suggestion: rejectedSuggestion,
      autosave
    });
  });

  app.get("/api/task-runs/:taskRunId", async (request, response) => {
    if (!repositories) {
      response.status(404).json({
        error: "task_run_not_found",
        taskRunId: request.params.taskRunId
      });
      return;
    }

    const taskRun = await repositories.taskRuns.getTaskRun(request.params.taskRunId);
    if (!taskRun) {
      response.status(404).json({
        error: "task_run_not_found",
        taskRunId: request.params.taskRunId
      });
      return;
    }

    response.json({ taskRun });
  });

  app.use("/api", (_request, response) => {
    response.status(501).json({
      error: "not_implemented",
      message: "The API boundary is reserved by the MVP plan and will be implemented incrementally."
    });
  });

  return app;
}
