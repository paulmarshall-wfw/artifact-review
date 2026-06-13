import { randomUUID } from "node:crypto";
import { TargetAppRuntimeService, type RenderSlotAction } from "@invoke-providers/client";
import type {
  HostHook,
  InvocationServices,
  ProcessingHook,
  ProviderAdapter,
  ProviderConfig,
  ProviderInvocationRequest,
  ProviderInvocationResult,
  RuntimeContext,
  SecretAvailability,
  TaskDefinition,
  TaskRun as InvokeProviderTaskRun
} from "@invoke-providers/core";
import {
  DeterministicJsonAdapter,
  DeterministicModuleAdapter,
  DeterministicOcrAdapter,
  DeterministicSttAdapter,
  DeterministicTextAdapter,
  DeterministicTtsAdapter,
  OPENAI_COMPATIBLE_CLOUD_ADAPTER_KEY,
  OPENAI_COMPATIBLE_LOCAL_ADAPTER_KEY,
  OpenAiCompatibleTextAdapter
} from "@invoke-providers/adapters";
import type { AppConfig } from "../config/env.js";
import type { ReadinessResponse } from "../domain/readiness.js";
import type { AiSuggestion } from "../repositories/aiSuggestions.js";
import type { Repositories } from "../repositories/index.js";
import type { ProviderTaskAsset } from "../repositories/providerTasks.js";
import type { ReviewComponentForMutation } from "../repositories/review.js";
import { toJsonValue, type JsonValue } from "../repositories/types.js";
import {
  buildProviderReadiness,
  resolveDemoProviderMode,
  resolveProviderRegistryUrl,
  resolveSelectedProfileSelection,
  selectProviderForTask,
  type ProviderSettings,
  type SelectedProfileResolution
} from "./readiness.js";
import { fetchRegistryLookup, type RegistryLookupResult, type RegistryProviderConfig } from "./registry.js";
import { suggestComponentRevisionOutputSchema } from "./tasks.js";

export const suggestComponentRevisionTaskKey = "suggest-component-revision";
const demoProviderKey = "artifact-review-demo";
const demoAdapterKey = "artifact-review-demo-suggestion";
const localRuntimeKey = "artifact-review.local-service";

export type ProviderInvocationSummary = {
  taskKey: string;
  renderSlot: string | null;
  providerKey: string | null;
  providerDisplayName: string | null;
  providerProfileKey: string | null;
  providerProfileSource: "saved" | "env" | "none";
  adapterKey: string | null;
  model: string | null;
  externalSend: boolean;
  promptVersion: string | null;
  demoMode: boolean;
  selectionMode: "task-provider" | "profile-capability" | "demo" | "none";
  selectionNote: string;
  readinessBlocker: string | null;
};

export type ArtifactReviewProviderReadiness = ReadinessResponse & {
  taskKey: string;
  invocation: ProviderInvocationSummary | null;
};

export type TaskInvocationResult = {
  taskRun: Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>;
  providerOutput?: unknown;
  hookOutput?: unknown;
};

export type SuggestComponentRevisionInvocation =
  | {
      ok: true;
      output: {
        proposedText: string;
        rationale: string;
        confidence: number;
        sourceComponentId: string;
        warnings: string[];
      };
      suggestion: AiSuggestion;
      taskRun: NonNullable<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>;
    }
  | {
      ok: false;
      error: "provider_invocation_failed" | "provider_output_invalid";
      taskRun: NonNullable<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>;
    };

type ProviderRuntimeContext = {
  settings: ProviderSettings;
  selection: SelectedProfileResolution;
  registryUrl: string | undefined;
  registryUrlSource: "saved" | "env" | "none";
  demoMode: boolean;
  taskKey: string;
  taskAsset: ProviderTaskAsset | null;
  taskAssets: ProviderTaskAsset[];
  registry?: RegistryLookupResult;
  providers: RegistryProviderConfig[];
  selectedProvider: RegistryProviderConfig | null;
  readiness: ReadinessResponse;
};

export type ArtifactReviewProviderRuntime = {
  getReadiness(taskKey?: string): Promise<ArtifactReviewProviderReadiness>;
  getRenderSlotActions(slot: string): Promise<RenderSlotAction[]>;
  invokeTask(taskKey: string, input: unknown, runtime?: RuntimeContext): Promise<TaskInvocationResult>;
  invokeSuggestComponentRevision(component: ReviewComponentForMutation): Promise<SuggestComponentRevisionInvocation>;
  getTaskRun(taskRunId: string): Promise<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>;
};

