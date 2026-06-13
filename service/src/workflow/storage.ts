import {
  StateWorkflowRuntimeError,
  type ActiveWorkflowSelection,
  type DefinitionBundle,
  type DefinitionSelectionKey,
  type HandlerFailureRecord,
  type ItemRef,
  type ListItemStatesFilter,
  type ListStateResidentHookWorkFilter,
  type MigrationStatusRecord,
  type SaveItemStateOptions,
  type StateResidentHookWorkRecord,
  type StateWorkflowStorageAdapter,
  type TransitionHistoryRecord,
  type WorkflowEventJournalRecord,
  type WorkflowEventViews,
  type WorkflowId,
  type WorkflowItemState,
  type CancelStateResidentHookWorkInput,
  type ClaimDueStateResidentHookWorkInput
} from "state-workflow-runtime";
import { type JsonValue, type Queryable } from "../repositories/types.js";

const keyPrefix = "stateWorkflowRuntime.";

type RuntimeState = {
  definitionBundles: Record<string, DefinitionBundle>;
  activeSelections: Record<string, ActiveWorkflowSelection>;
  itemStates: Record<string, WorkflowItemState>;
  transitionHistory: TransitionHistoryRecord[];
  workflowEvents: WorkflowEventJournalRecord[];
  stateResidentHookWork: Record<string, StateResidentHookWorkRecord>;
  migrationStatuses: MigrationStatusRecord[];
  handlerFailures: HandlerFailureRecord[];
};

export class PostgresStateWorkflowStorageAdapter implements StateWorkflowStorageAdapter {
  constructor(private readonly db: Queryable) {}

  async transaction<T>(operation: (storage: StateWorkflowStorageAdapter) => Promise<T>): Promise<T> {
    return operation(this);
  }

  async saveDefinitionBundle(bundle: DefinitionBundle): Promise<void> {
    const state = await this.readState();
    state.definitionBundles[definitionBundleKey(bundle)] = bundle;
    await this.writeState(state);
  }

  async listDefinitionBundles(workflowId: WorkflowId): Promise<readonly DefinitionBundle[]> {
    const state = await this.readState();
    return Object.values(state.definitionBundles).filter((bundle) => bundle.workflowDefinition.workflowId === workflowId);
  }

  async setActiveDefinitionSelection(selection: ActiveWorkflowSelection): Promise<void> {
    const state = await this.readState();
    state.activeSelections[selectionKey(selection.workflowId, selection.variantKey)] = selection;
    await this.writeState(state);
  }

  async getActiveDefinitionSelection(key: DefinitionSelectionKey): Promise<ActiveWorkflowSelection | null> {
    const state = await this.readState();
    return state.activeSelections[selectionKey(key.workflowId, key.variantKey)] ?? null;
  }

  async getItemState(itemRef: ItemRef): Promise<WorkflowItemState | null> {
    const state = await this.readState();
    return state.itemStates[itemKey(itemRef)] ?? null;
  }

  async listItemStates(filter: ListItemStatesFilter = {}): Promise<readonly WorkflowItemState[]> {
    const state = await this.readState();
    return Object.values(state.itemStates).filter((itemState) => {
      if (filter.workflowId !== undefined && itemState.activeSelection.workflowId !== filter.workflowId) {
        return false;
      }
      return !(filter.variantKey !== undefined && itemState.activeSelection.variantKey !== filter.variantKey);
    });
  }

  async saveItemState(itemState: WorkflowItemState, options: SaveItemStateOptions = {}): Promise<void> {
    const state = await this.readState();
    const key = itemKey(itemState.itemRef);
    const existing = state.itemStates[key];

    if (
      options.expectedItemVersion !== undefined &&
      (existing === undefined || existing.itemVersion !== options.expectedItemVersion)
    ) {
      throw new StateWorkflowRuntimeError("stale_item_version", "Item state version is stale.", {
        expectedItemVersion: options.expectedItemVersion,
        actualItemVersion: existing?.itemVersion ?? null
      });
    }

    state.itemStates[key] = itemState;
    await this.writeState(state);
  }

  async saveStateResidentHookWork(record: StateResidentHookWorkRecord): Promise<void> {
    const state = await this.readState();
    state.stateResidentHookWork[record.workId] = record;
    await this.writeState(state);
  }

  async getStateResidentHookWork(workId: string): Promise<StateResidentHookWorkRecord | null> {
    const state = await this.readState();
    return state.stateResidentHookWork[workId] ?? null;
  }

