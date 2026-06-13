# Artifact Review Provider Registry Integration Review

Reviewed: 2026-06-13

Target app reviewed: `/Users/paulmarshall/Software Development/artifact-review`

Guideline source repo: `/Users/paulmarshall/Software Development/invoke-providers-for-tasks`

## Verdict

`artifact-review` is mostly aligned with the `invoke-providers-for-tasks` target-app model. The current MVP plan has already corrected the biggest early drift risks: it describes Artifact Review as a target app, keeps the shared provider registry as the provider catalog/profile/config source of truth, stores provider output as proposals, and keeps document workflow state backend-owned.

The remaining drift risk is now implementation-level rather than plan-level. The app has begun to hand-compose provider readiness and invocation around low-level `@invoke-providers/core` calls. That is acceptable for the first `suggest-component-revision` slice, but it should not become the long-term integration pattern as more tasks, slots, diagnostics, and settings are added. The app should converge on the reusable target-app runtime/client helpers from this repo so provider behavior stays consistent across target apps.

## Reviewed Sources

Current `artifact-review` sources checked:

- `AGENTS.md`
- `handoff.md`
- `package.json`
- `docs/Artifact Review MVP Plan.md`
- `docs/api-contract.md`
- `docs/data-model.md`
- `docs/setup-readiness.md`
- `docs/implementation-sequence.md`
- `service/src/providers/registry.ts`
- `service/src/providers/readiness.ts`
- `service/src/providers/runtime.ts`
- `service/src/providers/tasks.ts`
- `service/src/repositories/providerTasks.ts`
- `service/migrations/003_provider_task_assets.sql`
- `service/src/http/server.ts`
- `src/App.tsx`
- `tests/provider-readiness.test.ts`
- `tests/http-review.test.ts`

Relevant `invoke-providers-for-tasks` sources checked:

- `docs/target-apps/integration.md`
- `docs/target-apps/provider-setup.md`
- `docs/target-apps/action-rendering.md`
- `docs/examples/registry-backed-target-app.ts`
- `packages/client/src/registry-backed.ts`
- `packages/client/src/target-runtime.ts`

There is also an older review in the target repo at `artifact-review/docs/artifact-review-provider-registry-integration-review.md`. This document refreshes that assessment against the current implementation state.

## Desired Integration Shape

Artifact Review should keep this boundary:

- Tauri owns native file dialogs, export destination selection, reveal-in-folder, permissions, and app lifecycle.
- React owns the review/editor workspace, transient interaction state, and display of readiness/actions.
- The local TypeScript service owns Postgres access, workflow calls, provider runtime composition, provider invocation, readiness APIs, export, and all domain mutations.
- `state-workflow-runtime` owns workflow execution semantics through Artifact Review's app-owned storage adapter.
- `invoke-providers-for-tasks` owns provider-backed task contracts, registry-backed provider lookup, readiness semantics, structured output validation, hook contracts, adapter dispatch, and task-run provenance.

React should never call provider adapters or mutate durable workflow state directly. Tauri should not own provider invocation, workflow transitions, Postgres writes, or document mutation logic.

## Registry Boundary

The shared registry must stay app-agnostic. Artifact Review should read these from the registry:

- provider profiles
- provider configs
- enabled state
- capabilities
- provider health metadata
- secret references

Artifact Review should own these in Postgres:

- selected provider registry URL and selected profile key
- explicit demo-mode setting
- task definitions
- prompt versions
- structured output schemas
- render slots
- processing hook metadata
- task runs
- AI suggestions
- provider readiness observations
- document, component, review, workflow, autosave, export, and audit records

Artifact Review must not copy registry provider configs into Postgres as authoritative provider records. It may store task-run provenance that names the provider/profile used for a run.

Profile selection should remain:

1. Saved `selectedProviderProfileKey` from Artifact Review settings.
2. `INVOKE_PROVIDERS_PROFILE` as first-run bootstrap only.
3. Not configured.

If a saved profile is missing from the registry, keep the saved key, block provider-backed actions, and show repair guidance. Do not fall back to an environment profile or another provider.

## Use Of This Repo's Libraries

Recommended package usage:

