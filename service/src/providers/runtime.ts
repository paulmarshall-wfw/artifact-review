import { randomUUID } from "node:crypto";
import {
  invokeTask,
  type HostHook,
  type ProviderAdapter,
  type ProviderConfig,
  type ProviderInvocationRequest,
  type ProviderInvocationResult,
  type SecretAvailability,
  type TaskDefinition,
  type TaskRun as InvokeProviderTaskRun
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
import type { RegistryProviderConfig } from "./registry.js";
import { suggestComponentRevisionOutputSchema } from "./tasks.js";
import type { Repositories } from "../repositories/index.js";
import type { ProviderTaskAsset } from "../repositories/providerTasks.js";
import type { ReviewComponentForMutation } from "../repositories/review.js";
import { toJsonValue, type JsonValue } from "../repositories/types.js";

export const suggestComponentRevisionTaskKey = "suggest-component-revision";
const demoProviderKey = "artifact-review-demo";
const demoAdapterKey = "artifact-review-demo-suggestion";

export type ProviderInvocationContext = {
  taskAsset: ProviderTaskAsset | null;
  provider: RegistryProviderConfig | null;
  selectedProfileKey: string | undefined;
  selectedProfileSource: "saved" | "env" | "none";
  registryProfileFound: boolean;
  demoMode: boolean;
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
      taskRun: Awaited<ReturnType<Repositories["taskRuns"]["createTaskRun"]>>;
    }
  | {
      ok: false;
      error: "provider_invocation_failed" | "provider_output_invalid";
      taskRun: Awaited<ReturnType<Repositories["taskRuns"]["createTaskRun"]>>;
    };

export function getRegisteredProviderAdapterKeys(): string[] {
  return listProviderAdapters().map((adapter) => adapter.adapterKey).sort();
}

export async function invokeSuggestComponentRevision(
  repositories: Repositories,
  component: ReviewComponentForMutation,
  context: ProviderInvocationContext
): Promise<SuggestComponentRevisionInvocation> {
  const taskAsset = context.taskAsset;
  if (!taskAsset) {
    throw new Error("Provider task asset is required before invoking a provider task.");
  }

  const provider = context.demoMode ? buildDemoProviderConfig() : context.provider;
  if (!provider) {
    throw new Error("Provider readiness passed without a selected provider.");
  }

  const task = buildTaskDefinition(taskAsset, provider);
  const hook = {
    hookKey: taskAsset.hookKey,
    displayName: taskAsset.hookKey,
    implementationStatus: taskAsset.hookImplementationKey === taskAsset.hookKey ? "implemented" as const : "unimplemented" as const
  };
  const hostHooks: Record<string, HostHook> = {
    [taskAsset.hookKey]: (invocation) => ({
      applied: true,
      output: invocation.providerResult?.output
    })
  };
  const providerList = [provider];
  const invocation = await invokeTask(
    task,
    {
      input: buildSuggestComponentRevisionInput(component),
      runtime: { availableRuntimeKeys: ["artifact-review.local-service"] },
      correlationId: randomUUID()
    },
    listProviderAdapters(),
    hostHooks,
    {
      createId: randomUUID,
      log: (event) => {
        if (event.level === "error") {
          console.error(`[provider-runtime] ${event.message}`, {
            taskKey: event.taskKey,
            providerKey: event.providerKey,
            correlationId: event.correlationId,
            errorClass: event.errorClass
          });
        }
      }
    },
    providerList,
    [hook],
    resolveSecretAvailability(providerList)
  );

  const providerOutput = invocation.providerResult?.output;
  const parsedOutput = suggestComponentRevisionOutputSchema.safeParse(providerOutput);
  const outputValid = parsedOutput.success && parsedOutput.data.sourceComponentId === component.id;
  const status = invocation.taskRun.status === "succeeded" && outputValid ? "succeeded" : "failed";
  const appTaskRun = await repositories.taskRuns.createTaskRun({
    id: invocation.taskRun.taskRunId,
    taskKey: task.taskKey,
    providerKey: provider.providerKey,
    providerProfileKey: context.demoMode ? "demo" : context.selectedProfileKey,
    promptVersion: taskAsset.promptVersion,
    status,
    validationStatus: outputValid ? "valid" : "invalid",
    externalSend: provider.externalSend,
    latencyMs: invocation.taskRun.latencyMs ?? null,
    provenance: buildTaskRunProvenance(invocation.taskRun, context, taskAsset, provider, providerOutput, outputValid)
  });

  if (!outputValid) {
    return {
      ok: false,
      error: invocation.taskRun.status === "succeeded" ? "provider_output_invalid" : "provider_invocation_failed",
      taskRun: appTaskRun
    };
  }

  return {
    ok: true,
    output: parsedOutput.data,
    taskRun: appTaskRun
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

function buildTaskDefinition(taskAsset: ProviderTaskAsset, provider: ProviderConfig): TaskDefinition {
  const prompt = readPromptObject(taskAsset.prompt);
  return {
    taskKey: taskAsset.taskKey,
    displayName: readString(prompt.name) ?? taskAsset.taskKey,
    hookKey: taskAsset.hookKey,
    renderSlot: taskAsset.renderSlot,
    displayOrder: 0,
    selectedProviderKey: provider.providerKey,
    requiredCapability: "llm.generateJson",
    prompt: {
      systemInstructions: readString(prompt.systemInstructions),
      userInstructions: readString(prompt.userInstructions),
      structuredOutputSchema: taskAsset.schema ?? undefined,
      promptVersion: taskAsset.promptVersion
    },
    enabled: true,
    requiredRuntimeKeys: ["artifact-review.local-service"]
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

function resolveSecretAvailability(providers: ProviderConfig[]): SecretAvailability {
  return {
    availableSecretRefs: providers
      .map((provider) => provider.requiredSecretRef)
      .filter((secretRef): secretRef is string => Boolean(secretRef && process.env[secretRef]))
  };
}

function buildTaskRunProvenance(
  taskRun: InvokeProviderTaskRun,
  context: ProviderInvocationContext,
  taskAsset: ProviderTaskAsset,
  provider: ProviderConfig,
  providerOutput: unknown,
  outputValid: boolean
): JsonValue {
  return toJsonValue({
    providerRuntime: "invoke-providers-for-tasks",
    invokeProviderTaskRun: taskRun,
    selectedProfileSource: context.selectedProfileSource,
    adapterKey: provider.adapterKey,
    hookKey: taskAsset.hookKey,
    renderSlot: taskAsset.renderSlot,
    schemaVersion: taskAsset.schemaVersion,
    registryProfileFound: context.registryProfileFound,
    outputValid,
    providerOutput
  });
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