  async listStateResidentHookWork(
    filter: ListStateResidentHookWorkFilter = {}
  ): Promise<readonly StateResidentHookWorkRecord[]> {
    const state = await this.readState();
    return Object.values(state.stateResidentHookWork).filter((record) => {
      if (filter.itemRef !== undefined && itemKey(record.itemRef) !== itemKey(filter.itemRef)) {
        return false;
      }
      return !(filter.status !== undefined && record.status !== filter.status);
    });
  }

  async cancelStateResidentHookWork(input: CancelStateResidentHookWorkInput): Promise<number> {
    const state = await this.readState();
    const now = new Date();
    let canceled = 0;

    for (const [key, record] of Object.entries(state.stateResidentHookWork)) {
      if (
        itemKey(record.itemRef) === itemKey(input.itemRef) &&
        record.targetState === input.targetState &&
        (record.status === "pending" || record.status === "claimed")
      ) {
        state.stateResidentHookWork[key] = {
          ...record,
          status: "canceled",
          claimedBy: undefined,
          leaseExpiresAt: undefined,
          updatedAt: now
        };
        canceled += 1;
      }
    }

    await this.writeState(state);
    return canceled;
  }

  async claimDueStateResidentHookWork(
    input: ClaimDueStateResidentHookWorkInput
  ): Promise<readonly StateResidentHookWorkRecord[]> {
    const state = await this.readState();
    const leaseExpiresAt = new Date(input.now.getTime() + input.leaseDurationMs);
    const due = Object.values(state.stateResidentHookWork)
      .filter(
        (record) =>
          record.dueAt.getTime() <= input.now.getTime() &&
          (record.status === "pending" ||
            (record.status === "claimed" &&
              record.leaseExpiresAt !== undefined &&
              record.leaseExpiresAt.getTime() <= input.now.getTime()))
      )
      .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime() || left.createdAt.getTime() - right.createdAt.getTime())
      .slice(0, input.limit);

    const claimed = due.map((record) => ({
      ...record,
      status: "claimed" as const,
      claimedBy: input.workerId,
      leaseExpiresAt,
      updatedAt: input.now
    }));

    for (const record of claimed) {
      state.stateResidentHookWork[record.workId] = record;
    }

    await this.writeState(state);
    return claimed;
  }

  async appendTransitionHistory(record: TransitionHistoryRecord): Promise<void> {
    const state = await this.readState();
    state.transitionHistory = [...state.transitionHistory, record];
    await this.writeState(state);
  }

  async listTransitionHistory(itemRef?: ItemRef): Promise<readonly TransitionHistoryRecord[]> {
    const state = await this.readState();
    if (!itemRef) {
      return state.transitionHistory;
    }
    const key = itemKey(itemRef);
    return state.transitionHistory.filter((record) => itemKey(record.itemRef) === key);
  }

  async appendWorkflowEvent(record: Omit<WorkflowEventJournalRecord, "sequence">): Promise<WorkflowEventJournalRecord> {
    const state = await this.readState();
    const stored = { ...record, sequence: state.workflowEvents.length + 1 };
    state.workflowEvents = [...state.workflowEvents, stored];
    await this.writeState(state);
    return stored;
  }

  async listWorkflowEvents(itemRef?: ItemRef): Promise<readonly WorkflowEventJournalRecord[]> {
    const state = await this.readState();
    if (!itemRef) {
      return state.workflowEvents;
    }
    const key = itemKey(itemRef);
    return state.workflowEvents.filter((record) => record.itemRef !== undefined && itemKey(record.itemRef) === key);
  }

  async getWorkflowEventViews(itemRef?: ItemRef): Promise<WorkflowEventViews> {
    return projectWorkflowEventViews(await this.listWorkflowEvents(itemRef));
  }

  async recordMigrationStatus(record: MigrationStatusRecord): Promise<void> {
    const state = await this.readState();
    state.migrationStatuses = [...state.migrationStatuses, record];
    await this.writeState(state);
  }

  async listMigrationStatuses(): Promise<readonly MigrationStatusRecord[]> {
    const state = await this.readState();
    return state.migrationStatuses;
  }

  async recordHandlerFailure(record: HandlerFailureRecord): Promise<void> {
    const state = await this.readState();
    state.handlerFailures = [...state.handlerFailures, record];
    await this.writeState(state);
  }

  async listHandlerFailures(): Promise<readonly HandlerFailureRecord[]> {
    const state = await this.readState();
    return state.handlerFailures;
  }

  private async readState(): Promise<RuntimeState> {
    const result = await this.db.query<{ value: JsonValue }>("select value from app_settings where key = $1", [
      `${keyPrefix}state`
    ]);
    return reviveRuntimeState(result.rows[0]?.value);
  }

  private async writeState(state: RuntimeState): Promise<void> {
    await this.db.query(
      `
        insert into app_settings (key, value, updated_at)
        values ($1, $2, now())
        on conflict (key)
        do update set value = excluded.value, updated_at = now()
      `,
      [`${keyPrefix}state`, JSON.stringify(state)]
    );
  }
}

