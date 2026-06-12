import cors from "cors";
import express from "express";
import type pg from "pg";
import type { AppConfig } from "../config/env.js";
import { checkDatabase } from "../db/pool.js";
import { combineReadiness } from "../domain/readiness.js";
import { buildProviderReadiness } from "../providers/readiness.js";
import { buildWorkflowReadiness } from "../workflow/readiness.js";

export function createServer(config: AppConfig, pool: pg.Pool | null) {
  const app = express();

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
    const provider = buildProviderReadiness(config);
    const workflow = buildWorkflowReadiness(false);

    response.json(
      combineReadiness([
        { key: "database", label: "Database", ready: database.ready, reason: database.reason },
        ...provider.checks,
        ...workflow.checks
      ])
    );
  });

  app.get("/api/provider-readiness", (_request, response) => {
    response.json(buildProviderReadiness(config));
  });

  app.get("/api/provider-readiness/tasks/:taskKey", (request, response) => {
    const provider = buildProviderReadiness(config);
    response.json({
      taskKey: request.params.taskKey,
      ...provider
    });
  });

  app.get("/api/documents", (_request, response) => {
    response.json({ documents: [] });
  });

  app.get("/api/documents/:documentId", (request, response) => {
    response.status(404).json({
      error: "document_not_found",
      documentId: request.params.documentId
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

  app.post("/api/components/:componentId/ai-suggestions", (request, response) => {
    const readiness = buildProviderReadiness(config);
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

  app.get("/api/task-runs/:taskRunId", (request, response) => {
    response.status(404).json({
      error: "task_run_not_found",
      taskRunId: request.params.taskRunId
    });
  });

  app.use("/api", (_request, response) => {
    response.status(501).json({
      error: "not_implemented",
      message: "The API boundary is reserved by the MVP plan and will be implemented incrementally."
    });
  });

  return app;
}

