import { randomUUID } from "node:crypto";
import { toJsonValue, type JsonValue, type Queryable } from "./types.js";

export type ComponentRevision = {
  id: string;
  componentId: string;
  previousText: string;
  revisedText: string;
  editSource: string;
  aiSuggestionId: string | null;
  createdAt: Date;
};

export type Annotation = {
  id: string;
  componentId: string;
  body: string;
  createdAt: Date;
};

export type Question = {
  id: string;
  componentId: string;
  body: string;
  status: string;
  createdAt: Date;
};

export type EvidenceSource = {
  id: string;
  componentId: string;
  kind: string;
  value: string;
  createdAt: Date;
};

export type Highlight = {
  componentId: string;
  enabled: boolean;
  updatedAt: Date;
};

export type AutosaveSnapshot = {
  id: string;
  documentId: string;
  snapshot: JsonValue;
  createdAt: Date;
};

export type ReviewComponentForMutation = {
  id: string;
  documentId: string;
  kind: string;
  sectionId: string;
  sourceRange: JsonValue;
  currentText: string;
  originalTextHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type ComponentMutationRow = {
  id: string;
  document_id: string;
  kind: string;
  section_id: string;
  source_range: JsonValue;
  current_text: string;
  original_text_hash: string;
  created_at: Date;
  updated_at: Date;
};

type RevisionRow = {
  id: string;
  component_id: string;
  previous_text: string;
  revised_text: string;
  edit_source: string;
  ai_suggestion_id: string | null;
  created_at: Date;
};

type AnnotationRow = {
  id: string;
  component_id: string;
  body: string;
  created_at: Date;
};

type QuestionRow = {
  id: string;
  component_id: string;
  body: string;
  status: string;
  created_at: Date;
};

type EvidenceRow = {
  id: string;
  component_id: string;
  kind: string;
  value: string;
  created_at: Date;
};

type HighlightRow = {
  component_id: string;
  enabled: boolean;
  updated_at: Date;
};

type AutosaveRow = {
  id: string;
  document_id: string;
  snapshot: JsonValue;
  created_at: Date;
};

type EditComponentTextRow = {
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
};

export class ReviewRepository {
  constructor(private readonly db: Queryable) {}

  async getComponent(componentId: string): Promise<ReviewComponentForMutation | null> {
    const result = await this.db.query<ComponentMutationRow>(
      `
        select id, document_id, kind, section_id, source_range, current_text, original_text_hash, created_at, updated_at
        from review_components
        where id = $1
      `,
      [componentId]
    );
    return result.rows[0] ? mapComponent(result.rows[0]) : null;
  }

  async updateComponentText(
    componentId: string,
    revisedText: string,
    editSource: string,
    aiSuggestionId: string | null = null
  ): Promise<{ component: ReviewComponentForMutation; revision: ComponentRevision } | null> {
    const revisionId = randomUUID();
    const result = await this.db.query<EditComponentTextRow>(
      `
        with existing as (
          select id, current_text
          from review_components
          where id = $1
        ),
        updated as (
          update review_components
          set current_text = $2, updated_at = now()
          where id = $1
          returning id, document_id, kind, section_id, source_range, current_text, original_text_hash, created_at, updated_at
        ),
        revision as (
          insert into component_revisions
            (id, component_id, previous_text, revised_text, edit_source, ai_suggestion_id)
          select $5, existing.id, existing.current_text, $2, $3, $4
          from existing
          returning id, component_id, previous_text, revised_text, edit_source, ai_suggestion_id, created_at
        )
        select
          updated.id as component_id,
          updated.document_id as component_document_id,
          updated.kind as component_kind,
          updated.section_id as component_section_id,
          updated.source_range as component_source_range,
          updated.current_text as component_current_text,
          updated.original_text_hash as component_original_text_hash,
          updated.created_at as component_created_at,
          updated.updated_at as component_updated_at,
          revision.id as revision_id,
          revision.component_id as revision_component_id,
          revision.previous_text as revision_previous_text,
          revision.revised_text as revision_revised_text,
          revision.edit_source as revision_edit_source,
          revision.ai_suggestion_id as revision_ai_suggestion_id,
          revision.created_at as revision_created_at
        from updated
        join revision on revision.component_id = updated.id
      `,
      [componentId, revisedText, editSource, aiSuggestionId, revisionId]
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      component: mapComponent({
        id: row.component_id,
        document_id: row.component_document_id,
        kind: row.component_kind,
        section_id: row.component_section_id,
        source_range: row.component_source_range,
        current_text: row.component_current_text,
        original_text_hash: row.component_original_text_hash,
        created_at: row.component_created_at,
        updated_at: row.component_updated_at
      }),
      revision: mapRevision({
        id: row.revision_id,
        component_id: row.revision_component_id,
        previous_text: row.revision_previous_text,
        revised_text: row.revision_revised_text,
        edit_source: row.revision_edit_source,
        ai_suggestion_id: row.revision_ai_suggestion_id,
        created_at: row.revision_created_at
      })
    };
  }

  async createAnnotation(componentId: string, body: string): Promise<Annotation> {
    const result = await this.db.query<AnnotationRow>(
      `
        insert into annotations (id, component_id, body)
        values ($1, $2, $3)
        returning id, component_id, body, created_at
      `,
      [randomUUID(), componentId, body]
    );
    return mapAnnotation(result.rows[0]!);
  }

  async createQuestion(componentId: string, body: string): Promise<Question> {
    const result = await this.db.query<QuestionRow>(
      `
        insert into questions (id, component_id, body)
        values ($1, $2, $3)
        returning id, component_id, body, status, created_at
      `,
      [randomUUID(), componentId, body]
    );
    return mapQuestion(result.rows[0]!);
  }

  async createEvidenceSource(componentId: string, kind: string, value: string): Promise<EvidenceSource> {
    const result = await this.db.query<EvidenceRow>(
      `
        insert into evidence_sources (id, component_id, kind, value)
        values ($1, $2, $3, $4)
        returning id, component_id, kind, value, created_at
      `,
      [randomUUID(), componentId, kind, value]
    );
    return mapEvidence(result.rows[0]!);
  }

  async setHighlight(componentId: string, enabled: boolean): Promise<Highlight> {
    const result = await this.db.query<HighlightRow>(
      `
        insert into highlights (component_id, enabled, updated_at)
        values ($1, $2, now())
        on conflict (component_id)
        do update set enabled = excluded.enabled, updated_at = now()
        returning component_id, enabled, updated_at
      `,
      [componentId, enabled]
    );
    return mapHighlight(result.rows[0]!);
  }

  async createAutosaveSnapshot(documentId: string, snapshot: JsonValue): Promise<AutosaveSnapshot> {
    const result = await this.db.query<AutosaveRow>(
      `
        insert into autosave_snapshots (id, document_id, snapshot)
        values ($1, $2, $3)
        returning id, document_id, snapshot, created_at
      `,
      [randomUUID(), documentId, toJsonValue(snapshot)]
    );
    return mapAutosave(result.rows[0]!);
  }

  async listAnnotations(documentId: string): Promise<Annotation[]> {
    const result = await this.db.query<AnnotationRow>(
      `
        select annotations.id, annotations.component_id, annotations.body, annotations.created_at
        from annotations
        join review_components on review_components.id = annotations.component_id
        where review_components.document_id = $1
        order by annotations.created_at asc, annotations.id asc
      `,
      [documentId]
    );
    return result.rows.map(mapAnnotation);
  }

  async listQuestions(documentId: string): Promise<Question[]> {
    const result = await this.db.query<QuestionRow>(
      `
        select questions.id, questions.component_id, questions.body, questions.status, questions.created_at
        from questions
        join review_components on review_components.id = questions.component_id
        where review_components.document_id = $1
        order by questions.created_at asc, questions.id asc
      `,
      [documentId]
    );
    return result.rows.map(mapQuestion);
  }

  async listEvidenceSources(documentId: string): Promise<EvidenceSource[]> {
    const result = await this.db.query<EvidenceRow>(
      `
        select evidence_sources.id, evidence_sources.component_id, evidence_sources.kind, evidence_sources.value, evidence_sources.created_at
        from evidence_sources
        join review_components on review_components.id = evidence_sources.component_id
        where review_components.document_id = $1
        order by evidence_sources.created_at asc, evidence_sources.id asc
      `,
      [documentId]
    );
    return result.rows.map(mapEvidence);
  }

  async listHighlights(documentId: string): Promise<Highlight[]> {
    const result = await this.db.query<HighlightRow>(
      `
        select highlights.component_id, highlights.enabled, highlights.updated_at
        from highlights
        join review_components on review_components.id = highlights.component_id
        where review_components.document_id = $1
        order by highlights.updated_at asc, highlights.component_id asc
      `,
      [documentId]
    );
    return result.rows.map(mapHighlight);
  }
}

function mapComponent(row: ComponentMutationRow): ReviewComponentForMutation {
  return {
    id: row.id,
    documentId: row.document_id,
    kind: row.kind,
    sectionId: row.section_id,
    sourceRange: row.source_range,
    currentText: row.current_text,
    originalTextHash: row.original_text_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRevision(row: RevisionRow): ComponentRevision {
  return {
    id: row.id,
    componentId: row.component_id,
    previousText: row.previous_text,
    revisedText: row.revised_text,
    editSource: row.edit_source,
    aiSuggestionId: row.ai_suggestion_id,
    createdAt: row.created_at
  };
}

function mapAnnotation(row: AnnotationRow): Annotation {
  return {
    id: row.id,
    componentId: row.component_id,
    body: row.body,
    createdAt: row.created_at
  };
}

function mapQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    componentId: row.component_id,
    body: row.body,
    status: row.status,
    createdAt: row.created_at
  };
}

function mapEvidence(row: EvidenceRow): EvidenceSource {
  return {
    id: row.id,
    componentId: row.component_id,
    kind: row.kind,
    value: row.value,
    createdAt: row.created_at
  };
}

function mapHighlight(row: HighlightRow): Highlight {
  return {
    componentId: row.component_id,
    enabled: row.enabled,
    updatedAt: row.updated_at
  };
}

function mapAutosave(row: AutosaveRow): AutosaveSnapshot {
  return {
    id: row.id,
    documentId: row.document_id,
    snapshot: row.snapshot,
    createdAt: row.created_at
  };
}
