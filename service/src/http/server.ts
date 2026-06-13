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
import {
  resolveDemoProviderMode,
  resolveProviderRegistryUrl,
  resolveSelectedProfileSelection
} from "../providers/readiness.js";
import {
  createArtifactReviewProviderRuntime,
  suggestComponentRevisionTaskKey
} from "../providers/runtime.js";
import type { DocumentSummary, ReviewComponent } from "../repositories/documents.js";
import { createRepositories, type Repositories } from "../repositories/index.js";
import type { ReviewComponentForMutation } from "../repositories/review.js";
import type { JsonValue } from "../repositories/types.js";
import { artifactReviewRenderSlots, isKnownArtifactReviewRenderSlot } from "../settings/renderSlots.js";
import {
  activateDocumentWorkflow,
  executeDocumentWorkflowAction,
  getActiveDocumentWorkflow,
  getDocumentWorkflowActions,
  getEntryState,
  initializeDocumentWorkflowState,
  summarizeWorkflowDefinition,
  validateDocumentWorkflowDefinition,
  workflowErrorResponse
} from "../workflow/runtime.js";
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

const exportDocumentRequestSchema = z.object({
  destinationPath: z.string().min(1).optional(),
  includeReviewBundle: z.boolean().default(false)
});

const nullableTrimmedStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? null : value),
  z.string().trim().nullable().optional()
);

const providerSettingsRequestSchema = z.object({
  registryUrl: nullableTrimmedStringSchema.refine((value) => !value || z.string().url().safeParse(value).success, {
    message: "Provider registry URL must be a valid URL."
  }),
  selectedProviderProfileKey: nullableTrimmedStringSchema,
  demoProviderMode: z.boolean()
});