export function createArtifactReviewProviderRuntime(
  config: AppConfig,
  repositories: Repositories | null
): ArtifactReviewProviderRuntime {
  return new ArtifactReviewProviderRuntimeService(config, repositories);
}

export function getRegisteredProviderAdapterKeys(): string[] {
  return listProviderAdapters().map((adapter) => adapter.adapterKey).sort();
}

class ArtifactReviewProviderRuntimeService implements ArtifactReviewProviderRuntime {
  private readonly contextCache = new Map<string, Promise<ProviderRuntimeContext>>();

  constructor(
    private readonly config: AppConfig,
    private readonly repositories: Repositories | null
  ) {}

  async getReadiness(taskKey: string = suggestComponentRevisionTaskKey): Promise<ArtifactReviewProviderReadiness> {
    const context = await this.buildContext(taskKey);
    return {
      taskKey,
      ...context.readiness,
      invocation: buildInvocationSummary(context)
    };
  }

  async getRenderSlotActions(slot: string): Promise<RenderSlotAction[]> {
    const context = await this.buildContext(suggestComponentRevisionTaskKey);
    const runtime = this.buildTargetRuntime(context);
    return await runtime.getRenderSlotActions(slot);
  }

  async invokeTask(taskKey: string, input: unknown, runtime?: RuntimeContext): Promise<TaskInvocationResult> {
    const context = await this.buildContext(taskKey);
    const persistedTaskRuns = new Map<string, NonNullable<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>>();
    const targetRuntime = this.buildTargetRuntime(context, {}, persistedTaskRuns);
    const result = await targetRuntime.invokeTask(taskKey, {
      input,
      runtime: buildRuntimeContext(runtime),
      correlationId: randomUUID()
    });
    return {
      taskRun: readPersistedTaskRun(persistedTaskRuns, result.taskRun.taskRunId) ?? await this.getTaskRun(result.taskRun.taskRunId),
      providerOutput: result.providerOutput,
      hookOutput: result.hookOutput
    };
  }

  async invokeSuggestComponentRevision(
    component: ReviewComponentForMutation
  ): Promise<SuggestComponentRevisionInvocation> {
    if (!this.repositories) {
      throw new Error("Provider runtime requires configured repositories.");
    }

    const context = await this.buildContext(suggestComponentRevisionTaskKey);
    if (!context.taskAsset) {
      throw new Error("Provider task asset is required before invoking a provider task.");
    }

    const persistedTaskRuns = new Map<string, NonNullable<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>>();
    const targetRuntime = this.buildTargetRuntime(
      context,
      {
        validateOutput: (output) => validateSuggestComponentRevisionOutput(output, component.id)
      },
      persistedTaskRuns
    );
    const result = await targetRuntime.invokeTask(suggestComponentRevisionTaskKey, {
      input: buildSuggestComponentRevisionInput(component),
      runtime: buildRuntimeContext(),
      correlationId: randomUUID()
    });
    const appTaskRun = readPersistedTaskRun(persistedTaskRuns, result.taskRun.taskRunId) ?? await this.requireTaskRun(result.taskRun.taskRunId);
    const parsedOutput = suggestComponentRevisionOutputSchema.safeParse(result.providerOutput);

    if (result.taskRun.status !== "succeeded" || !parsedOutput.success) {
      return {
        ok: false,
        error: result.taskRun.errorClass === "output_validation_failed"
          ? "provider_output_invalid"
          : "provider_invocation_failed",
        taskRun: appTaskRun
      };
    }

    const suggestion = await this.repositories.aiSuggestions.createSuggestion({
      componentId: component.id,
      taskRunId: appTaskRun.id,
      proposedText: parsedOutput.data.proposedText,
      rationale: parsedOutput.data.rationale,
      confidence: parsedOutput.data.confidence,
      warnings: parsedOutput.data.warnings
    });

    return {
      ok: true,
      output: parsedOutput.data,
      suggestion,
      taskRun: appTaskRun
    };
  }

  async getTaskRun(taskRunId: string) {
    return this.repositories ? await this.repositories.taskRuns.getTaskRun(taskRunId) : null;
  }

  private async requireTaskRun(taskRunId: string) {
    const taskRun = await this.getTaskRun(taskRunId);
    if (!taskRun) {
      throw new Error(`Task run ${taskRunId} was not persisted.`);
    }
    return taskRun;
  }

  private async buildContext(taskKey: string): Promise<ProviderRuntimeContext> {
    const cached = this.contextCache.get(taskKey);
    if (cached) {
      return await cached;
    }

    const context = this.buildContextUncached(taskKey);
    this.contextCache.set(taskKey, context);
    return await context;
  }

