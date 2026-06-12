import { z } from "zod";

const workflowStateSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean().default(true)
});

const workflowActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  trigger: z.enum(["user", "automatic"]).default("user"),
  visible: z.boolean().default(true)
});

const workflowBucketSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  visible: z.boolean().default(true),
  states: z.array(z.string().min(1)).min(1)
});

const workflowHookSchema = z.object({
  id: z.string().min(1),
  phase: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  handlerKey: z.string().min(1),
  schedule: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  retryPolicy: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

const workflowDefinitionSchema = z.object({
  id: z.string().min(1),
  states: z.array(workflowStateSchema).min(1),
  actions: z.array(workflowActionSchema).default([]),
  buckets: z.array(workflowBucketSchema).default([]),
  hooks: z.array(workflowHookSchema).default([])
});

const stateMachineTransitionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1)
});

const stateMachineDefinitionSchema = z.object({
  id: z.string().min(1),
  states: z.array(z.string().min(1)).min(1),
  entryStates: z.array(z.string().min(1)).min(1),
  terminalStates: z.array(z.string().min(1)).default([]),
  transitions: z.array(stateMachineTransitionSchema).default([])
});

export const documentWorkflowBundleSchema = z.object({
  schemaVersion: z.string().min(1),
  appName: z.string().min(1),
  id: z.string().min(1),
  definitionVersion: z.string().min(1),
  stateMachineDefinition: stateMachineDefinitionSchema,
  workflowDefinition: workflowDefinitionSchema
});

export type DocumentWorkflowBundle = z.infer<typeof documentWorkflowBundleSchema>;
export type WorkflowAction = z.infer<typeof workflowActionSchema>;
export type WorkflowBucket = z.infer<typeof workflowBucketSchema>;

export type WorkflowValidationResult =
  | {
      valid: true;
      definition: DocumentWorkflowBundle;
      errors: [];
    }
  | {
      valid: false;
      errors: string[];
    };

export function validateDocumentWorkflowDefinition(input: unknown): WorkflowValidationResult {
  const parsed = documentWorkflowBundleSchema.safeParse(input);

  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "definition"}: ${issue.message}`)
    };
  }

  const definition = parsed.data;
  const errors = validateWorkflowConsistency(definition);

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, definition, errors: [] };
}

export function summarizeWorkflowDefinition(definition: DocumentWorkflowBundle) {
  return {
    id: definition.workflowDefinition.id,
    definitionVersion: definition.definitionVersion,
    schemaVersion: definition.schemaVersion,
    states: definition.workflowDefinition.states,
    buckets: definition.workflowDefinition.buckets,
    entryStates: definition.stateMachineDefinition.entryStates,
    visibleActions: definition.workflowDefinition.actions.filter((action) => action.visible)
  };
}

export function getEntryState(definition: DocumentWorkflowBundle): string {
  return definition.stateMachineDefinition.entryStates[0]!;
}

export function getAllowedWorkflowActions(definition: DocumentWorkflowBundle, currentState: string): WorkflowAction[] {
  return definition.workflowDefinition.actions.filter(
    (action) => action.from === currentState && action.trigger === "user" && action.visible
  );
}

export function findWorkflowAction(
  definition: DocumentWorkflowBundle,
  currentState: string,
  actionId: string
): WorkflowAction | null {
  return getAllowedWorkflowActions(definition, currentState).find((action) => action.id === actionId) ?? null;
}

function validateWorkflowConsistency(definition: DocumentWorkflowBundle): string[] {
  const errors: string[] = [];
  const machineStateIds = new Set(definition.stateMachineDefinition.states);
  const workflowStateIds = new Set(definition.workflowDefinition.states.map((state) => state.id));
  const transitionKeys = new Set(
    definition.stateMachineDefinition.transitions.map((transition) => `${transition.from}->${transition.to}`)
  );

  for (const state of workflowStateIds) {
    if (!machineStateIds.has(state)) {
      errors.push(`Workflow state ${state} is not declared in stateMachineDefinition.states.`);
    }
  }

  for (const state of machineStateIds) {
    if (!workflowStateIds.has(state)) {
      errors.push(`State machine state ${state} is not declared in workflowDefinition.states.`);
    }
  }

  for (const entryState of definition.stateMachineDefinition.entryStates) {
    if (!machineStateIds.has(entryState)) {
      errors.push(`Entry state ${entryState} is not declared in stateMachineDefinition.states.`);
    }
  }

  for (const transition of definition.stateMachineDefinition.transitions) {
    if (!machineStateIds.has(transition.from)) {
      errors.push(`Transition source ${transition.from} is not declared in stateMachineDefinition.states.`);
    }
    if (!machineStateIds.has(transition.to)) {
      errors.push(`Transition target ${transition.to} is not declared in stateMachineDefinition.states.`);
    }
  }

  for (const action of definition.workflowDefinition.actions) {
    if (!workflowStateIds.has(action.from)) {
      errors.push(`Action ${action.id} source ${action.from} is not declared in workflowDefinition.states.`);
    }
    if (!workflowStateIds.has(action.to)) {
      errors.push(`Action ${action.id} target ${action.to} is not declared in workflowDefinition.states.`);
    }
    if (!transitionKeys.has(`${action.from}->${action.to}`)) {
      errors.push(`Action ${action.id} does not match a stateMachineDefinition transition.`);
    }
  }

  for (const bucket of definition.workflowDefinition.buckets) {
    for (const state of bucket.states) {
      if (!workflowStateIds.has(state)) {
        errors.push(`Bucket ${bucket.id} references unknown state ${state}.`);
      }
    }
  }

  return errors;
}
