import type { AppConfig } from "../config/env.js";
import type { ReadinessCheck, ReadinessResponse } from "../domain/readiness.js";
import { combineReadiness } from "../domain/readiness.js";
import type { ProviderTaskAsset } from "../repositories/providerTasks.js";
import type { RegistryLookupResult, RegistryProviderConfig } from "./registry.js";

export type ProviderSettings = {
  registryUrl?: string;
  selectedProviderProfileKey?: string;
  demoProviderMode?: boolean;
};

export type SelectedProfileResolution = {
  profileKey: string | undefined;
  source: "saved" | "env" | "none";
};

export type ProviderRegistryResolution = {
  registryUrl: string | undefined;
  source: "saved" | "env" | "none";
};

export type DemoProviderModeResolution = {
  enabled: boolean;
  source: "saved" | "env";
};

export type ProviderReadinessContext = {
  taskKey?: string;
  taskAsset?: ProviderTaskAsset | null;
  registry?: RegistryLookupResult;
  secretEnv?: NodeJS.ProcessEnv;
};

export function resolveSelectedProfile(config: AppConfig, settings: ProviderSettings): string | undefined {
  return resolveSelectedProfileSelection(config, settings).profileKey;
}

export function resolveProviderRegistryUrl(config: AppConfig, settings: ProviderSettings): ProviderRegistryResolution {
  const savedRegistryUrl = settings.registryUrl?.trim();
  if (savedRegistryUrl) {
    return { registryUrl: savedRegistryUrl, source: "saved" };
  }

  const bootstrapRegistryUrl = config.INVOKE_PROVIDERS_REGISTRY_URL?.trim();
  if (bootstrapRegistryUrl) {
    return { registryUrl: bootstrapRegistryUrl, source: "env" };
  }

  return { registryUrl: undefined, source: "none" };
}

export function resolveDemoProviderMode(config: AppConfig, settings: ProviderSettings): DemoProviderModeResolution {
  if (typeof settings.demoProviderMode === "boolean") {
    return { enabled: settings.demoProviderMode, source: "saved" };
  }

  return { enabled: config.ARTIFACT_REVIEW_DEMO_PROVIDER_MODE, source: "env" };
}

export function resolveSelectedProfileSelection(
  config: AppConfig,
  settings: ProviderSettings
): SelectedProfileResolution {
  const savedProfile = settings.selectedProviderProfileKey?.trim();
  if (savedProfile) {
    return { profileKey: savedProfile, source: "saved" };
  }

  const bootstrapProfile = config.INVOKE_PROVIDERS_PROFILE?.trim();
  if (bootstrapProfile) {
    return { profileKey: bootstrapProfile, source: "env" };
  }

  return { profileKey: undefined, source: "none" };
}

export function selectProviderForTask(
  providers: RegistryProviderConfig[],
  taskAsset: ProviderTaskAsset | null | undefined
): RegistryProviderConfig | null {
  if (!taskAsset) {
    return null;
  }

  const candidates = taskAsset.providerKey
    ? providers.filter((provider) => provider.providerKey === taskAsset.providerKey)
    : providers;

  return (
    candidates.find(
      (provider) =>
        provider.enabled &&
        provider.capabilities.some((capability) => capability.key === taskAsset.requiredCapability)
    ) ?? null
  );
}