  private async buildContextUncached(taskKey: string): Promise<ProviderRuntimeContext> {
    const settings = (await this.repositories?.appSettings.getProviderRuntimeSettings()) ?? {};
    const selection = resolveSelectedProfileSelection(this.config, settings);
    const registrySelection = resolveProviderRegistryUrl(this.config, settings);
    const demoModeSelection = resolveDemoProviderMode(this.config, settings);
    const taskAssets = this.repositories ? await this.repositories.providerTasks.listTaskAssets() : [];
    const taskAsset = taskAssets.find((asset) => asset.taskKey === taskKey) ?? null;
    const demoMode = demoModeSelection.enabled;
    const registry =
      !demoMode && registrySelection.registryUrl && selection.profileKey
        ? await fetchRegistryLookup(registrySelection.registryUrl, selection.profileKey)
        : undefined;
    const providers = demoMode ? [buildDemoProviderConfig()] : registry?.providers ?? [];
    const selectedProvider = demoMode ? providers[0]! : selectProviderForTask(providers, taskAsset);
    const readiness = buildProviderReadiness(this.config, settings, {
      taskKey,
      taskAsset,
      registry,
      secretEnv: process.env,
      registeredAdapterKeys: getRegisteredProviderAdapterKeys()
    });

    return {
      settings,
      selection,
      registryUrl: registrySelection.registryUrl,
      registryUrlSource: registrySelection.source,
      demoMode,
      taskKey,
      taskAsset,
      taskAssets,
      registry,
      providers,
      selectedProvider,
      readiness
    };
  }

  private buildTargetRuntime(
    context: ProviderRuntimeContext,
    services: Partial<InvocationServices> = {},
    persistedTaskRuns: Map<string, NonNullable<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>> = new Map()
  ): TargetAppRuntimeService {
    if (!this.repositories) {
      throw new Error("Provider runtime requires configured repositories.");
    }

    const tasks = context.taskAssets.map((asset) =>
      buildTaskDefinition(asset, context.demoMode ? buildDemoProviderConfig() : selectProviderForTask(context.providers, asset))
    );
    const hooks = buildProcessingHooks(context.taskAssets);
    const providers = context.providers;

    return new TargetAppRuntimeService({
      repositories: {
        tasks: {
          listTasks: () => tasks
        },
        hooks: {
          listHooks: () => hooks
        },
        taskRuns: {
          saveTaskRun: async (taskRun) => {
            const appTaskRun = await this.repositories!.taskRuns.createTaskRun({
              id: taskRun.taskRunId,
              taskKey: taskRun.taskKey,
              providerKey: taskRun.providerKey ?? null,
              providerProfileKey: context.demoMode ? "demo" : context.selection.profileKey,
              promptVersion: taskRun.promptVersion ?? context.taskAsset?.promptVersion ?? "unknown",
              status: taskRun.status,
              validationStatus: taskRun.outputValidation
                ? taskRun.outputValidation.valid
                  ? "valid"
                  : "invalid"
                : taskRun.status === "succeeded"
                  ? "valid"
                  : null,
              externalSend: providers.find((provider) => provider.providerKey === taskRun.providerKey)?.externalSend ?? false,
              latencyMs: taskRun.latencyMs ?? null,
              provenance: buildTaskRunProvenance(taskRun, context)
            });
            persistedTaskRuns.set(appTaskRun.id, appTaskRun);
          }
        }
      },
      providers,
      adapters: listProviderAdapters(),
      hostHooks: buildHostHooks(),
      runtime: buildRuntimeContext(),
      secrets: resolveSecretAvailability(providers),
      services: {
        createId: randomUUID,
        log: logProviderRuntimeEvent,
        ...services
      }
    });
  }
}

function buildInvocationSummary(context: ProviderRuntimeContext): ProviderInvocationSummary | null {
  const taskAsset = context.taskAsset;
  if (!taskAsset) {
    return null;
  }

  const blocker = context.readiness.checks.find((check) => !check.ready)?.reason ?? null;
  const provider = context.selectedProvider;
  const selectionMode = context.demoMode
    ? "demo"
    : taskAsset.providerKey
      ? "task-provider"
      : provider
        ? "profile-capability"
        : "none";

  return {
    taskKey: taskAsset.taskKey,
    renderSlot: taskAsset.renderSlot,
    providerKey: provider?.providerKey ?? taskAsset.providerKey,
    providerDisplayName: provider?.displayName ?? null,
    providerProfileKey: context.demoMode ? "demo" : context.selection.profileKey ?? null,
    providerProfileSource: context.demoMode ? "none" : context.selection.source,
    adapterKey: provider?.adapterKey ?? null,
    model: provider?.model ?? null,
    externalSend: provider?.externalSend ?? false,
    promptVersion: taskAsset.promptVersion,
    demoMode: context.demoMode,
    selectionMode,
    selectionNote: buildSelectionNote(selectionMode, provider),
    readinessBlocker: blocker
  };
}

