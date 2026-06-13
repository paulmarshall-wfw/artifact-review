import type { JsonValue, Queryable } from "./types.js";

export type ProviderTaskAsset = {
  taskKey: string;
  providerKey: string | null;
  requiredCapability: string;
  promptVersion: string;
  renderSlot: string;
  hookKey: string;
  displayOrder: number;
  enabled: boolean;
  modelOverride: string | null;
  displayLabel: string | null;
  displayDescription: string | null;
  prompt: JsonValue | null;
  schemaVersion: string | null;
  schema: JsonValue | null;
  hookImplementationKey: string | null;
  hookPolicy: string | null;
};

export type TaskRouteSummary = {
  taskKey: string;
  displayName: string;
  description: string | null;
  providerKey: string | null;
  requiredCapability: string;
  promptVersion: string;
  renderSlot: string;
  hookKey: string;
  displayOrder: number;
  enabled: boolean;
  modelOverride: string | null;
  hookImplementationKey: string | null;
  hookReady: boolean;
};

export type UpdateTaskRouteInput = {
  providerKey?: string | null;
  renderSlot?: string;
  hookKey?: string;
  displayOrder?: number;
  enabled?: boolean;
  modelOverride?: string | null;
  displayLabel?: string | null;
  displayDescription?: string | null;
};

type ProviderTaskAssetRow = {
  task_key: string;
  provider_key: string | null;
  required_capability: string;
  prompt_version: string;
  render_slot: string;
  hook_key: string;
  display_order: number | null;
  enabled: boolean | null;
  model_override: string | null;
  display_label: string | null;
  display_description: string | null;
  prompt: JsonValue | null;
  schema_version: string | null;
  schema: JsonValue | null;
  hook_implementation_key: string | null;
  hook_policy: string | null;
};

type ProcessingHookRow = {
  hook_key: string;
  implementation_key: string;
  policy: string;
};

export class ProviderTasksRepository {
  constructor(private readonly db: Queryable) {}

  async getTaskAsset(taskKey: string): Promise<ProviderTaskAsset | null> {
    const result = await this.db.query<ProviderTaskAssetRow>(
      `
        select
          task_definitions.task_key,
          task_definitions.provider_key,
          task_definitions.required_capability,
          task_definitions.prompt_version,
          task_definitions.render_slot,
          task_definitions.hook_key,
          task_definitions.display_order,
          task_definitions.enabled,
          task_definitions.model_override,
          task_definitions.display_label,
          task_definitions.display_description,
          prompt_versions.prompt,
          structured_output_schemas.version as schema_version,
          structured_output_schemas.schema,
          processing_hooks.implementation_key as hook_implementation_key,
          processing_hooks.policy as hook_policy
        from task_definitions
        left join prompt_versions
          on prompt_versions.task_key = task_definitions.task_key
          and prompt_versions.version = task_definitions.prompt_version
        left join structured_output_schemas
          on structured_output_schemas.task_key = task_definitions.task_key
          and structured_output_schemas.version = task_definitions.prompt_version
        left join processing_hooks
          on processing_hooks.hook_key = task_definitions.hook_key
        where task_definitions.task_key = $1
      `,
      [taskKey]
    );

    return result.rows[0] ? mapTaskAsset(result.rows[0]) : null;
  }

  async listTaskAssets(): Promise<ProviderTaskAsset[]> {
    const result = await this.db.query<ProviderTaskAssetRow>(
      `
        select
          task_definitions.task_key,
          task_definitions.provider_key,
          task_definitions.required_capability,
          task_definitions.prompt_version,
          task_definitions.render_slot,
          task_definitions.hook_key,
          task_definitions.display_order,
          task_definitions.enabled,
          task_definitions.model_override,
          task_definitions.display_label,
          task_definitions.display_description,
          prompt_versions.prompt,
          structured_output_schemas.version as schema_version,
          structured_output_schemas.schema,
          processing_hooks.implementation_key as hook_implementation_key,
          processing_hooks.policy as hook_policy
        from task_definitions
        left join prompt_versions
          on prompt_versions.task_key = task_definitions.task_key
          and prompt_versions.version = task_definitions.prompt_version
        left join structured_output_schemas
          on structured_output_schemas.task_key = task_definitions.task_key
          and structured_output_schemas.version = task_definitions.prompt_version
        left join processing_hooks
          on processing_hooks.hook_key = task_definitions.hook_key
        order by task_definitions.render_slot asc, task_definitions.display_order asc, task_definitions.task_key asc
      `
    );

    return result.rows.map(mapTaskAsset);
  }

