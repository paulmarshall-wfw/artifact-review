import { describe, expect, it } from "vitest";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

describe("provider settings HTTP endpoints", () => {
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
