# Artifact Review Provider Registry Integration Review

Reviewed: 2026-06-12

Source reviewed: `/Users/paulmarshall/Software Development/artifact-review/docs/Artifact Review MVP Plan.md`

## Verdict

The artifact-review MVP plan is mostly aligned with the `invoke-providers-for-tasks` target-app guidelines. The strongest aligned point is that the plan keeps registry-backed provider metadata separate from app-owned tasks, prompts, hooks, selected profile, task runs, domain mutation, and secrets.

The plan should still be tightened before implementation. The main drift risk is not the chosen stack or data model; it is that provider integration could become a loosely described "AI Suggest" feature instead of a target-app-owned runtime that uses the provider registry, client package, adapters, readiness checks, structured output validation, and app-owned hooks consistently.

## Integration Shape To Use

Artifact Review should be a target app, not a provider registry owner.

Use the packages this way:

- `@invoke-providers/registry`: shared provider catalog/profile/config service only.
- `@invoke-providers/client`: registry lookup, registry-backed invocation, and `TargetAppRuntimeService` over Artifact Review's own Postgres repositories.
- `@invoke-providers/core`: task definitions, readiness, structured output validation, hook contracts, task-run provenance, and in-process invocation behavior.
- `@invoke-providers/adapters`: reusable provider protocol adapters such as deterministic test adapters, OpenAI-compatible providers, Codex CLI, Whisper.cpp, and Apple Vision OCR where relevant.
- `@invoke-providers/react`: style-light provider/task/readiness components that Artifact Review can wrap inside its own React layout.

The Tauri shell should handle native file dialogs, export destinations, reveal-in-folder, permissions, and app lifecycle. The local TypeScript service should own database access, provider-runtime composition, task invocation, workflow calls, export, and readiness APIs. React should render the review workspace and call the service APIs; it should not directly own provider invocation or durable workflow state.

## Registry Boundary

Keep the shared registry app-agnostic.

Artifact Review should read provider profile and provider config records from the registry through `RemoteRegistryClient` or `RegistryBackedInvokeProvidersClient`. It should not copy shared provider configs into its own Postgres schema as authoritative records.

Artifact Review may store these app-owned records in Postgres:

- selected provider profile key
- task definitions
- prompt versions
- hook metadata
- render-slot mappings
- task runs
- provider readiness observations or cached diagnostics
- AI suggestion records
- document/component/revision/review records

Artifact Review should not store raw provider secrets in Postgres or registry records. Store only secret references in app-owned records or registry records, and resolve raw values from the local secret mechanism at invocation time.

Profile selection should follow this order:

1. Saved `selectedProviderProfileKey` from Artifact Review settings.
2. `INVOKE_PROVIDERS_PROFILE` as first-run bootstrap only.
3. Not configured.

If a saved profile is missing from the registry, keep the saved key, block provider-backed actions, and show a setup error. Do not silently fall back to another profile.

## AI Suggest Flow

The plan's "AI Suggest" action should be implemented as a provider-backed task with a deliberately narrow mutation path.

Recommended flow:

1. User invokes AI Suggest for a review component.
2. Service loads the component, document context, selected task definition, selected provider profile, provider config, hook metadata, runtime context, and secret availability.
3. Service calls readiness before rendering or invoking the action.
4. UI shows disabled actions with concrete readiness reasons.
5. If the selected provider has `externalSend: true`, show the user that component text and context will leave the local runtime before invocation.
6. Service invokes through `RegistryBackedInvokeProvidersClient` or `TargetAppRuntimeService.invokeTask`.
7. Provider output must validate against an explicit structured output schema.
8. The app-owned hook stores a proposed `ai_suggestions` record.
9. Accept/reject endpoints apply or reject the proposal. Accept creates an audited `component_revisions` record.

Do not let provider output directly overwrite component text. Suggested text should remain proposed until the user explicitly accepts it.

## Task And Prompt Design

Do not scatter prompts through UI handlers or Tauri commands. Treat prompts as app-owned task configuration.

At minimum, Artifact Review should define task records like:

- `suggest-component-revision`: proposes edited text for one review component.
- `summarize-section-findings`: summarizes open issues for a section.
- `draft-review-note`: proposes an annotation or question, but does not apply it automatically.

Each task should have:

- stable `taskKey`
- selected registry `providerKey`
- required capability such as `llm.generateJson`
- prompt version such as `0.1.0`
- render slot such as `component.inline.aiSuggest` or `section.toolbar`
- hook key
- structured output schema
- saved task-run provenance

