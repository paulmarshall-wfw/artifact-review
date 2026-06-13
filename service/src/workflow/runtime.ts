import {
  createWorkflowRuntime,
  importDefinitionBundle,
  isStateWorkflowRuntimeError,
  validateDefinitionBundle,
  type ActiveWorkflowSelection,
  type ActorContext,
  type AllowedAction,
  type DefinitionBundle,
  type ItemRef,
  type WorkflowActionDefinition,
  type WorkflowBucketDefinition,
  type WorkflowRuntime
} from "state-workflow-runtime";
import { type Repositories } from "../repositories/index.js";
import { createPostgresStateWorkflowStorageAdapter } from "./storage.js";

export const documentWorkflowResourceType = "document";
const defaultVariantKey = "default";
const systemActor: ActorContext = { actorId: "system" };

export type DocumentWorkflowValidationResult =
  | {
      valid: true;
      definition: DefinitionBundle;
      errors: [];
    }
  | {
      valid: false;
      errors: string[];
    };

export function validateDocumentWorkflowDefinition(input: unknown): DocumentWorkflowValidationResult {
  const validation = validateDefinitionBundle(input);
  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.issues.map((issue) => `${issue.path}: ${issue.message}`)
    };
  }

  const imported = importDefinitionBundle(input);
  const errors = validateArtifactReviewDocumentWorkflow(imported.bundle);
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, definition: imported.bundle, errors: [] };
}

export function summarizeWorkflowDefinition(definition: DefinitionBundle) {
  return {
    id: definition.workflowDefinition.workflowId,
    definitionVersion: definition.workflowDefinition.version,
    schemaVersion: definition.stateWorkflowDefinition?.schemaVersion ?? definition.workflowDefinition.schemaVersion,
    states: definition.workflowDefinition.states.map((state) => ({
      id: state.id,
      visible: state.visible
    })),
    buckets: definition.workflowDefinition.buckets.map(summarizeBucket),
    entryStates: getEntryStates(definition),
    visibleActions: definition.workflowDefinition.actions.filter((action) => action.visible).map(summarizeAction)
  };
}

export function getEntryState(definition: DefinitionBundle): string {
  return getEntryStates(definition)[0]!;
}

export function getAllowedWorkflowActions(definition: DefinitionBundle, currentState: string) {
  return definition.workflowDefinition.actions
    .filter((action) => action.from === currentState && action.trigger === "user" && action.visible)
    .map(summarizeAction);
}

export function findWorkflowAction(definition: DefinitionBundle, currentState: string, actionId: string) {
  return getAllowedWorkflowActions(definition, currentState).find((action) => action.id === actionId) ?? null;
}

export function createDocumentWorkflowRuntime(repositories: Repositories): WorkflowRuntime {
  return createWorkflowRuntime({
    storage: createPostgresStateWorkflowStorageAdapter(repositories.db),
    resolveWorkflowVariant: () => defaultVariantKey,
    logger: (event) => {
      if (event.level === "error" || event.level === "warn") {
        console[event.level](`${event.message}`, event.context ?? {});
      }
    }
  });
}

export async function getActiveDocumentWorkflow(repositories: Repositories): Promise<DefinitionBundle | null> {
  const runtime = createDocumentWorkflowRuntime(repositories);
  const selection = await runtime.getActiveDefinitionVersion(documentWorkflowResourceType, defaultVariantKey);
  if (!selection) {
    return null;
  }

  const bundles = await createPostgresStateWorkflowStorageAdapter(repositories.db).listDefinitionBundles(
    documentWorkflowResourceType
  );
  return (
    bundles.find(
      (bundle) =>
        bundle.workflowDefinition.workflowId === selection.workflowId &&
        bundle.workflowDefinition.variantKey === selection.variantKey &&
        bundle.workflowDefinition.version === selection.workflowVersion &&
        bundle.embeddedStateMachineDefinition.version === selection.stateMachineVersion
    ) ?? null
  );
}

export async function activateDocumentWorkflow(
  repositories: Repositories,
  input: unknown
): Promise<{ definition: DefinitionBundle; selection: ActiveWorkflowSelection; initialState: string }> {
  const runtime = createDocumentWorkflowRuntime(repositories);
  const definition = await runtime.importDefinitionBundle(input);
  const errors = validateArtifactReviewDocumentWorkflow(definition);
  if (errors.length > 0) {
    throw new DocumentWorkflowValidationError(errors);
  }

  const selection: ActiveWorkflowSelection = {
    workflowId: definition.workflowDefinition.workflowId,
    variantKey: definition.workflowDefinition.variantKey,
    workflowVersion: definition.workflowDefinition.version,
    stateMachineVersion: definition.embeddedStateMachineDefinition.version
  };
  await runtime.setActiveDefinitionVersion(selection, systemActor);

  return {
    definition,
    selection,
    initialState: getEntryState(definition)
  };
}

export async function initializeDocumentWorkflowState(
  repositories: Repositories,
  documentId: string,
  entryState: string
) {
  const runtime = createDocumentWorkflowRuntime(repositories);
  const itemRef = documentItemRef(documentId);
  const initialized = await runtime.initializeItemWorkflowState(itemRef, {
    entryState,
    actorContext: systemActor,
    metadata: { documentId }
  });
  await repositories.documents.updateDocumentWorkflowState(documentId, initialized.itemState.state);
  return initialized.itemState;
}

