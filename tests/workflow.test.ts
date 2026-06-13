import { describe, expect, it } from "vitest";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import {
  findWorkflowAction,
  getAllowedWorkflowActions,
  getEntryState,
  validateDocumentWorkflowDefinition
} from "../service/src/workflow/definition";

describe("document workflow definition", () => {
  it("validates the repo workflow fixture and derives visible user actions", () => {
    const validation = validateDocumentWorkflowDefinition(workflowFixture);

    expect(validation.valid).toBe(true);
    if (!validation.valid) {
      throw new Error(validation.errors.join("\n"));
    }

    expect(getEntryState(validation.definition)).toBe("ingestion");
    expect(getAllowedWorkflowActions(validation.definition, "needs_review").map((action) => action.id)).toEqual([
      "needs_review.to_recent_reviews",
      "needs_review.to_rejected"
    ]);
    expect(findWorkflowAction(validation.definition, "needs_review", "needs_review.to_recent_reviews")).toMatchObject({
      from: "needs_review",
      to: "recent_reviews"
    });
  });

  it("rejects workflow actions that are not backed by a state-machine transition", () => {
    const invalidFixture = structuredClone(workflowFixture);
    invalidFixture.workflowDefinition.actions.push({
      id: "needs_review.to_missing",
      label: "Invalid",
      from: "needs_review",
      to: "missing",
      trigger: "user",
      visible: true
    });

    const validation = validateDocumentWorkflowDefinition(invalidFixture);

    expect(validation.valid).toBe(false);
    if (validation.valid) {
      throw new Error("Expected invalid workflow.");
    }
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        '$.workflowDefinition.actions[9].to: Action target state must exist in states.',
        '$.workflowDefinition.actions[9]: Action "needs_review.to_missing" maps to an illegal transition "needs_review -> missing".'
      ])
    );
  });
});
