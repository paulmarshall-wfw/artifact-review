import { describe, expect, it } from "vitest";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

describe("provider settings HTTP endpoints", () => {
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
