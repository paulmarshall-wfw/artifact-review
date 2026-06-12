import cors from "cors";
import express from "express";
import type pg from "pg";
import type { AppConfig } from "../config/env.js";
import { checkDatabase } from "../db/pool.js";
import { combineReadiness } from "../domain/readiness.js";
import { buildProviderReadiness } from "../providers/readiness.js";
import { createRepositories } from "../repositories/index.js";
import { buildWorkflowReadiness } from "../workflow/readiness.js";

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
    const provider = buildProviderReadiness(config, {
      selectedProviderProfileKey: await repositories?.appSettings.getSelectedProviderProfileKey()
    });
    const workflow = buildWorkflowReadiness(false);

    response.json(
      combineReadiness([
        { key: "database", label: "Database", ready: database.ready, reason: database.reason },
        ...provider.checks,
        ...workflow.checks
      ])
    );
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

  app.post("/api/ingest/file", (_request, response) => {
    response.status(409).json({
      error: "workflow_not_configured",
      message: "Import or activate a user-provided document workflow before ingest."
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