- `@invoke-providers/registry`: shared provider registry service only.
- `@invoke-providers/client`: use `RemoteRegistryClient` for profile/provider lookup and move multi-task runtime behavior toward `TargetAppRuntimeService` or `RegistryBackedInvokeProvidersClient`.
- `@invoke-providers/core`: use task definitions, readiness, structured output validation, hook contracts, and low-level invocation primitives. Avoid scattering direct `invokeTask` usage across app features.
- `@invoke-providers/adapters`: register reusable adapters locally in the service, including deterministic adapters only for tests or explicit demo mode.
- `@invoke-providers/react`: wrap style-light controls inside Artifact Review's own dense workspace UI; do not let these helpers become the app's visual system.

Current implementation uses `RemoteRegistryClient` and low-level `invokeTask`. That is a workable first slice. Before adding `summarize-section-findings`, `draft-review-note`, task settings UI, adapter diagnostics, or render-slot action lists, introduce an Artifact Review provider runtime service built around `TargetAppRuntimeService`.

## Runtime Service Design

Artifact Review should have one service module that composes:

- app-owned task repository backed by `task_definitions`, `prompt_versions`, `structured_output_schemas`, and `render_slot_mappings`
- app-owned hook repository backed by `processing_hooks`
- app-owned task-run repository backed by `task_runs`
- registry provider source backed by the selected registry URL and selected profile
- adapter registry for locally available adapters
- secret resolver that checks local secret references without exposing raw values
- runtime context containing app version, commit SHA when available, environment, and correlation ID
- host hooks that perform proposal-only app mutations after structured output validation

Use that runtime service for:

- readiness diagnostics
- render-slot action derivation
- provider/profile selection diagnostics
- adapter diagnostics
- task invocation
- task-run persistence

The current direct `invokeTask` path in `service/src/providers/runtime.ts` should be treated as transitional. It is easy to keep correct for one task, but it will become brittle when multiple tasks and slots need the same readiness, hook, adapter, secret, runtime, and provenance rules.

## AI Suggest Flow

`suggest-component-revision` should keep the current proposal-only model:

1. User invokes `AI Suggest` for a component.
2. Service loads the component, document context, task asset, selected provider profile, registry provider config, hook metadata, runtime context, and local secret availability.
3. Service resolves readiness before invocation.
4. React renders the action disabled when readiness is blocked and shows the specific blocker.
5. If the selected provider has `externalSend: true`, React shows that signal at the point of invocation.
6. Service invokes through the shared provider runtime path.
7. Output validates against the explicit structured output schema.
8. The app-owned hook stores a proposed `ai_suggestions` row.
9. Accept/reject endpoints remain separate user actions.
10. Accept creates an audited `component_revisions` row.

Provider output must never directly overwrite component text.

## Current Alignment

The current app is aligned in these areas:

- It installs the local numbered `@invoke-providers/*` package family.
- It keeps registry URL, selected profile, and demo mode in Settings rather than mixing them into provider diagnostics.
- It has app-owned `task_definitions`, `prompt_versions`, `structured_output_schemas`, `processing_hooks`, `render_slot_mappings`, `task_runs`, and `ai_suggestions` records.
- It uses saved profile before `INVOKE_PROVIDERS_PROFILE`.
- It blocks provider actions when registry/profile/task/schema/hook/capability/secret/adapter checks fail.
- It keeps deterministic demo mode explicit.
- It stores AI output as proposed suggestions and requires accept/reject for mutation.
- It records task-run provenance and validation status.
- It keeps workflow state backend-owned and renders service-derived allowed actions.

## Remaining Drift Risks

1. Direct low-level invocation may become the app's permanent runtime pattern.

`service/src/providers/runtime.ts` manually composes providers, adapters, hooks, secrets, invocation, output validation, and task-run persistence. That is tolerable for one MVP task. It should be replaced or wrapped by `TargetAppRuntimeService` before more provider-backed tasks are exposed.

2. Provider selection can become implicit.

`selectProviderForTask` chooses the first enabled registry provider with the required capability when `task_definitions.provider_key` is null. That is convenient, but for a review/editor tool it can surprise users. For user-facing actions, prefer an explicit selected provider per task or a clear "profile default provider" rule returned by the registry/runtime. If no explicit provider is selected, the UI should name the chosen provider before invocation.

3. `externalSend` is recorded but not sufficiently visible in the React invocation surface.

Task runs store `externalSend`, and the plan says it must be surfaced. The current React detail panel disables/enables `AI Suggest` from readiness, but the visible invocation area does not clearly show the selected provider, profile, adapter, or `externalSend` state before the user clicks. Add a compact invocation summary next to `AI Suggest`.

4. Task assets for future tasks are seeded as if hooks exist.

