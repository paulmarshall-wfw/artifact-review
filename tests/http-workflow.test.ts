import { describe, expect, it } from "vitest";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

describe("workflow HTTP endpoints", () => {
  it("validates a user-provided workflow definition before activation", async () => {
    const response = await requestApp(createTestServer(null), "POST", "/api/workflow/definitions/validate", workflowFixture);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      valid: true,
      workflow: {
        id: "document",
        definitionVersion: "0.1.0",
        entryStates: ["ingestion"]
      }
    });
  });

  it("activates a valid workflow and reports the active status", async () => {
    const db = createQueuedDatabase([]);
    const app = createTestServer(db);

    const activation = await requestApp(app, "POST", "/api/workflow/activate", workflowFixture);
    const status = await requestApp(app, "GET", "/api/workflow/status");

    expect(activation.status).toBe(200);
    expect(activation.body).toMatchObject({
      active: true,
      initialState: "ingestion",
      workflow: { id: "document" }
    });
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      active: true,
      workflow: { id: "document" },
      readiness: { ready: true }
    });
    expect(db.queries.some((query) => query.text.includes("insert into app_settings"))).toBe(true);
    expect(db.queries.some((query) => query.values?.[0] === "stateWorkflowRuntime.state")).toBe(true);
  });

  it("returns allowed actions for the document current workflow state", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.txt",
          source_type: "file",
          original_format: "txt",
          current_workflow_item_ref: "needs_review",
          ingested_at: now,
          updated_at: now
        }
      ]
    ]);
    const app = createTestServer(db);
    await requestApp(app, "POST", "/api/workflow/activate", workflowFixture);

    const response = await requestApp(app, "GET", "/api/workflow/documents/document-1/actions");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      documentId: "document-1",
      currentState: "needs_review",
      actions: [
        { id: "needs_review.to_recent_reviews", from: "needs_review", to: "recent_reviews" },
        { id: "needs_review.to_rejected", from: "needs_review", to: "rejected" }
      ]
    });
  });

  it("rejects document transitions that are not allowed from the current state", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.txt",
          source_type: "file",
          original_format: "txt",
          current_workflow_item_ref: "ingestion",
          ingested_at: now,
          updated_at: now
        }
      ]
    ]);
    const app = createTestServer(db);
    await requestApp(app, "POST", "/api/workflow/activate", workflowFixture);

    const response = await requestApp(
      app,
      "POST",
      "/api/workflow/documents/document-1/actions/needs_review.to_recent_reviews"
    );

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: "workflow_action_not_allowed",
      documentId: "document-1",
      currentState: "ingestion",
      actionId: "needs_review.to_recent_reviews"
    });
  });
});
