# Reorganize Artifact Review Settings And Task Actions

## Summary
Rework Artifact Review’s admin/setup area into a Memo Capture-style Settings workspace: a left section navigator, a focused detail panel, service-backed settings summary data, and first-class provider/task configuration built around `invoke-providers-for-tasks`.

The review workspace stays the primary app surface. Settings becomes the place to manage workflow setup, provider registry/profile selection, task routes, readiness, diagnostics, task runs, ingest, and predefined task-button landing areas.

## Key Changes
- Replace the current flat `Admin / Setup` screen with a Settings page structure matching Memo Capture: section nav plus detail panel.
- Add service-backed Settings APIs:
  - `GET /api/settings`
  - `PATCH /api/settings/provider-registry`
  - `POST /api/settings/providers/refresh`
  - `GET /api/settings/readiness`
  - `GET /api/settings/render-slots`
  - `GET /api/settings/render-slots/:slot/actions`
  - `GET /api/settings/task-runs`
  - `PATCH /api/settings/tasks/:taskKey/route`
- Introduce typed frontend settings models: `SettingsSummary`, `ProviderRegistrySettings`, `TaskRouteSummary`, `RenderSlotSummary`, `RenderSlotAction`, and `TaskRunSummary`.
- Reorganize provider runtime code along Memo Capture lines:
  - Create an Artifact Review runtime factory around `TargetAppRuntimeService`.
  - Add repository adapters for providers, tasks, hooks, task runs, and provider profile settings.
  - Move mapping/normalization into dedicated runtime mapping code instead of rebuilding in-memory task state inside the runtime service.
- Keep current backend-owned workflow state and current explicit review behavior; AI output remains proposal-only until accepted.

## Implementation Changes
- Settings UI sections:
  - `Workflow`: import/activation/status and workflow readiness.
  - `Provider Registry`: registry URL, selected profile, refresh, catalog status, provider readiness.
  - `AI Tasks`: task route editing for provider, hook, render slot, order, enabled state, model override, and readiness.
  - `Landing Areas`: predefined render slots with labels, descriptions, current actions, and task assignments.
  - `Diagnostics`: provider readiness, hook status, task readiness, and recent task runs.
  - `Ingest`: existing ingest controls, still blocked until active workflow exists.
- Predefine Artifact Review landing areas now rather than supporting arbitrary user-created slots immediately:
  - `component.inline.aiSuggest`
  - `component.inline.textTools`
  - `component.drawer.noteDraft`
  - `section.toolbar`
  - `document.toolbar`
  - `document.footer`
  - `admin.diagnostics`
- Replace the hardcoded inline AI Suggest task lookup in the review page with slot-driven task actions from `component.inline.aiSuggest`, while preserving the existing suggestion accept/reject flow.
- Extend the current task repository layer to support listing and updating task routes, hooks, render-slot actions, and task runs. Add only minimal schema changes needed for editable task routing: display order, enabled flag, optional model override, and display metadata if not already present.
- Split large frontend code into feature modules where practical: review page, settings page, settings sections, shared API/types. Keep styling consistent with the current dense workspace direction.

## Test Plan
- Run repo verification with `npm run verify`.
- Add service/API tests for:
  - settings summary construction
  - saved provider profile precedence over environment defaults
  - render slot action listing and sort order
  - task route validation against hook/provider/readiness rules
  - task run listing/grouping
- Add frontend coverage or smoke checks for:
  - Settings section navigation
  - provider registry save/refresh
  - task route edit/save state
  - landing area task assignment display
  - review-page AI Suggest action still creates proposed suggestions
  - ingest remains disabled until workflow is active
- Use Chrome browser validation for the local app after implementation.

## Assumptions
- Build Mode only; no release packaging, publishing, tagging, or dependency installation unless explicitly requested.
- No authentication or user-management work is added.
- Provider registry remains the source of truth for catalog/profile data.
- Custom user-created landing areas are deferred; this implementation makes landing areas visible and assignable using a predefined registry so they can be nominated cleanly in a later step.
