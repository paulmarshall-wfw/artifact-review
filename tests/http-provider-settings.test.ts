import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../service/src/config/env";
import { createServer } from "../service/src/http/server";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

describe("provider settings HTTP endpoints", () => {
  it("loads DATABASE_URL from the local env file for service startup", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "artifact-review-env-"));
    const envPath = path.join(directory, ".env");
    await writeFile(envPath, "DATABASE_URL=postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev\n");

    const config = loadConfig(
      {
        ARTIFACT_REVIEW_SERVICE_HOST: "127.0.0.1",
        ARTIFACT_REVIEW_SERVICE_PORT: "4793"
      },
      {
        localEnvFilePath: envPath,
        useLocalEnvFile: true
      }
    );

    expect(config.DATABASE_URL).toBe("postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev");
    expect(config.sources.DATABASE_URL).toBe("local-env");
  });

  it("saves the database URL to the local env file from settings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "artifact-review-env-"));
    const envPath = path.join(directory, ".env");
    await writeFile(envPath, "# local config\nDATABASE_URL=\n");
    const app = createServer(
      loadConfig(
        {
          ARTIFACT_REVIEW_SERVICE_HOST: "127.0.0.1",
          ARTIFACT_REVIEW_SERVICE_PORT: "4793"
        },
        {
          localEnvFilePath: envPath,
          useLocalEnvFile: false
        }
      ),
      null
    );

    const response = await requestApp(app, "PATCH", "/api/settings/database", {
      databaseUrl: "postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      database: {
        saved: {
          databaseUrl: "postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev"
        },
        restartRequired: true
      }
    });
    await expect(readFile(envPath, "utf8")).resolves.toContain(
      "DATABASE_URL=postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev"
    );
  });

  it("builds a settings summary with predefined landing areas when the database is not configured", async () => {
    const response = await requestApp(createTestServer(null), "GET", "/api/settings");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      providerRegistry: {
        registryUrl: "",
        selectedProviderProfileKey: "",
        demoProviderMode: false
      },
      workflow: {
        active: false
      },
      readiness: {
        ready: false
      },
      renderSlots: expect.arrayContaining([
        expect.objectContaining({
          slot: "component.inline.aiSuggest",
          label: "Inline AI Suggest",
          actionCount: 0
        }),
        expect.objectContaining({
          slot: "admin.diagnostics",
          label: "Settings Diagnostics"
        })
      ])
    });
  });

  it("lists render slot actions from the settings API boundary", async () => {
    const response = await requestApp(
      createTestServer(null),
      "GET",
      "/api/settings/render-slots/component.inline.aiSuggest/actions"
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      slot: "component.inline.aiSuggest",
      actions: []
    });
  });

  it("validates task route render slots against the predefined landing areas", async () => {
    const response = await requestApp(createTestServer(createQueuedDatabase([])), "PATCH", "/api/settings/tasks/task-1/route", {
      renderSlot: "custom.unregistered.slot"
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: "invalid_task_route"
    });
  });

  it("lists recent task runs for settings diagnostics", async () => {
    const createdAt = new Date("2026-06-13T00:00:00.000Z");
    const response = await requestApp(createTestServer(createQueuedDatabase([
      [
        {
          id: "task-run-1",
          task_key: "suggest-component-revision",
          provider_key: "openai-compatible",
          provider_profile_key: "registry-profile",
          prompt_version: "0.1.0",
          status: "succeeded",
          validation_status: "valid",
          external_send: true,
          latency_ms: 20,
          provenance: {},
          created_at: createdAt
        }
      ]
    ])), "GET", "/api/settings/task-runs");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      taskRuns: [
        {
          id: "task-run-1",
          taskKey: "suggest-component-revision",
          status: "succeeded",
          validationStatus: "valid"
        }
      ]
    });
  });

  it("creates and deletes app-owned processing hooks from settings", async () => {
    const app = createTestServer(createQueuedDatabase([]));

    const createResponse = await requestApp(app, "POST", "/api/settings/processing-hooks", {
      hookKey: "custom-review-hook"
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      processingHook: {
        hookKey: "custom-review-hook",
        implemented: false,
        status: "default_noop",
        taskUsageCount: 0
      },
      summary: {
        processingHooks: [
          expect.objectContaining({
            hookKey: "custom-review-hook",
            deletable: true
          })
        ]
      }
    });

    const duplicateResponse = await requestApp(app, "POST", "/api/settings/processing-hooks", {
      hookKey: "custom-review-hook"
    });
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body).toMatchObject({ error: "processing_hook_exists" });

    const deleteResponse = await requestApp(app, "DELETE", "/api/settings/processing-hooks/custom-review-hook");
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toMatchObject({
      deleted: true,
      hookKey: "custom-review-hook",
      summary: {
        processingHooks: []
      }
    });
  });

  it("blocks enabling task routes through default no-op hooks", async () => {
    const app = createTestServer(createQueuedDatabase([]));

    await requestApp(app, "POST", "/api/settings/processing-hooks", {
      hookKey: "custom-review-hook"
    });
    const response = await requestApp(app, "PATCH", "/api/settings/tasks/task-1/route", {
      hookKey: "custom-review-hook",
      enabled: true
    });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      error: "invalid_task_route",
      issues: ["Hook custom-review-hook is registered but has no backend implementation."]
    });
  });

  it("saves provider runtime settings in app settings and returns refreshed readiness", async () => {
    const db = createQueuedDatabase([]);
    const app = createTestServer(db, {
      INVOKE_PROVIDERS_REGISTRY_URL: "http://127.0.0.1:5181",
      INVOKE_PROVIDERS_PROFILE: "bootstrap-profile"
    });

    const saveResponse = await requestApp(app, "PUT", "/api/provider-settings", {
      registryUrl: "http://127.0.0.1:5199",
      selectedProviderProfileKey: "saved-profile",
      demoProviderMode: true
    });

    expect(saveResponse.status).toBe(200);
    expect(saveResponse.body).toMatchObject({
      settings: {
        registryUrl: "http://127.0.0.1:5199",
        selectedProviderProfileKey: "saved-profile",
        demoProviderMode: true,
        sources: {
          registryUrl: "saved",
          selectedProviderProfileKey: "saved",
          demoProviderMode: "saved"
        }
      },
      readiness: {
        ready: false
      }
    });

    const settingsResponse = await requestApp(app, "GET", "/api/provider-settings");
    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body).toMatchObject({
      registryUrl: "http://127.0.0.1:5199",
      selectedProviderProfileKey: "saved-profile",
      demoProviderMode: true
    });
    expect(db.queries.filter((query) => query.text.includes("insert into app_settings")).map((query) => query.values?.[0])).toEqual(
      expect.arrayContaining(["providerRegistryUrl", "selectedProviderProfileKey", "demoProviderMode"])
    );
  });

  it("blocks provider setting saves until the database is configured", async () => {
    const response = await requestApp(createTestServer(null), "PUT", "/api/provider-settings", {
      registryUrl: "http://127.0.0.1:5199",
      selectedProviderProfileKey: "saved-profile",
      demoProviderMode: true
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: "database_not_configured" });
  });
});