export async function getDocumentWorkflowActions(repositories: Repositories, documentId: string) {
  const runtime = createDocumentWorkflowRuntime(repositories);
  const itemRef = documentItemRef(documentId);
  const activeWorkflow = await getActiveDocumentWorkflow(repositories);
  let itemState = await runtime.getItemWorkflowState(itemRef, systemActor);
  if (!itemState) {
    const document = await repositories.documents.getDocument(documentId);
    if (document?.currentWorkflowItemRef) {
      itemState = await adoptDocumentWorkflowState(repositories, documentId, document.currentWorkflowItemRef);
    }
  }
  const currentState = itemState?.state ?? (activeWorkflow ? getEntryState(activeWorkflow) : null);
  const allowedActions = await runtime.getAllowedActions(itemRef, systemActor);

  return {
    currentState,
    actions: summarizeAllowedActions(activeWorkflow, currentState, allowedActions)
  };
}

export async function executeDocumentWorkflowAction(repositories: Repositories, documentId: string, actionId: string) {
  const runtime = createDocumentWorkflowRuntime(repositories);
  const itemRef = documentItemRef(documentId);
  let current = await runtime.getItemWorkflowState(itemRef, systemActor);
  if (!current) {
    const document = await repositories.documents.getDocument(documentId);
    if (document?.currentWorkflowItemRef) {
      current = await adoptDocumentWorkflowState(repositories, documentId, document.currentWorkflowItemRef);
    }
  }
  const result = await runtime.executeAction(itemRef, actionId, systemActor, {
    expectedItemVersion: current?.itemVersion,
    metadata: { documentId }
  });
  await repositories.documents.updateDocumentWorkflowState(documentId, result.itemState.state);
  const activeWorkflow = await getActiveDocumentWorkflow(repositories);

  return {
    result,
    actions: summarizeAllowedActions(
      activeWorkflow,
      result.itemState.state,
      await runtime.getAllowedActions(itemRef, systemActor)
    )
  };
}

async function adoptDocumentWorkflowState(repositories: Repositories, documentId: string, state: string) {
  const runtime = createDocumentWorkflowRuntime(repositories);
  const storage = createPostgresStateWorkflowStorageAdapter(repositories.db);
  const selection = await runtime.getActiveDefinitionVersion(documentWorkflowResourceType, defaultVariantKey);
  if (!selection) {
    return null;
  }
  const itemState = {
    itemRef: documentItemRef(documentId),
    state,
    itemVersion: 1,
    activeSelection: selection
  };
  await storage.saveItemState(itemState);
  return itemState;
}

export function workflowErrorResponse(error: unknown) {
  if (error instanceof DocumentWorkflowValidationError) {
    return {
      status: 422,
      body: {
        valid: false,
        errors: error.errors
      }
    };
  }

  if (isStateWorkflowRuntimeError(error)) {
    return {
      status: error.code === "stale_item_version" ? 409 : 422,
      body: {
        error: error.code,
        message: error.message,
        details: error.details
      }
    };
  }

  return {
    status: 500,
    body: {
      error: "workflow_runtime_error",
      message: error instanceof Error ? error.message : "Workflow runtime failed."
    }
  };
}

class DocumentWorkflowValidationError extends Error {
  constructor(readonly errors: string[]) {
    super("Document workflow definition is invalid for Artifact Review.");
  }
}

function validateArtifactReviewDocumentWorkflow(definition: DefinitionBundle): string[] {
  const errors: string[] = [];
  if (definition.workflowDefinition.workflowId !== documentWorkflowResourceType) {
    errors.push(`Workflow definition id must be ${documentWorkflowResourceType}.`);
  }
  if (definition.workflowDefinition.variantKey !== defaultVariantKey) {
    errors.push(`Workflow variantKey must be ${defaultVariantKey}.`);
  }
  if (getEntryStates(definition).length === 0) {
    errors.push("Workflow must declare at least one entry state.");
  }
  return errors;
}

function getEntryStates(definition: DefinitionBundle): string[] {
  return [
    ...(definition.embeddedStateMachineDefinition.entryStates ?? []),
    ...(!definition.embeddedStateMachineDefinition.entryStates?.length
      ? [definition.embeddedStateMachineDefinition.initialState]
      : [])
  ].filter(Boolean);
}

function summarizeBucket(bucket: WorkflowBucketDefinition) {
  return {
    id: bucket.id,
    label: bucket.label,
    visible: bucket.visible,
    states: [...(bucket.states.length ? bucket.states : bucket.stateIds)]
  };
}

function summarizeAction(action: WorkflowActionDefinition) {
  return {
    id: action.id,
    label: action.label,
    from: action.from ?? "",
    to: action.to,
    trigger: action.trigger === "automatic" ? "automatic" : "user",
    visible: action.visible
  };
}

function summarizeAllowedActions(
  definition: DefinitionBundle | null,
  currentState: string | null,
  allowedActions: readonly AllowedAction[]
) {
  if (!definition || !currentState) {
    return [];
  }

  return allowedActions.map((allowedAction) => {
    const definitionAction = definition.workflowDefinition.actions.find((action) => action.id === allowedAction.actionId);
    return definitionAction
      ? summarizeAction(definitionAction)
      : {
          id: allowedAction.actionId,
          label: allowedAction.label ?? allowedAction.actionId,
          from: currentState,
          to: currentState,
          trigger: allowedAction.trigger,
          visible: allowedAction.visible
        };
  });
}

function documentItemRef(documentId: string): ItemRef {
  return {
    resourceType: documentWorkflowResourceType,
    resourceId: documentId
  };
}