function readPersistedTaskRun(
  taskRuns: Map<string, NonNullable<Awaited<ReturnType<Repositories["taskRuns"]["getTaskRun"]>>>>,
  taskRunId: string
) {
  return taskRuns.get(taskRunId) ?? Array.from(taskRuns.values()).at(-1) ?? null;
}

function buildSelectionNote(selectionMode: ProviderInvocationSummary["selectionMode"], provider: ProviderConfig | null): string {
  if (selectionMode === "demo") {
    return "Explicit deterministic demo mode is selected.";
  }

  if (selectionMode === "task-provider") {
    return "Task configuration names the provider.";
  }

  if (selectionMode === "profile-capability") {
    return `Using profile capability match${provider ? `: ${provider.displayName}` : ""}.`;
  }

  return "No provider is selected for this task.";
}

function buildProcessingHooks(taskAssets: ProviderTaskAsset[]): ProcessingHook[] {
  const hooks = new Map<string, ProcessingHook>();
  for (const asset of taskAssets) {
    hooks.set(asset.hookKey, {
      hookKey: asset.hookKey,
      displayName: asset.hookKey,
      implementationStatus: asset.hookImplementationKey === asset.hookKey ? "implemented" : "unimplemented"
    });
  }
  return Array.from(hooks.values());
}

function buildHostHooks(): Record<string, HostHook> {
  return {
    "store-ai-suggestion": (invocation) => ({
      applied: true,
      output: invocation.providerResult?.output
    })
  };
}

function listProviderAdapters(env: NodeJS.ProcessEnv = process.env): ProviderAdapter[] {
  return [
    new ArtifactReviewDemoSuggestionAdapter(),
    new SecretResolvingOpenAiCompatibleAdapter(OPENAI_COMPATIBLE_CLOUD_ADAPTER_KEY, env),
    new SecretResolvingOpenAiCompatibleAdapter(OPENAI_COMPATIBLE_LOCAL_ADAPTER_KEY, env),
    new DeterministicTextAdapter(),
    new DeterministicJsonAdapter(),
    new DeterministicSttAdapter(),
    new DeterministicOcrAdapter(),
    new DeterministicTtsAdapter(),
    new DeterministicModuleAdapter()
  ];
}

class ArtifactReviewDemoSuggestionAdapter implements ProviderAdapter {
  readonly adapterKey = demoAdapterKey;

  async invoke(request: ProviderInvocationRequest): Promise<ProviderInvocationResult> {
    const input = request.hostContext.input as ReturnType<typeof buildSuggestComponentRevisionInput>;
    const normalizedText = input.currentText.replace(/\s+/g, " ").trim();
    const proposedText = normalizeSuggestionText(normalizedText);
    const changed = proposedText !== input.currentText;

    return {
      output: {
        proposedText,
        rationale: changed
          ? "Proposed a clearer review revision while preserving the component meaning."
          : "No substantive rewrite was needed; the proposal preserves the current component text.",
        confidence: changed ? 0.78 : 0.62,
        sourceComponentId: input.componentId,
        warnings: []
      },
      latencyMs: 0
    };
  }
}

class SecretResolvingOpenAiCompatibleAdapter implements ProviderAdapter {
  constructor(
    readonly adapterKey: string,
    private readonly env: NodeJS.ProcessEnv
  ) {}

  async invoke(request: ProviderInvocationRequest): Promise<ProviderInvocationResult> {
    const apiKey = this.resolveApiKey(request.provider);
    const adapter = new OpenAiCompatibleTextAdapter({
      adapterKey: this.adapterKey,
      apiKey
    });
    return await adapter.invoke(request);
  }

  private resolveApiKey(provider: ProviderConfig): string {
    const secretRef = provider.requiredSecretRef?.trim();
    if (secretRef) {
      const value = this.env[secretRef];
      if (value) {
        return value;
      }
      throw classifiedError("missing_secret", `Secret ${secretRef} is unavailable.`);
    }

    if (this.adapterKey === OPENAI_COMPATIBLE_LOCAL_ADAPTER_KEY) {
      return "local-openai-compatible";
    }

    throw classifiedError("missing_secret", `Provider ${provider.providerKey} does not declare requiredSecretRef.`);
  }
}