const taskRouteRequestSchema = z.object({
  providerKey: nullableTrimmedStringSchema,
  renderSlot: z.string().trim().min(1).optional(),
  hookKey: z.string().trim().min(1).optional(),
  displayOrder: z.number().int().min(0).max(10000).optional(),
  enabled: z.boolean().optional(),
  modelOverride: nullableTrimmedStringSchema,
  displayLabel: nullableTrimmedStringSchema,
  displayDescription: nullableTrimmedStringSchema
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

async function buildProviderSettingsResponse(config: AppConfig, repositories: Repositories | null) {
  const saved = (await repositories?.appSettings.getProviderRuntimeSettings()) ?? {};
  const registry = resolveProviderRegistryUrl(config, saved);
  const profile = resolveSelectedProfileSelection(config, saved);
  const demo = resolveDemoProviderMode(config, saved);

  return {
    registryUrl: registry.registryUrl ?? "",
    selectedProviderProfileKey: profile.profileKey ?? "",
    demoProviderMode: demo.enabled,
    sources: {
      registryUrl: registry.source,
      selectedProviderProfileKey: profile.source,
      demoProviderMode: demo.source
    },
    saved: {
      registryUrl: saved.registryUrl ?? null,
      selectedProviderProfileKey: saved.selectedProviderProfileKey ?? null,
      demoProviderMode: saved.demoProviderMode ?? null
    }
  };
}

async function listRenderSlotActions(config: AppConfig, repositories: Repositories | null, slot: string) {
  if (!repositories) {
    return [];
  }
  return await createArtifactReviewProviderRuntime(config, repositories).getRenderSlotActions(slot);
}

async function buildSettingsReadiness(config: AppConfig, repositories: Repositories | null, pool: pg.Pool | null) {
  const database = await checkDatabase(pool);
  const activeWorkflow = repositories ? await getActiveDocumentWorkflow(repositories) : null;
  const provider = await createArtifactReviewProviderRuntime(config, repositories).getReadiness();
  const workflow = buildWorkflowReadiness(Boolean(activeWorkflow));

  return combineReadiness([
    { key: "database", label: "Database", ready: database.ready, reason: database.reason },
    ...workflow.checks,
    ...provider.checks
  ]);
}

async function buildSettingsSummary(config: AppConfig, repositories: Repositories | null, pool: pg.Pool | null) {
  const [settings, readiness, activeWorkflow, taskRoutes, taskRuns] = await Promise.all([
    buildProviderSettingsResponse(config, repositories),
    buildSettingsReadiness(config, repositories, pool),
    repositories ? getActiveDocumentWorkflow(repositories) : Promise.resolve(null),
    repositories ? repositories.providerTasks.listTaskRoutes() : Promise.resolve([]),
    repositories ? repositories.taskRuns.listTaskRuns(25) : Promise.resolve([])
  ]);
  const renderSlots = await Promise.all(
    artifactReviewRenderSlots.map(async (definition) => {
      const actions = await listRenderSlotActions(config, repositories, definition.slot);
      return {
        ...definition,
        actionCount: actions.length,
        readyActionCount: actions.filter((action) => action.ready).length,
        taskKeys: actions.map((action) => action.taskKey)
      };
    })
  );

  return {
    providerRegistry: settings,
    workflow: {
      active: Boolean(activeWorkflow),
      workflow: activeWorkflow ? summarizeWorkflowDefinition(activeWorkflow) : null,
      readiness: buildWorkflowReadiness(Boolean(activeWorkflow))
    },
    readiness,
    taskRoutes,
    renderSlots,
    taskRuns
  };
}

async function invokeComponentTaskAction(
  config: AppConfig,
  repositories: Repositories,
  componentId: string,
  taskKey: string
) {
  const providerRuntime = createArtifactReviewProviderRuntime(config, repositories);
  const actions = await providerRuntime.getRenderSlotActions("component.inline.aiSuggest");
  const action = actions.find((entry) => entry.taskKey === taskKey);

  if (!action) {
    return {
      status: 404,
      body: {
        error: "task_action_not_found",
        taskKey,
        renderSlot: "component.inline.aiSuggest"
      }
    } as const;
  }

  const readiness = await providerRuntime.getReadiness(taskKey);
  if (!readiness.ready || !action.ready) {
    return {
      status: 409,
      body: {
        error: "provider_not_ready",
        componentId,
        readiness
      }
    } as const;
  }

  if (taskKey !== suggestComponentRevisionTaskKey) {
    return {
      status: 409,
      body: {
        error: "task_action_not_supported",
        taskKey,
        message: "Only AI suggestion task actions are currently executable from component inline slots."
      }
    } as const;
  }

  const component = await repositories.review.getComponent(componentId);
  if (!component) {
    return {
      status: 404,
      body: {
        error: "component_not_found",
        componentId
      }
    } as const;
  }

  const invocation = await providerRuntime.invokeSuggestComponentRevision(component);

  if (!invocation.ok) {
    return {
      status: 502,
      body: {
        error: invocation.error,
        componentId: component.id,
        taskRun: invocation.taskRun
      }
    } as const;
  }

  return {
    status: 201,
    body: {
      suggestion: invocation.suggestion,
      taskRun: invocation.taskRun,
      output: invocation.output,
      readiness
    }
  } as const;
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
    const activeWorkflow = repositories ? await getActiveDocumentWorkflow(repositories) : null;
    const provider = await createArtifactReviewProviderRuntime(config, repositories).getReadiness();
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
    const activeWorkflow = repositories ? await getActiveDocumentWorkflow(repositories) : null;

    response.json({
      active: Boolean(activeWorkflow),
      workflow: activeWorkflow ? summarizeWorkflowDefinition(activeWorkflow) : null,
      readiness: buildWorkflowReadiness(Boolean(activeWorkflow))
    });
  });

  app.get("/api/settings", async (_request, response) => {
    response.json(await buildSettingsSummary(config, repositories, pool));
  });

  app.get("/api/settings/readiness", async (_request, response) => {
    response.json(await buildSettingsReadiness(config, repositories, pool));
  });

  app.patch("/api/settings/provider-registry", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before saving provider registry settings."
      });
      return;
    }

    const parsed = providerSettingsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(422).json({
        error: "invalid_provider_registry_settings",
        issues: parsed.error.issues.map((issue) => issue.message)
      });
      return;
    }

    await repositories.appSettings.setProviderRuntimeSettings({
      registryUrl: parsed.data.registryUrl ?? undefined,
      selectedProviderProfileKey: parsed.data.selectedProviderProfileKey ?? undefined,
      demoProviderMode: parsed.data.demoProviderMode
    });

    response.json(await buildSettingsSummary(config, repositories, pool));
  });

  app.post("/api/settings/providers/refresh", async (_request, response) => {
    const [settings, provider, summary] = await Promise.all([
      buildProviderSettingsResponse(config, repositories),
      createArtifactReviewProviderRuntime(config, repositories).getReadiness(),
      buildSettingsSummary(config, repositories, pool)
    ]);

    response.json({
      settings,
      readiness: provider,
      summary
    });
  });

  app.get("/api/settings/render-slots", async (_request, response) => {
    const taskRoutes = repositories ? await repositories.providerTasks.listTaskRoutes() : [];
    const taskKeysBySlot = new Map<string, string[]>();
    for (const route of taskRoutes) {
      const existing = taskKeysBySlot.get(route.renderSlot) ?? [];
      existing.push(route.taskKey);
      taskKeysBySlot.set(route.renderSlot, existing);
    }

    response.json({
      renderSlots: await Promise.all(
        artifactReviewRenderSlots.map(async (definition) => {
          const actions = await listRenderSlotActions(config, repositories, definition.slot);
          return {
            ...definition,
            actionCount: actions.length,
            readyActionCount: actions.filter((action) => action.ready).length,
            taskKeys: taskKeysBySlot.get(definition.slot) ?? []
          };
        })
      )
    });
  });

  app.get("/api/settings/render-slots/:slot/actions", async (request, response) => {
    const slot = request.params.slot;
    if (!isKnownArtifactReviewRenderSlot(slot)) {
      response.status(404).json({
        error: "render_slot_not_found",
        slot
      });
      return;
    }

    response.json({
      slot,
      actions: await listRenderSlotActions(config, repositories, slot)
    });
  });

  app.get("/api/settings/task-runs", async (_request, response) => {
    response.json({
      taskRuns: repositories ? await repositories.taskRuns.listTaskRuns(50) : []
    });
  });

  app.patch("/api/settings/tasks/:taskKey/route", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before editing task routes."
      });
      return;
    }

    const parsed = taskRouteRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(422).json({
        error: "invalid_task_route",
        issues: parsed.error.issues.map((issue) => issue.message)
      });
      return;
    }

    if (parsed.data.renderSlot && !isKnownArtifactReviewRenderSlot(parsed.data.renderSlot)) {
      response.status(422).json({
        error: "invalid_task_route",
        issues: [`Render slot ${parsed.data.renderSlot} is not predefined for Artifact Review.`]
      });
      return;
    }

    if (parsed.data.hookKey) {
      const hooks = await repositories.providerTasks.listProcessingHooks();
      if (!hooks.some((hook) => hook.hook_key === parsed.data.hookKey)) {
        response.status(422).json({
          error: "invalid_task_route",
          issues: [`Hook ${parsed.data.hookKey} is not registered.`]
        });
        return;
      }
    }

    const route = await repositories.providerTasks.updateTaskRoute(request.params.taskKey, parsed.data);
    if (!route) {
      response.status(404).json({
        error: "task_route_not_found",
        taskKey: request.params.taskKey
      });
      return;
    }

    const [readiness, actions] = await Promise.all([
      createArtifactReviewProviderRuntime(config, repositories).getReadiness(route.taskKey),
      listRenderSlotActions(config, repositories, route.renderSlot)
    ]);

    response.json({
      route,
      readiness,
      actions
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

    try {
      const activation = await activateDocumentWorkflow(repositories, request.body);
      response.json({
        active: true,
        workflow: summarizeWorkflowDefinition(activation.definition),
        initialState: activation.initialState
      });
    } catch (error) {
      const errorResponse = workflowErrorResponse(error);
      response.status(errorResponse.status).json(errorResponse.body);
    }
  });

  app.get("/api/provider-readiness", async (_request, response) => {
    response.json(await createArtifactReviewProviderRuntime(config, repositories).getReadiness());
  });

  app.get("/api/provider-settings", async (_request, response) => {
    response.json(await buildProviderSettingsResponse(config, repositories));
  });

  app.put("/api/provider-settings", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before saving provider settings."
      });
      return;
    }

    const parsed = providerSettingsRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(422).json({
        error: "invalid_provider_settings",
        issues: parsed.error.issues.map((issue) => issue.message)
      });
      return;
    }

    await repositories.appSettings.setProviderRuntimeSettings({
      registryUrl: parsed.data.registryUrl ?? undefined,
      selectedProviderProfileKey: parsed.data.selectedProviderProfileKey ?? undefined,
      demoProviderMode: parsed.data.demoProviderMode
    });

    const [settings, provider] = await Promise.all([
      buildProviderSettingsResponse(config, repositories),
      createArtifactReviewProviderRuntime(config, repositories).getReadiness()
    ]);

    response.json({
      settings,
      readiness: provider
    });
  });

  app.get("/api/provider-readiness/tasks/:taskKey", async (request, response) => {
    response.json(await createArtifactReviewProviderRuntime(config, repositories).getReadiness(request.params.taskKey));
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
      getActiveDocumentWorkflow(repositories)
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

    const workflow = await getDocumentWorkflowActions(repositories, document.id);
    const currentState = workflow.currentState ?? document.currentWorkflowItemRef ?? getEntryState(activeWorkflow);
    response.json({
      documentId: document.id,
      currentState,
      actions: workflow.actions
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
      getActiveDocumentWorkflow(repositories)
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

    try {
      const currentState = document.currentWorkflowItemRef ?? getEntryState(activeWorkflow);
      const executed = await executeDocumentWorkflowAction(repositories, document.id, request.params.actionId);
      const updatedDocument = await repositories.documents.getDocument(document.id);
      response.json({
        document: updatedDocument,
        transition: {
          actionId: request.params.actionId,
          from: currentState,
          to: executed.result.itemState.state
        },
        actions: executed.actions
      });
    } catch (error) {
      const errorResponse = workflowErrorResponse(error);
      if (errorResponse.body.error === "invalid_transition") {
        const currentState = document.currentWorkflowItemRef ?? getEntryState(activeWorkflow);
        response.status(409).json({
          error: "workflow_action_not_allowed",
          documentId: document.id,
          currentState,
          actionId: request.params.actionId
        });
        return;
      }
      response.status(errorResponse.status).json({
        ...errorResponse.body,
        documentId: document.id,
        actionId: request.params.actionId
      });
    }
  });

  app.post("/api/ingest/file", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before ingesting files."
      });
      return;
    }

    const activeWorkflow = await getActiveDocumentWorkflow(repositories);
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
    let document = await repositories.documents.createDocument({
      name: parsedRequest.data.name,
      sourceType: "file",
      originalFormat: parsedRequest.data.format,
      currentWorkflowItemRef: initialState
    });
    const itemState = await initializeDocumentWorkflowState(repositories, document.id, initialState);
    document = (await repositories.documents.getDocument(document.id)) ?? document;
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
        currentState: itemState.state,
        actions: (await getDocumentWorkflowActions(repositories, document.id)).actions
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

    const activeWorkflow = await getActiveDocumentWorkflow(repositories);
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
    let document = await repositories.documents.createDocument({
      name: parsedRequest.data.name ?? parsedUrl.toString(),
      sourceType: "url",
      originalFormat: "url_snapshot",
      currentWorkflowItemRef: initialState
    });
    const itemState = await initializeDocumentWorkflowState(repositories, document.id, initialState);
    document = (await repositories.documents.getDocument(document.id)) ?? document;
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
        currentState: itemState.state,
        actions: (await getDocumentWorkflowActions(repositories, document.id)).actions
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

    const result = await invokeComponentTaskAction(
      config,
      repositories,
      request.params.componentId,
      suggestComponentRevisionTaskKey
    );
    response.status(result.status).json(result.body);
  });

  app.post("/api/components/:componentId/task-actions/:taskKey", async (request, response) => {
    if (!repositories) {
      response.status(409).json({
        error: "database_not_configured",
        message: "Configure DATABASE_URL before executing provider-backed task actions."
      });
      return;
    }

    const result = await invokeComponentTaskAction(
      config,
      repositories,
      request.params.componentId,
      request.params.taskKey
    );
    response.status(result.status).json(result.body);
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
