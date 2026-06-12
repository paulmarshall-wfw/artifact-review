import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { QueryResult } from "pg";
import { describe, expect, it } from "vitest";
import { loadMigrationFiles } from "../service/src/db/migrations";
import { AiSuggestionsRepository } from "../service/src/repositories/aiSuggestions";
import { AppSettingsRepository } from "../service/src/repositories/appSettings";
import { DocumentsRepository } from "../service/src/repositories/documents";
import { TaskRunsRepository } from "../service/src/repositories/taskRuns";
import type { Queryable } from "../service/src/repositories/types";

type RecordedQuery = {
  text: string;
  values?: unknown[];
};

function createQueuedDatabase(queuedRows: object[][]): Queryable & { queries: RecordedQuery[] } {
  const queries: RecordedQuery[] = [];

  return {
    queries,
    async query<T extends object = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>> {
      queries.push({ text, values });
      const rows = (queuedRows.shift() ?? []) as T[];
      return {
        command: "SELECT",
        rowCount: rows.length,
        oid: 0,
        fields: [],
        rows
      };
    }
  };
}

describe("migration files", () => {
  it("loads numbered SQL files in deterministic order with checksums", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "artifact-review-migrations-"));
    try {
      await writeFile(path.join(directory, "002_second.sql"), "select 2;\n");
      await writeFile(path.join(directory, "001_first.sql"), "select 1;\n");
      await writeFile(path.join(directory, "README.md"), "ignored");

      const migrations = await loadMigrationFiles(directory);

      expect(migrations.map((migration) => migration.filename)).toEqual(["001_first.sql", "002_second.sql"]);
      expect(migrations.every((migration) => migration.checksum.length === 64)).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("repositories", () => {
  it("reads the saved selected provider profile from app settings", async () => {
    const db = createQueuedDatabase([[{ value: "registry-profile" }]]);
    const repository = new AppSettingsRepository(db);

    await expect(repository.getSelectedProviderProfileKey()).resolves.toBe("registry-profile");
    expect(db.queries[0]?.text).toContain("from app_settings");
    expect(db.queries[0]?.values).toEqual(["selectedProviderProfileKey"]);
  });

  it("maps document summaries and loads document detail collections", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.md",
          source_type: "file",
          original_format: "md",
          current_workflow_item_ref: "workflow-item-1",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-1",
          document_id: "document-1",
          version_number: 1,
          source_snapshot: "# Original",
          current_snapshot: "# Current",
          parser_metadata: { parser: "markdown" },
          created_at: now
        }
      ],
      [
        {
          id: "component-1",
          document_id: "document-1",
          kind: "markdown_bullet",
          section_id: "section-1",
          source_range: { start: 0, end: 9 },
          current_text: "Review this",
          original_text_hash: "hash-1",
          created_at: now,
          updated_at: now
        }
      ]
    ]);
    const repository = new DocumentsRepository(db);

    await expect(repository.getDocument("document-1")).resolves.toMatchObject({
      id: "document-1",
      name: "Review.md",
      originalFormat: "md"
    });
    await expect(repository.getDocumentVersions("document-1")).resolves.toMatchObject([
      { id: "version-1", documentId: "document-1", versionNumber: 1 }
    ]);
    await expect(repository.getReviewComponents("document-1")).resolves.toMatchObject([
      { id: "component-1", documentId: "document-1", kind: "markdown_bullet" }
    ]);
  });

  it("updates document workflow state through the documents repository", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.md",
          source_type: "file",
          original_format: "md",
          current_workflow_item_ref: "recent_reviews",
          ingested_at: now,
          updated_at: now
        }
      ]
    ]);
    const repository = new DocumentsRepository(db);

    await expect(repository.updateDocumentWorkflowState("document-1", "recent_reviews")).resolves.toMatchObject({
      id: "document-1",
      currentWorkflowItemRef: "recent_reviews"
    });
    expect(db.queries[0]?.text).toContain("set current_workflow_item_ref = $2");
    expect(db.queries[0]?.values).toEqual(["document-1", "recent_reviews"]);
  });

  it("maps task run provenance and AI suggestion confidence values", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const db = createQueuedDatabase([
      [
        {
          id: "task-run-1",
          task_key: "suggest-component-revision",
          provider_key: "openai-compatible",
          provider_profile_key: "registry-profile",
          prompt_version: "0.1.0",
          status: "succeeded",
          validation_status: "valid",
          external_send: true,
          latency_ms: 42,
          provenance: { model: "review-model" },
          created_at: now
        }
      ],
      [
        {
          id: "suggestion-1",
          component_id: "component-1",
          task_run_id: "task-run-1",
          proposed_text: "Revised text",
          rationale: "Clearer phrasing",
          confidence: "0.875",
          warnings: [],
          status: "proposed",
          created_at: now,
          decided_at: null
        }
      ]
    ]);

    await expect(new TaskRunsRepository(db).getTaskRun("task-run-1")).resolves.toMatchObject({
      id: "task-run-1",
      taskKey: "suggest-component-revision",
      externalSend: true
    });
    await expect(new AiSuggestionsRepository(db).getSuggestion("suggestion-1")).resolves.toMatchObject({
      id: "suggestion-1",
      componentId: "component-1",
      confidence: 0.875,
      status: "proposed"
    });
  });
});