export function buildProviderReadiness(
  config: AppConfig,
  settings: ProviderSettings = {},
  context: ProviderReadinessContext = {}
): ReadinessResponse {
  const selection = resolveSelectedProfileSelection(config, settings);
  const registrySelection = resolveProviderRegistryUrl(config, settings);
  const demoModeSelection = resolveDemoProviderMode(config, settings);
  const selectedProfile = selection.profileKey;
  const taskAsset = context.taskAsset ?? null;
  const registry = context.registry;
  const demoMode = demoModeSelection.enabled;
  const selectedProvider = selectProviderForTask(registry?.providers ?? [], taskAsset);
  const requiredSecretRef = selectedProvider?.requiredSecretRef;
  const secretAvailable = requiredSecretRef ? Boolean((context.secretEnv ?? process.env)[requiredSecretRef]) : true;
  const registryConfigured = Boolean(registrySelection.registryUrl);
  const registryChecksBypassed = demoMode && (!registryConfigured || !selectedProfile);

  const checks: ReadinessCheck[] = [
    {
      key: "registry-url",
      label: "Provider registry URL",
      ready: registryConfigured || registryChecksBypassed,
      reason: registryConfigured
        ? registrySelection.source === "saved"
          ? "Using saved provider registry URL."
          : undefined
        : demoMode
          ? "Demo mode is enabled; registry URL is not required for deterministic suggestions."
          : "INVOKE_PROVIDERS_REGISTRY_URL is not configured."
    },
    {
      key: "selected-profile",
      label: selection.source === "saved" ? "Saved provider profile" : "Selected provider profile",
      ready: Boolean(selectedProfile) || registryChecksBypassed,
      reason: selectedProfile
        ? `Using ${selection.source === "saved" ? "saved selectedProviderProfileKey" : "first-run INVOKE_PROVIDERS_PROFILE"}.`
        : demoMode
          ? "Demo mode is enabled; no profile is required for deterministic suggestions."
          : "No saved selectedProviderProfileKey or first-run INVOKE_PROVIDERS_PROFILE."
    },
    {
      key: "registry-profile",
      label: "Registry profile",
      ready: demoMode ? true : Boolean(registry?.reachable && registry.profile),
      reason: demoMode
        ? "Demo mode bypasses registry profile lookup."
        : registry?.reachable && registry.profile
          ? undefined
          : registry?.missingProfile
            ? `Selected profile ${selectedProfile ?? ""} is not registered.`
            : registry?.error ?? "Registry profile has not been loaded."
    },
    {
      key: "task-definitions",
      label: context.taskKey ? `Task ${context.taskKey}` : "Provider task definition",
      ready: Boolean(taskAsset),
      reason: taskAsset ? undefined : "The provider task definition is not stored in app-owned task_definitions."
    },
    {
      key: "prompt-version",
      label: "Prompt version",
      ready: Boolean(taskAsset?.prompt),
      reason: taskAsset?.prompt ? undefined : "The task prompt version is missing."
    },
    {
      key: "structured-output-schema",
      label: "Structured output schemas",
      ready: Boolean(taskAsset?.schema),
      reason: taskAsset?.schema ? undefined : "The task structured output schema is missing."
    },
    {
      key: "processing-hook",
      label: "Processing hook",
      ready: Boolean(taskAsset && taskAsset.hookImplementationKey === taskAsset.hookKey),
      reason:
        taskAsset && taskAsset.hookImplementationKey === taskAsset.hookKey
          ? undefined
          : `The ${taskAsset?.hookKey ?? "required"} processing hook is missing.`
    },
    {
      key: "provider-capability",
      label: "Provider capability",
      ready: demoMode ? true : Boolean(selectedProvider),
      reason: demoMode
        ? "Demo provider supplies deterministic JSON output."
        : selectedProvider
          ? undefined
          : `No enabled registry provider supplies ${taskAsset?.requiredCapability ?? "the required capability"}.`
    },
    {
      key: "secret-reference",
      label: "Provider secret reference",
      ready: demoMode || secretAvailable,
      reason:
        demoMode || secretAvailable
          ? undefined
          : `Secret reference ${requiredSecretRef ?? "required by provider"} is not available locally.`
    },
    {
      key: "adapter-availability",
      label: "Provider adapter",
      ready: demoMode,
      reason: demoMode
        ? "Explicit deterministic demo mode is enabled."
        : "Provider runtime adapters are not installed in this project yet."
    },
    {
      key: "provider-fallback-policy",
      label: "No silent fallback provider",
      ready: true
    },
    {
      key: "demo-provider-mode",
      label: "Deterministic demo mode",
      ready: true,
      reason: demoMode
        ? `Enabled for explicit deterministic suggestions${demoModeSelection.source === "saved" ? " from app settings" : ""}.`
        : "Disabled; registry/provider readiness is required."
    }
  ];

  return combineReadiness(checks);
}