export function createPostgresStateWorkflowStorageAdapter(db: Queryable): StateWorkflowStorageAdapter {
  return new PostgresStateWorkflowStorageAdapter(db);
}

function reviveRuntimeState(value: JsonValue | undefined): RuntimeState {
  const state = isRecord(value) ? (value as unknown as RuntimeState) : emptyRuntimeState();
  return {
    definitionBundles: state.definitionBundles ?? {},
    activeSelections: state.activeSelections ?? {},
    itemStates: state.itemStates ?? {},
    transitionHistory: (state.transitionHistory ?? []).map(reviveTransitionHistoryRecord),
    workflowEvents: (state.workflowEvents ?? []).map(reviveWorkflowEventRecord),
    stateResidentHookWork: Object.fromEntries(
      Object.entries(state.stateResidentHookWork ?? {}).map(([key, record]) => [key, reviveStateResidentHookWork(record)])
    ),
    migrationStatuses: (state.migrationStatuses ?? []).map(reviveMigrationStatusRecord),
    handlerFailures: (state.handlerFailures ?? []).map(reviveHandlerFailureRecord)
  };
}

function emptyRuntimeState(): RuntimeState {
  return {
    definitionBundles: {},
    activeSelections: {},
    itemStates: {},
    transitionHistory: [],
    workflowEvents: [],
    stateResidentHookWork: {},
    migrationStatuses: [],
    handlerFailures: []
  };
}

function definitionBundleKey(bundle: DefinitionBundle): string {
  return [
    bundle.workflowDefinition.workflowId,
    bundle.workflowDefinition.variantKey,
    bundle.workflowDefinition.version,
    bundle.embeddedStateMachineDefinition.version
  ].join(":");
}

function selectionKey(workflowId: string, variantKey: string): string {
  return `${workflowId}:${variantKey}`;
}

function itemKey(itemRef: ItemRef): string {
  return `${itemRef.resourceType}:${itemRef.resourceId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reviveDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

function reviveTransitionHistoryRecord(record: TransitionHistoryRecord): TransitionHistoryRecord {
  return { ...record, occurredAt: reviveDate(record.occurredAt) };
}

function reviveWorkflowEventRecord(record: WorkflowEventJournalRecord): WorkflowEventJournalRecord {
  return { ...record, occurredAt: reviveDate(record.occurredAt) };
}

function reviveStateResidentHookWork(record: StateResidentHookWorkRecord): StateResidentHookWorkRecord {
  return {
    ...record,
    dueAt: reviveDate(record.dueAt),
    createdAt: reviveDate(record.createdAt),
    updatedAt: reviveDate(record.updatedAt),
    leaseExpiresAt: record.leaseExpiresAt ? reviveDate(record.leaseExpiresAt) : undefined
  };
}

function reviveMigrationStatusRecord(record: MigrationStatusRecord): MigrationStatusRecord {
  return { ...record, checkedAt: reviveDate(record.checkedAt) };
}

function reviveHandlerFailureRecord(record: HandlerFailureRecord): HandlerFailureRecord {
  return { ...record, failedAt: reviveDate(record.failedAt) };
}

function projectWorkflowEventViews(events: readonly WorkflowEventJournalRecord[]): WorkflowEventViews {
  return {
    transitions: events.filter(
      (event) =>
        event.eventType === "transition_committed" ||
        event.eventType === "item_initiated" ||
        event.eventType === "item_initialized"
    ),
    actions: events.filter((event) => event.eventType.includes("action")),
    handlers: events.filter((event) => event.eventType.startsWith("handler_")),
    handlerResponses: events.filter((event) => event.eventType === "handler_response_received"),
    recordEvents: events.filter((event) => event.eventType === "record_event"),
    stateHooks: events.filter((event) => event.eventType.startsWith("state_hook_")),
    failures: events.filter(
      (event) => event.severity === "error" || event.eventType.includes("failed") || event.eventType.includes("rejected")
    ),
    debugSteps: events.filter((event) => event.eventType.startsWith("debug_") || event.eventType === "runtime_step")
  };
}
