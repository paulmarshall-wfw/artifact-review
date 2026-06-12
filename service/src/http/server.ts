import cors from "cors";
import express from "express";
import type pg from "pg";
import { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { checkDatabase } from "../db/pool.js";
import { combineReadiness } from "../domain/readiness.js";
import { parsePlainTextToComponents } from "../domain/parser.js";
import { buildProviderReadiness } from "../providers/readiness.js";
import { createRepositories } from "../repositories/index.js";
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
  format: z.literal("txt"),
  content: z.string().min(1)
});

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
    const provider = buildProviderReadiness(config, {
      selectedProviderProfileKey: await repositories?.appSettings.getSelectedProviderProfileKey()
    });
    const workflow = buildWorkflowReadiness(Boolean(activeWorkflow));

    response.json(
      combineReadiness([
        { key: "database", label: "Database", ready: database.ready, reason: database.reason },
        ...provider.checks,
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
    response.json(
      buildProviderReadiness(config, {
        selectedProviderProfileKey: await repositories?.appSettings.getSelectedProviderProfileKey()
      })
    );
  });

  app.get("/api/provider-readiness/tasks/:taskKey", async (request, response) => {
    const provider = buildProviderReadiness(config, {
      selectedProviderProfileKey: await repositories?.appSettings.getSelectedProviderProfileKey()
    });
    response.json({
      taskKey: request.params.taskKey,
      ...provider
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
      components: await repositories.documents.getReviewComponents(document.id)
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

    const parsedComponents = parsePlainTextToComponents(parsedRequest.data.content);
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
      originalFormat: "txt",
      currentWorkflowItemRef: initialState
    });
    const version = await repositories.documents.createDocumentVersion({
      documentId: document.id,
      versionNumber: 1,
      sourceSnapshot: parsedRequest.data.content,
      currentSnapshot: parsedRequest.data.content,
      parserMetadata: {
        parser: "plain-text-sentences",
        componentCount: parsedComponents.length
      }
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

  app.post("/api/ingest/url", (_request, response) => {
    response.status(409).json({
      error: "workflow_not_configured",
      message: "Import or activate a user-provided document workflow before ingest."
    });
  });

  app.post("/api/components/:componentId/ai-suggestions", async (request, response) => {
    const readiness = buildProviderReadiness(config, {
      selectedProviderProfileKey: await repositories?.appSettings.getSelectedProviderProfileKey()
    });
    if (!readiness.ready) {
      response.status(409).json({
        error: "provider_not_ready",
        componentId: request.params.componentId,
        readiness
      });
      return;
    }

    response.status(501).json({
      error: "provider_runtime_not_wired",
      componentId: request.params.componentId,
      message: "Provider runtime composition is scaffolded; registry-backed invocation is an implementation task."
    });
  });

  app.post("/api/ai-suggestions/:suggestionId/accept", (request, response) => {
    response.status(501).json({
      error: "suggestion_accept_not_wired",
      suggestionId: request.params.suggestionId
    });
  });

  app.post("/api/ai-suggestions/:suggestionId/reject", (request, response) => {
    response.status(501).json({
      error: "suggestion_reject_not_wired",
      suggestionId: request.params.suggestionId
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