The migration seeds `summarize-section-findings` and `draft-review-note` with hook implementation keys that look implemented. Do not render or enable these tasks until the app has real host hook code and endpoints for their proposal records. Otherwise readiness can drift from actual product capability.

5. Readiness is broad but not yet action-oriented enough.

`GET /api/provider-readiness` is useful, but the UI should also consume task-specific or slot-specific readiness for each rendered action. A global readiness flag is too coarse once more provider tasks exist.

6. Provenance is persisted but not yet inspectable enough.

Suggestion cards show task-run IDs, but the review workspace should expose provider/profile/model, prompt version, validation status, latency, `externalSend`, and failure reason in the component drawer or task-run detail.

7. Demo mode bypass needs to stay explicit and visibly labeled.

The current demo mode is explicit, which is good. Keep it visually distinct from registry-backed real provider execution so users do not mistake deterministic local suggestions for provider-backed output.

## Required Design Tightening

Artifact Review should add a provider runtime facade in the service with this shape:

```ts
type ArtifactReviewProviderRuntime = {
  getReadiness(taskKey?: string): Promise<ReadinessResponse>;
  getRenderSlotActions(slot: string): Promise<RenderSlotAction[]>;
  invokeTask(taskKey: string, input: unknown, context: RuntimeContext): Promise<TaskInvocationResult>;
  getTaskRun(taskRunId: string): Promise<TaskRunDetail | null>;
};
```

Internally, this facade should use the `@invoke-providers/client` runtime helpers over Artifact Review repositories. The HTTP server and React UI should depend on this facade rather than rebuilding provider logic endpoint by endpoint.

## UI Requirements

Artifact Review is an operational review/editor workspace, not a provider console. Provider controls should be compact and contextual:

- Settings: registry URL, selected profile, demo mode, and value source.
- Providers: readiness diagnostics only, including registry, profile, selected provider, secret, adapter, and task blockers.
- Component detail: `AI Suggest`, current readiness blocker, selected provider/profile, `externalSend`, prompt version, and last task-run status.
- Suggestion card: proposed text, rationale, confidence, warnings, task-run link/detail, provider/profile/model, validation status, and accept/reject.
- Drawer/detail panel: provenance and audit trail.

Do not turn the review workspace into a generic provider-management UI. Provider configuration belongs in Settings; provider diagnostics belong in Providers; provider-backed actions belong beside the document component they affect.

## Tests To Keep Or Add

Already covered or planned tests are directionally right. Keep these as hard requirements:

- registry unavailable blocks provider-backed actions
- missing saved selected profile does not fall back to `INVOKE_PROVIDERS_PROFILE`
- missing secret blocks before adapter execution
- invalid structured provider output stores a failed task run and no suggestion
- successful AI Suggest stores a proposed suggestion and does not mutate component text
- accepting a suggestion creates an audited component revision
- rejecting a suggestion preserves history without mutation

Add or strengthen:

- selected provider is explicit when more than one provider supports the task capability
- `externalSend: true` appears in the component detail area before invocation
- global readiness does not enable a task whose task-specific readiness is blocked
- future seeded tasks remain hidden or blocked until host hooks and endpoints exist
- task-run detail exposes provider/profile/prompt/schema/validation/latency provenance
- demo mode is visibly labeled and never silently selected as fallback
- adapter diagnostics do not dispatch app mutation hooks

## Recommended Plan Patch

Add this implementation note to the Artifact Review MVP plan or implementation sequence:

> Provider runtime implementation should converge on `TargetAppRuntimeService` or `RegistryBackedInvokeProvidersClient` from `@invoke-providers/client` before additional provider-backed tasks are exposed. Artifact Review may use low-level `@invoke-providers/core.invokeTask` for the first `suggest-component-revision` slice, but the durable app boundary is a single service-owned provider runtime facade that resolves registry profile selection, task assets, hooks, adapters, secrets, readiness, render-slot actions, invocation, structured output validation, and task-run provenance consistently. React renders task-specific readiness and `externalSend` at the invocation point; provider output remains proposed until an explicit accept/reject user action.

## Bottom Line

The `artifact-review` plan is not currently drifting away from the provider registry guidelines. It has mostly incorporated them.

The next risk is letting the first working implementation harden around custom one-off provider plumbing. The right correction is to centralize provider runtime behavior now, while there is only one live task, and use this repo's target-app runtime helpers before adding more provider-backed actions.
