import type { AppConfig } from "../config/env.js";
import type { ReadinessCheck, ReadinessResponse } from "../domain/readiness.js";
import { combineReadiness } from "../domain/readiness.js";
import { mvpTaskDefinitions } from "./tasks.js";

export type ProviderSettings = {
  selectedProviderProfileKey?: string;
};

export function resolveSelectedProfile(config: AppConfig, settings: ProviderSettings): string | undefined {
  return (settings.selectedProviderProfileKey ?? config.INVOKE_PROVIDERS_PROFILE) || undefined;
}

export function buildProviderReadiness(config: AppConfig, settings: ProviderSettings = {}): ReadinessResponse {
  const selectedProfile = resolveSelectedProfile(config, settings);
  const checks: ReadinessCheck[] = [
    {
      key: "registry-url",
      label: "Provider registry URL",
      ready: Boolean(config.INVOKE_PROVIDERS_REGISTRY_URL),
      reason: config.INVOKE_PROVIDERS_REGISTRY_URL ? undefined : "INVOKE_PROVIDERS_REGISTRY_URL is not configured."
    },
    {
      key: "selected-profile",
      label: "Selected provider profile",
      ready: Boolean(selectedProfile),
      reason: selectedProfile ? undefined : "No saved selectedProviderProfileKey or first-run INVOKE_PROVIDERS_PROFILE."
    },
    {
      key: "task-definitions",
      label: "MVP task definitions",
      ready: mvpTaskDefinitions.length === 3,
      reason: "Expected suggest, summarize, and draft-note tasks."
    },
    {
      key: "structured-output-schema",
      label: "Structured output schemas",
      ready: true
    },
    {
      key: "provider-fallback-policy",
      label: "No silent fallback provider",
      ready: true
    },
    {
      key: "demo-provider-mode",
      label: "Deterministic demo mode",
      ready: config.ARTIFACT_REVIEW_DEMO_PROVIDER_MODE,
      reason: config.ARTIFACT_REVIEW_DEMO_PROVIDER_MODE
        ? undefined
        : "Demo provider is disabled; real registry/provider readiness is required."
    }
  ];

  return combineReadiness(checks);
}
