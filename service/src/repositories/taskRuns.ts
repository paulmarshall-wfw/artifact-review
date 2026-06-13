import { randomUUID } from "node:crypto";
import { toJsonValue, type JsonValue, type Queryable } from "./types.js";

export type TaskRun = {
  id: string;
  taskKey: string;
  providerKey: string | null;
  providerProfileKey: string | null;
  promptVersion: string;
  status: string;
  validationStatus: string | null;
  externalSend: boolean;
  latencyMs: number | null;
  provenance: JsonValue;
  createdAt: Date;
};

type TaskRunRow = {
  id: string;
  task_key: string;
  provider_key: string | null;
  provider_profile_key: string | null;
  prompt_version: string;
  status: string;
  validation_status: string | null;
  external_send: boolean;
  latency_ms: number | null;
  provenance: JsonValue;
  created_at: Date;
};

export type UpsertTaskDefinitionInput = {
  taskKey: string;
  providerKey?: string | null;
  requiredCapability: string;
  promptVersion: string;
  renderSlot: string;
  hookKey: string;
};

export type CreateTaskRunInput = {
  id?: string;
  taskKey: string;
  providerKey?: string | null;
  providerProfileKey?: string | null;
  promptVersion: string;
  status: string;
  validationStatus?: string | null;
  externalSend?: boolean;
  latencyMs?: number | null;
  provenance?: JsonValue;
};

export class TaskRunsRepository {
  constructor(private readonly db: Queryable) {}

  async upsertTaskDefinition(input: UpsertTaskDefinitionInput): Promise<void> {
    await this.db.query(
      `
        insert into task_definitions
          (task_key, provider_key, required_capability, prompt_version, render_slot, hook_key)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (task_key)
        do update set
          provider_key = excluded.provider_key,
          required_capability = excluded.required_capability,
          prompt_version = excluded.prompt_version,
          render_slot = excluded.render_slot,
          hook_key = excluded.hook_key
      `,
      [
        input.taskKey,
        input.providerKey ?? null,
        input.requiredCapability,
        input.promptVersion,
        input.renderSlot,
        input.hookKey
      ]
    );
  }

  async createTaskRun(input: CreateTaskRunInput): Promise<TaskRun> {
    const result = await this.db.query<TaskRunRow>(
      `
        insert into task_runs
          (
            id, task_key, provider_key, provider_profile_key, prompt_version, status,
            validation_status, external_send, latency_ms, provenance
          )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning
          id, task_key, provider_key, provider_profile_key, prompt_version, status,
          validation_status, external_send, latency_ms, provenance, created_at
      `,
      [
        input.id ?? randomUUID(),
        input.taskKey,
        input.providerKey ?? null,
        input.providerProfileKey ?? null,
        input.promptVersion,
        input.status,
        input.validationStatus ?? null,
        input.externalSend ?? false,
        input.latencyMs ?? null,
        toJsonValue(input.provenance ?? {})
      ]
    );

    return mapTaskRun(result.rows[0]!);
  }

  async getTaskRun(taskRunId: string): Promise<TaskRun | null> {
    const result = await this.db.query<TaskRunRow>(
      `
        select
          id, task_key, provider_key, provider_profile_key, prompt_version, status,
          validation_status, external_send, latency_ms, provenance, created_at
        from task_runs
        where id = $1
      `,
      [taskRunId]
    );
    return result.rows[0] ? mapTaskRun(result.rows[0]) : null;
  }

  async listTaskRuns(limit = 25): Promise<TaskRun[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const result = await this.db.query<TaskRunRow>(
      `
        select
          id, task_key, provider_key, provider_profile_key, prompt_version, status,
          validation_status, external_send, latency_ms, provenance, created_at
        from task_runs
        order by created_at desc
        limit $1
      `,
      [safeLimit]
    );
    return result.rows.map(mapTaskRun);
  }
}

function mapTaskRun(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    taskKey: row.task_key,
    providerKey: row.provider_key,
    providerProfileKey: row.provider_profile_key,
    promptVersion: row.prompt_version,
    status: row.status,
    validationStatus: row.validation_status,
    externalSend: row.external_send,
    latencyMs: row.latency_ms,
    provenance: row.provenance,
    createdAt: row.created_at
  };
}