function buildDemoProviderConfig(): ProviderConfig {
  return {
    providerKind: "llm",
    providerKey: demoProviderKey,
    adapterKey: demoAdapterKey,
    displayName: "Artifact Review Demo Provider",
    enabled: true,
    externalSend: false,
    capabilities: [
      {
        key: "llm.generateJson",
        displayName: "Generate structured JSON"
      }
    ],
    health: { status: "healthy" }
  };
}

function buildTaskDefinition(taskAsset: ProviderTaskAsset, provider: ProviderConfig | null): TaskDefinition {
  const prompt = readPromptObject(taskAsset.prompt);
  return {
    taskKey: taskAsset.taskKey,
    displayName: readString(prompt.name) ?? taskAsset.taskKey,
    hookKey: taskAsset.hookKey,
    renderSlot: taskAsset.renderSlot,
    displayOrder: 0,
    selectedProviderKey: provider?.providerKey ?? taskAsset.providerKey ?? undefined,
    requiredCapability: taskAsset.requiredCapability as TaskDefinition["requiredCapability"],
    prompt: {
      systemInstructions: readString(prompt.systemInstructions),
      userInstructions: readString(prompt.userInstructions),
      structuredOutputSchema: taskAsset.schema ?? undefined,
      promptVersion: taskAsset.promptVersion
    },
    enabled: true,
    requiredRuntimeKeys: [localRuntimeKey]
  };
}

function buildSuggestComponentRevisionInput(component: ReviewComponentForMutation) {
  return {
    componentId: component.id,
    componentKind: component.kind,
    sectionId: component.sectionId,
    currentText: component.currentText,
    sourceRange: component.sourceRange
  };
}

function validateSuggestComponentRevisionOutput(output: unknown, componentId: string) {
  const parsed = suggestComponentRevisionOutputSchema.safeParse(output);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => issue.message)
    };
  }

  if (parsed.data.sourceComponentId !== componentId) {
    return {
      valid: false,
      errors: [`Provider output sourceComponentId ${parsed.data.sourceComponentId} did not match ${componentId}.`]
    };
  }

  return { valid: true };
}

function resolveSecretAvailability(providers: ProviderConfig[]): SecretAvailability {
  return {
    availableSecretRefs: providers
      .map((provider) => provider.requiredSecretRef)
      .filter((secretRef): secretRef is string => Boolean(secretRef && process.env[secretRef]))
  };
}

function buildRuntimeContext(runtime: RuntimeContext = {}): RuntimeContext {
  return {
    availableRuntimeKeys: [localRuntimeKey, ...(runtime.availableRuntimeKeys ?? [])],
    environment: process.env.NODE_ENV ?? "development",
    commitSha: process.env.GIT_COMMIT_SHA ?? process.env.SOURCE_VERSION,
    ...runtime
  };
}

function buildTaskRunProvenance(taskRun: InvokeProviderTaskRun, context: ProviderRuntimeContext): JsonValue {
  const provider = context.providers.find((entry) => entry.providerKey === taskRun.providerKey);
  const taskAsset = context.taskAssets.find((asset) => asset.taskKey === taskRun.taskKey) ?? context.taskAsset;

  return toJsonValue({
    providerRuntime: "invoke-providers-for-tasks",
    invokeProviderTaskRun: taskRun,
    selectedProfileSource: context.demoMode ? "demo" : context.selection.source,
    registryUrlSource: context.registryUrlSource,
    adapterKey: taskRun.adapterKey ?? provider?.adapterKey,
    hookKey: taskAsset?.hookKey,
    renderSlot: taskAsset?.renderSlot,
    schemaVersion: taskAsset?.schemaVersion,
    registryProfileFound: context.demoMode ? true : Boolean(context.registry?.profile),
    outputValid: taskRun.outputValidation?.valid ?? taskRun.status === "succeeded"
  });
}

function logProviderRuntimeEvent(event: Parameters<NonNullable<InvocationServices["log"]>>[0]) {
  if (event.level === "error") {
    console.error(`[provider-runtime] ${event.message}`, {
      taskKey: event.taskKey,
      providerKey: event.providerKey,
      correlationId: event.correlationId,
      errorClass: event.errorClass
    });
  }
}

function readPromptObject(value: JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeSuggestionText(value: string): string {
  const simplified = value
    .replace(/\bin order to\b/gi, "to")
    .replace(/\butilize\b/gi, "use")
    .replace(/\bUtilize\b/g, "Use");

  if (!simplified) {
    return value;
  }

  return /[.!?]$/.test(simplified) ? simplified : `${simplified}.`;
}

function classifiedError(errorClass: string, message: string): Error {
  const error = new Error(message);
  Object.assign(error, { errorClass });
  return error;
}
