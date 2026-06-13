import { randomUUID } from "node:crypto";
import type { ComponentRevision, ReviewComponentForMutation } from "./review.js";
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

type AcceptedSuggestionRow = {
  component_id: string;
  component_document_id: string;
  component_kind: string;
  component_section_id: string;
  component_source_range: JsonValue;
  component_current_text: string;
  component_original_text_hash: string;
  component_created_at: Date;
  component_updated_at: Date;
  revision_id: string;
  revision_component_id: string;
  revision_previous_text: string;
  revision_revised_text: string;
  revision_edit_source: string;
  revision_ai_suggestion_id: string | null;
  revision_created_at: Date;
  suggestion_id: string;
  suggestion_component_id: string;
  suggestion_task_run_id: string | null;
  suggestion_proposed_text: string;
  suggestion_rationale: string;
  suggestion_confidence: string | number;
  suggestion_warnings: JsonValue;
  suggestion_status: AiSuggestionStatus;
  suggestion_created_at: Date;
  suggestion_decided_at: Date | null;
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

  async acceptSuggestion(suggestionId: string): Promise<{
    suggestion: AiSuggestion;
    component: ReviewComponentForMutation;
    revision: ComponentRevision;
  } | null> {
    const revisionId = randomUUID();
    const result = await this.db.query<AcceptedSuggestionRow>(
      `
        with suggestion as (
          select id, component_id, proposed_text
          from ai_suggestions
          where id = $1 and status = 'proposed'
        ),
        existing as (
          select review_components.id, review_components.current_text
          from review_components
          join suggestion on suggestion.component_id = review_components.id
        ),
        updated_component as (
          update review_components
          set current_text = suggestion.proposed_text, updated_at = now()
          from suggestion
          where review_components.id = suggestion.component_id
          returning
            review_components.id,
            review_components.document_id,
            review_components.kind,
            review_components.section_id,
            review_components.source_range,
            review_components.current_text,
            review_components.original_text_hash,
            review_components.created_at,
            review_components.updated_at
        ),
        revision as (
          insert into component_revisions
            (id, component_id, previous_text, revised_text, edit_source, ai_suggestion_id)
          select $2, existing.id, existing.current_text, suggestion.proposed_text, 'accepted_ai_suggestion', suggestion.id
          from existing
          join suggestion on suggestion.component_id = existing.id
          returning id, component_id, previous_text, revised_text, edit_source, ai_suggestion_id, created_at
        ),
        accepted_suggestion as (
          update ai_suggestions
          set status = 'accepted', decided_at = now()
          from suggestion
          where ai_suggestions.id = suggestion.id
          returning
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
        )
        select
          updated_component.id as component_id,
          updated_component.document_id as component_document_id,
          updated_component.kind as component_kind,
          updated_component.section_id as component_section_id,
          updated_component.source_range as component_source_range,
          updated_component.current_text as component_current_text,
          updated_component.original_text_hash as component_original_text_hash,
          updated_component.created_at as component_created_at,
          updated_component.updated_at as component_updated_at,
          revision.id as revision_id,
          revision.component_id as revision_component_id,
          revision.previous_text as revision_previous_text,
          revision.revised_text as revision_revised_text,
          revision.edit_source as revision_edit_source,
          revision.ai_suggestion_id as revision_ai_suggestion_id,
          revision.created_at as revision_created_at,
          accepted_suggestion.id as suggestion_id,
          accepted_suggestion.component_id as suggestion_component_id,
          accepted_suggestion.task_run_id as suggestion_task_run_id,
          accepted_suggestion.proposed_text as suggestion_proposed_text,
          accepted_suggestion.rationale as suggestion_rationale,
          accepted_suggestion.confidence as suggestion_confidence,
          accepted_suggestion.warnings as suggestion_warnings,
          accepted_suggestion.status as suggestion_status,
          accepted_suggestion.created_at as suggestion_created_at,
          accepted_suggestion.decided_at as suggestion_decided_at
        from updated_component
        join revision on revision.component_id = updated_component.id
        join accepted_suggestion on accepted_suggestion.component_id = updated_component.id
      `,
      [suggestionId, revisionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      component: {
        id: row.component_id,
        documentId: row.component_document_id,
        kind: row.component_kind,
        sectionId: row.component_section_id,
        sourceRange: row.component_source_range,
        currentText: row.component_current_text,
        originalTextHash: row.component_original_text_hash,
        createdAt: row.component_created_at,
        updatedAt: row.component_updated_at
      },
      revision: {
        id: row.revision_id,
        componentId: row.revision_component_id,
        previousText: row.revision_previous_text,
        revisedText: row.revision_revised_text,
        editSource: row.revision_edit_source,
        aiSuggestionId: row.revision_ai_suggestion_id,
        createdAt: row.revision_created_at
      },
      suggestion: mapSuggestion({
        id: row.suggestion_id,
        component_id: row.suggestion_component_id,
        task_run_id: row.suggestion_task_run_id,
        proposed_text: row.suggestion_proposed_text,
        rationale: row.suggestion_rationale,
        confidence: row.suggestion_confidence,
        warnings: row.suggestion_warnings,
        status: row.suggestion_status,
        created_at: row.suggestion_created_at,
        decided_at: row.suggestion_decided_at
      })
    };
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