  async listTaskRoutes(): Promise<TaskRouteSummary[]> {
    const assets = await this.listTaskAssets();
    return assets.map(mapTaskRouteSummary);
  }

  async updateTaskRoute(taskKey: string, input: UpdateTaskRouteInput): Promise<TaskRouteSummary | null> {
    const current = await this.getTaskAsset(taskKey);
    if (!current) {
      return null;
    }

    const next = {
      providerKey: normalizeNullableString(input.providerKey, current.providerKey),
      renderSlot: input.renderSlot?.trim() || current.renderSlot,
      hookKey: input.hookKey?.trim() || current.hookKey,
      displayOrder: typeof input.displayOrder === "number" ? input.displayOrder : current.displayOrder,
      enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      modelOverride: normalizeNullableString(input.modelOverride, current.modelOverride),
      displayLabel: normalizeNullableString(input.displayLabel, current.displayLabel),
      displayDescription: normalizeNullableString(input.displayDescription, current.displayDescription)
    };

    await this.db.query(
      `
        update task_definitions
        set
          provider_key = $2,
          render_slot = $3,
          hook_key = $4,
          display_order = $5,
          enabled = $6,
          model_override = $7,
          display_label = $8,
          display_description = $9
        where task_key = $1
      `,
      [
        taskKey,
        next.providerKey,
        next.renderSlot,
        next.hookKey,
        next.displayOrder,
        next.enabled,
        next.modelOverride,
        next.displayLabel,
        next.displayDescription
      ]
    );

    const updated = await this.getTaskAsset(taskKey);
    return updated ? mapTaskRouteSummary(updated) : null;
  }

  async listProcessingHooks(): Promise<ProcessingHookRow[]> {
    const result = await this.db.query<ProcessingHookRow>(
      `
        select hook_key, implementation_key, policy
        from processing_hooks
        order by hook_key asc
      `
    );
    return result.rows;
  }
}

function mapTaskAsset(row: ProviderTaskAssetRow): ProviderTaskAsset {
  return {
    taskKey: row.task_key,
    providerKey: row.provider_key,
    requiredCapability: row.required_capability,
    promptVersion: row.prompt_version,
    renderSlot: row.render_slot,
    hookKey: row.hook_key,
    displayOrder: row.display_order ?? 0,
    enabled: row.enabled ?? true,
    modelOverride: row.model_override,
    displayLabel: row.display_label,
    displayDescription: row.display_description,
    prompt: row.prompt,
    schemaVersion: row.schema_version,
    schema: row.schema,
    hookImplementationKey: row.hook_implementation_key,
    hookPolicy: row.hook_policy
  };
}

function mapTaskRouteSummary(asset: ProviderTaskAsset): TaskRouteSummary {
  return {
    taskKey: asset.taskKey,
    displayName: asset.displayLabel ?? readPromptName(asset.prompt) ?? asset.taskKey,
    description: asset.displayDescription,
    providerKey: asset.providerKey,
    requiredCapability: asset.requiredCapability,
    promptVersion: asset.promptVersion,
    renderSlot: asset.renderSlot,
    hookKey: asset.hookKey,
    displayOrder: asset.displayOrder,
    enabled: asset.enabled,
    modelOverride: asset.modelOverride,
    hookImplementationKey: asset.hookImplementationKey,
    hookReady: asset.hookImplementationKey === asset.hookKey
  };
}

function readPromptName(prompt: JsonValue | null): string | null {
  if (!prompt || typeof prompt !== "object" || Array.isArray(prompt)) {
    return null;
  }
  const name = prompt.name;
  return typeof name === "string" && name.trim() ? name : null;
}

function normalizeNullableString(value: string | null | undefined, fallback: string | null): string | null {
  if (value === undefined) {
    return fallback;
  }
  return value?.trim() || null;
}
