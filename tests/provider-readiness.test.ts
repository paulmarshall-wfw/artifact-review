import { describe, expect, it } from "vitest";
import { loadConfig } from "../service/src/config/env";
import {
  buildProviderReadiness,
  resolveDemoProviderMode,
  resolveProviderRegistryUrl,
  resolveSelectedProfile
} from "../service/src/providers/readiness";
import type { ProviderTaskAsset } from "../service/src/repositories/providerTasks";

const suggestTaskAsset: ProviderTaskAsset = {
  taskKey: "suggest-component-revision",
  providerKey: null,
  requiredCapability: "llm.generateJson",
  promptVersion: "0.1.0",
  renderSlot: "component.inline.aiSuggest",
  hookKey: "store-ai-suggestion",
  prompt: { name: "suggest-component-revision" },
  schemaVersion: "0.1.0",
  schema: { type: "object" },
  hookImplementationKey: "store-ai-suggestion",
  hookPolicy: "block_when_missing"
};

describe("provider readiness", () => {
  it("does not silently create readiness when registry and profile are missing", () => {
    const config = loadConfig({});
    const readiness = buildProviderReadiness(config);

    expect(readiness.ready).toBe(false);
    expect(readiness.checks.find((check) => check.key === "registry-url")?.ready).toBe(false);
    expect(readiness.checks.find((check) => check.key === "selected-profile")?.ready).toBe(false);
  });

  it("keeps a saved selected provider profile ahead of the bootstrap environment profile", () => {
    const config = loadConfig({
      INVOKE_PROVIDERS_PROFILE: "bootstrap-profile",
      INVOKE_PROVIDERS_REGISTRY_URL: "http://127.0.0.1:5181",
      ARTIFACT_REVIEW_DEMO_PROVIDER_MODE: "true"
    });

    expect(resolveSelectedProfile(config, { selectedProviderProfileKey: "saved-profile" })).toBe("saved-profile");
  });

  it("keeps saved provider runtime settings ahead of bootstrap environment values", () => {
    const config = loadConfig({
      INVOKE_PROVIDERS_REGISTRY_URL: "http://127.0.0.1:5181",
      INVOKE_PROVIDERS_PROFILE: "bootstrap-profile",
      ARTIFACT_REVIEW_DEMO_PROVIDER_MODE: "false"
    });
    const settings = {
      registryUrl: "http://127.0.0.1:5199",
      selectedProviderProfileKey: "saved-profile",
      demoProviderMode: true
    };

    expect(resolveProviderRegistryUrl(config, settings)).toEqual({
      registryUrl: "http://127.0.0.1:5199",
      source: "saved"
    });
    expect(resolveSelectedProfile(config, settings)).toBe("saved-profile");
    expect(resolveDemoProviderMode(config, settings)).toEqual({ enabled: true, source: "saved" });
  });

  it("allows deterministic suggestions only when demo mode and task assets are explicit", () => {
    const config = loadConfig({
      ARTIFACT_REVIEW_DEMO_PROVIDER_MODE: "true"
    });
    const readiness = buildProviderReadiness(config, {}, {
      taskKey: "suggest-component-revision",
      taskAsset: suggestTaskAsset
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.checks.find((check) => check.key === "adapter-availability")?.ready).toBe(true);
    expect(readiness.checks.find((check) => check.key === "task-definitions")?.ready).toBe(true);
  });
});