For the MVP, prefer JSON output for AI suggestions. A useful schema should include proposed text, rationale, confidence, source component ID, and any warnings. Invalid JSON or schema failures should create a failed task run and no domain mutation.

## Readiness And Setup

The MVP plan already includes `GET /api/provider-readiness`; make that endpoint broader and more actionable.

Artifact Review should expose a setup/readiness model that combines:

- database readiness
- provider registry reachability
- selected profile existence
- selected provider enabled state
- required secret availability
- adapter availability
- required capability compatibility
- task/hook implementation status
- workflow readiness for document lifecycle actions

Provider-backed buttons should be rendered from readiness, not optimistic UI assumptions. If the registry is unavailable, provider-backed review actions should block instead of falling back to local providers unless the user explicitly enables a deterministic test/demo mode.

## Workflow Boundary

The plan's use of `state-workflow-runtime` is directionally right: Artifact Review should own document workflow state in its own Postgres database and the frontend should request allowed actions from the service.

Keep provider hooks separate from workflow authority. A provider task may propose review content or store an AI suggestion, but document lifecycle transitions should go through the app-owned workflow service and named transition APIs.

The plan says ingest blocks when no active document workflow exists. That is acceptable if a user-provided workflow is a hard requirement, but it is a sharp MVP dependency. To avoid a first-run dead end, include a setup screen that clearly shows the missing workflow requirement before file ingest, or provide an importable sample workflow fixture without auto-activating it.

## UI Placement

Artifact Review is a review/editor workspace, so the UI should stay dense, stable, and work-focused.

Provider/task UI should be placed like this:

- Global settings: registry URL, selected profile, provider readiness, secret-reference status, adapter diagnostics.
- Component inline controls: AI Suggest, suggestion status, accept/reject, and readiness/error state for that component's task.
- Drawer/detail panel: task-run provenance, prompt version, provider/model, external-send flag, latency, validation status, and suggestion history.
- Section toolbar: section-level tasks only, such as summarize section findings.

Use the React helper components as wrapped controls, not as the app's visual system. Artifact Review should preserve its own shell, navigation, review sections, drawers, autosave, and export behavior.

## Drift Risks To Correct In The Plan

1. The phrase "AI produces suggestions" is too broad. Replace it with named provider-backed tasks, prompt versions, output schemas, and app-owned hooks.
2. `GET /api/provider-readiness` is too narrow unless it reports profile, provider, secret, adapter, hook, task, workflow, and database blockers.
3. Provider setup must not become duplicate provider persistence in Artifact Review Postgres. The registry is the provider catalog source of truth.
4. `externalSend` should be surfaced at the point of invocation, not only hidden in settings.
5. The plan should explicitly say no fallback profile or fallback provider is used when the registry or selected profile is missing.
6. AI suggestion acceptance should be a separate user action that creates a component revision. Provider invocation should create a proposal, not edit the document.
7. Prompt versions and structured output schemas should be first-class app-owned records or embedded task config, not inline code.
8. First-run workflow setup needs a clear path so "no active document workflow" does not look like a broken import feature.

## Tests To Add

Add these to the MVP test plan:

- Registry unavailable blocks provider-backed actions with a clear readiness reason.
- Saved missing `selectedProviderProfileKey` does not fall back to `INVOKE_PROVIDERS_PROFILE`.
- Missing secret reference blocks invocation before adapter execution.
- `externalSend: true` is visible before AI Suggest invocation.
- Invalid structured provider output stores a failed task run and no suggestion.
- Successful AI Suggest stores a proposed suggestion and does not mutate component text.
- Accepting a suggestion creates an audited component revision.
- Hook implementation missing produces a readiness blocker or deterministic no-op, depending on task policy.
- Adapter diagnostics do not dispatch domain hooks.

## Recommended Plan Patch

Add a provider-runtime section to the Artifact Review MVP plan with this language:

> Artifact Review is a target app for `invoke-providers-for-tasks`. It uses the shared provider registry only for provider profiles, provider configs, capabilities, enabled state, health metadata, and secret references. Artifact Review owns selected profile settings, task definitions, prompt versions, structured output schemas, render slots, hook implementations, task runs, document records, workflow transitions, and all domain mutations in its own Postgres database. Provider-backed actions must resolve readiness before rendering and invocation, must surface `externalSend`, must validate structured output, and must store AI output as proposed suggestions until the user accepts or rejects them.

