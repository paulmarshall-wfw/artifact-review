import type { ReadinessResponse } from "../domain/readiness.js";
import { combineReadiness } from "../domain/readiness.js";

export function buildWorkflowReadiness(activeDocumentWorkflow = false): ReadinessResponse {
  return combineReadiness([
    {
      key: "document-workflow",
      label: "Active document workflow",
      ready: activeDocumentWorkflow,
      reason: activeDocumentWorkflow ? undefined : "Import or activate a user-provided document workflow before ingest."
    },
    {
      key: "backend-owned-state",
      label: "Backend-owned workflow state",
      ready: true
    }
  ]);
}

