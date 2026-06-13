import type { JsonValue, Queryable } from "./types.js";

export type ProviderTaskAsset = {
  taskKey: string;
  providerKey: string | null;
  requiredCapability: string;
  promptVersion: string;
  renderSlot: string;
  hookKey: string;
  prompt: JsonValue | null;
  schemaVersion: string | null;
  schema: JsonValue | null;
  hookImplementationKey: string | null;
  hookPolicy: string | null;
};

type ProviderTaskAssetRow = {
  task_key: string;
  provider_key: string | null;
  required_capability: string;
  prompt_version: string;
  render_slot: string;
  hook_key: string;
  prompt: JsonValue | null;
  schema_version: string | null;
  schema: JsonValue | null;
  hook_implementation_key: string | null;
  hook_policy: string | null;
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
}

function mapTaskAsset(row: ProviderTaskAssetRow): ProviderTaskAsset {
  return {
    taskKey: row.task_key,
    providerKey: row.provider_key,
    requiredCapability: row.required_capability,
    promptVersion: row.prompt_version,
    renderSlot: row.render_slot,
    hookKey: row.hook_key,
    prompt: row.prompt,
    schemaVersion: row.schema_version,
    schema: row.schema,
    hookImplementationKey: row.hook_implementation_key,
    hookPolicy: row.hook_policy
  };
}
