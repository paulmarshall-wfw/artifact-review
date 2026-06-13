import { randomUUID } from "node:crypto";
import { toJsonValue, type JsonValue, type Queryable } from "./types.js";

export type AiSuggestionStatus = "proposed" | "accepted" | "rejected";

export type AiSuggestion = {
  id: string;
  componentId: string;
  taskRunId: string | null;
  proposedText: string;
  rationale: string;
  confidence: number;
  warnings: JsonValue;
  status: AiSuggestionStatus;
  createdAt: Date;
  decidedAt: Date | null;
};

type AiSuggestionRow = {
  id: string;
  component_id: string;
  task_run_id: string | null;
  proposed_text: string;
  rationale: string;
  confidence: string | number;
  warnings: JsonValue;
  status: AiSuggestionStatus;
  created_at: Date;
  decided_at: Date | null;
};

export type CreateAiSuggestionInput = {
  id?: string;
  componentId: string;
  taskRunId?: string | null;
  proposedText: string;
  rationale: string;
  confidence: number;
  warnings?: JsonValue;
};

export class AiSuggestionsRepository {
  constructor(private readonly db: Queryable) {}

  async createSuggestion(input: CreateAiSuggestionInput): Promise<AiSuggestion> {
    const result = await this.db.query<AiSuggestionRow>(
      `
        insert into ai_suggestions
          (id, component_id, task_run_id, proposed_text, rationale, confidence, warnings, status)
        values ($1, $2, $3, $4, $5, $6, $7, 'proposed')
        returning
          id, component_id, task_run_id, proposed_text, rationale, confidence, warnings, status, created_at, decided_at
      `,
      [
        input.id ?? randomUUID(),
        input.componentId,
        input.taskRunId ?? null,
        input.proposedText,
        input.rationale,
        input.confidence,
        toJsonValue(input.warnings ?? [])
      ]
    );
    return mapSuggestion(result.rows[0]!);
  }

  async getSuggestion(suggestionId: string): Promise<AiSuggestion | null> {
    const result = await this.db.query<AiSuggestionRow>(
      `
        select
          id, component_id, task_run_id, proposed_text, rationale, confidence, warnings, status, created_at, decided_at
        from ai_suggestions
        where id = $1
      `,
      [suggestionId]
    );
    return result.rows[0] ? mapSuggestion(result.rows[0]) : null;
  }

  async listSuggestionsForDocument(documentId: string): Promise<AiSuggestion[]> {
    const result = await this.db.query<AiSuggestionRow>(
      `
        select
          ai_suggestions.id,
          ai_suggestions.component_id,
          ai_suggestions.task_run_id,
          ai_suggestions.proposed_text,
          ai_suggestions.rationale,
          ai_suggestions.confidence,
          ai_suggestions.warnings,
          ai_suggestions.status,
          ai_suggestions.created_at,
          ai_suggestions.decided_at
        from ai_suggestions
        join review_components on review_components.id = ai_suggestions.component_id
        where review_components.document_id = $1
        order by ai_suggestions.created_at desc, ai_suggestions.id asc
      `,
      [documentId]
    );
    return result.rows.map(mapSuggestion);
  }

  async setSuggestionStatus(suggestionId: string, status: AiSuggestionStatus): Promise<AiSuggestion | null> {
    const result = await this.db.query<AiSuggestionRow>(
      `
        update ai_suggestions
        set status = $2, decided_at = case when $2 = 'proposed' then null else now() end
        where id = $1
        returning
          id, component_id, task_run_id, proposed_text, rationale, confidence, warnings, status, created_at, decided_at
      `,
      [suggestionId, status]
    );
    return result.rows[0] ? mapSuggestion(result.rows[0]) : null;
  }
}

function mapSuggestion(row: AiSuggestionRow): AiSuggestion {
  return {
    id: row.id,
    componentId: row.component_id,
    taskRunId: row.task_run_id,
    proposedText: row.proposed_text,
    rationale: row.rationale,
    confidence: typeof row.confidence === "number" ? row.confidence : Number(row.confidence),
    warnings: row.warnings,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at
  };
}
