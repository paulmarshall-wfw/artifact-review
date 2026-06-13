import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import { runMigrations } from "../service/src/db/migrations";
import { createRepositories } from "../service/src/repositories";
import { validateDocumentWorkflowDefinition } from "../service/src/workflow/definition";

const databaseUrl = process.env.ARTIFACT_REVIEW_TEST_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

describePostgres("Postgres persistence integration", () => {
  const schemaName = `artifact_review_test_${randomUUID().replaceAll("-", "_")}`;
  let adminPool: pg.Pool;
  let testPool: pg.Pool;

  beforeAll(async () => {
    adminPool = new pg.Pool({ connectionString: databaseUrl });
    await adminPool.query(`create schema ${quoteIdentifier(schemaName)}`);

    testPool = new pg.Pool({
      connectionString: databaseUrl,
      max: 2,
      options: `-c search_path=${schemaName}`
    });
  });

  afterAll(async () => {
    await testPool?.end();
    if (adminPool) {
      await adminPool.query(`drop schema if exists ${quoteIdentifier(schemaName)} cascade`);
      await adminPool.end();
    }
  });

  it("applies migrations idempotently in an isolated schema", async () => {
    const firstRun = await runMigrations(testPool);
    const secondRun = await runMigrations(testPool);
    const tables = await testPool.query<{ table_name: string }>(
      `
        select table_name
        from information_schema.tables
        where table_schema = $1
        order by table_name
      `,
      [schemaName]
    );

    expect(firstRun.applied).toEqual([
      "001_initial_schema.sql",
      "002_review_and_provider_records.sql",
      "003_provider_task_assets.sql",
      "004_block_future_provider_task_hooks.sql"
    ]);
    expect(firstRun.skipped).toEqual([]);
    expect(secondRun.applied).toEqual([]);
    expect(secondRun.skipped).toEqual([
      "001_initial_schema.sql",
      "002_review_and_provider_records.sql",
      "003_provider_task_assets.sql",
      "004_block_future_provider_task_hooks.sql"
    ]);
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        "schema_migrations",
        "documents",
        "document_versions",
        "review_components",
        "app_settings",
        "task_definitions",
        "task_runs",
        "ai_suggestions"
      ])
    );
  });

  it("round-trips repository records against Postgres", async () => {
    await runMigrations(testPool);
    const repositories = createRepositories(testPool);

    const document = await repositories.documents.createDocument({
      name: "Integration.md",
      sourceType: "file",
      originalFormat: "md",
      currentWorkflowItemRef: "workflow-item-1"
    });
    const version = await repositories.documents.createDocumentVersion({
      documentId: document.id,
      versionNumber: 1,
      sourceSnapshot: "# Source",
      currentSnapshot: "# Current",
      parserMetadata: { parser: "markdown" }
    });
    const [component] = await repositories.documents.createReviewComponents([
      {
        id: `component-${randomUUID()}`,
        documentId: document.id,
        kind: "markdown_heading",
        sectionId: "section-1",
        sourceRange: { start: 0, end: 9 },
        currentText: "Current",
        originalTextHash: "hash-1"
      }
    ]);

    await repositories.appSettings.setSelectedProviderProfileKey("registry-profile");
    const workflowValidation = validateDocumentWorkflowDefinition(workflowFixture);
    if (!workflowValidation.valid) {
      throw new Error(workflowValidation.errors.join("\n"));
    }
    await repositories.workflows.setActiveDocumentWorkflow(workflowValidation.definition);
    await repositories.taskRuns.upsertTaskDefinition({
      taskKey: "suggest-component-revision",
      providerKey: "openai-compatible",
      requiredCapability: "text_generation",
      promptVersion: "0.1.0",
      renderSlot: "component.inline_suggestion",
      hookKey: "suggest_component_revision"
    });
    const taskRun = await repositories.taskRuns.createTaskRun({
      taskKey: "suggest-component-revision",
      providerKey: "openai-compatible",
      providerProfileKey: "registry-profile",
      promptVersion: "0.1.0",
      status: "succeeded",
      validationStatus: "valid",
      externalSend: true,
      latencyMs: 12,
      provenance: { model: "integration-test" }
    });
    const suggestion = await repositories.aiSuggestions.createSuggestion({
      componentId: component.id,
      taskRunId: taskRun.id,
      proposedText: "Revised",
      rationale: "Clearer phrasing",
      confidence: 0.875,
      warnings: []
    });

    await expect(repositories.documents.listDocuments()).resolves.toMatchObject([
      { id: document.id, name: "Integration.md" }
    ]);
    await expect(repositories.documents.getDocumentVersions(document.id)).resolves.toMatchObject([
      { id: version.id, versionNumber: 1 }
    ]);
    await expect(repositories.documents.getReviewComponents(document.id)).resolves.toMatchObject([
      { id: component.id, currentText: "Current" }
    ]);
    await expect(repositories.appSettings.getSelectedProviderProfileKey()).resolves.toBe("registry-profile");
    await expect(repositories.workflows.getActiveDocumentWorkflow()).resolves.toMatchObject({
      definitionVersion: "0.1.0",
      workflowDefinition: { id: "artifact-review_workflow" }
    });
    await expect(repositories.taskRuns.getTaskRun(taskRun.id)).resolves.toMatchObject({
      id: taskRun.id,
      externalSend: true,
      providerProfileKey: "registry-profile"
    });
    await expect(repositories.aiSuggestions.getSuggestion(suggestion.id)).resolves.toMatchObject({
      id: suggestion.id,
      componentId: component.id,
      confidence: 0.875,
      status: "proposed"
    });
  });
});
