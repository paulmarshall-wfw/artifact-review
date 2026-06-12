import { randomUUID } from "node:crypto";
import { toJsonValue, type JsonValue, type Queryable } from "./types.js";

export type DocumentSummary = {
  id: string;
  projectId: string | null;
  name: string;
  sourceType: string;
  originalFormat: string;
  currentWorkflowItemRef: string | null;
  ingestedAt: Date;
  updatedAt: Date;
};

export type DocumentVersion = {
  id: string;
  documentId: string;
  versionNumber: number;
  sourceSnapshot: string;
  currentSnapshot: string;
  parserMetadata: JsonValue;
  createdAt: Date;
};

export type ReviewComponent = {
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

type DocumentRow = {
  id: string;
  project_id: string | null;
  name: string;
  source_type: string;
  original_format: string;
  current_workflow_item_ref: string | null;
  ingested_at: Date;
  updated_at: Date;
};

type VersionRow = {
  id: string;
  document_id: string;
  version_number: number;
  source_snapshot: string;
  current_snapshot: string;
  parser_metadata: JsonValue;
  created_at: Date;
};

type ComponentRow = {
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

export type CreateDocumentInput = {
  id?: string;
  projectId?: string | null;
  name: string;
  sourceType: string;
  originalFormat: string;
  currentWorkflowItemRef?: string | null;
};

export type CreateDocumentVersionInput = {
  id?: string;
  documentId: string;
  versionNumber: number;
  sourceSnapshot: string;
  currentSnapshot: string;
  parserMetadata?: JsonValue;
};

export type CreateReviewComponentInput = {
  id: string;
  documentId: string;
  kind: string;
  sectionId: string;
  sourceRange?: JsonValue;
  currentText: string;
  originalTextHash: string;
};

export class DocumentsRepository {
  constructor(private readonly db: Queryable) {}

  async listDocuments(): Promise<DocumentSummary[]> {
    const result = await this.db.query<DocumentRow>(`
      select id, project_id, name, source_type, original_format, current_workflow_item_ref, ingested_at, updated_at
      from documents
      order by updated_at desc, ingested_at desc
    `);
    return result.rows.map(mapDocument);
  }

  async getDocument(documentId: string): Promise<DocumentSummary | null> {
    const result = await this.db.query<DocumentRow>(
      `
        select id, project_id, name, source_type, original_format, current_workflow_item_ref, ingested_at, updated_at
        from documents
        where id = $1
      `,
      [documentId]
    );
    return result.rows[0] ? mapDocument(result.rows[0]) : null;
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    const result = await this.db.query<VersionRow>(
      `
        select id, document_id, version_number, source_snapshot, current_snapshot, parser_metadata, created_at
        from document_versions
        where document_id = $1
        order by version_number asc
      `,
      [documentId]
    );
    return result.rows.map(mapVersion);
  }

  async getReviewComponents(documentId: string): Promise<ReviewComponent[]> {
    const result = await this.db.query<ComponentRow>(
      `
        select id, document_id, kind, section_id, source_range, current_text, original_text_hash, created_at, updated_at
        from review_components
        where document_id = $1
        order by section_id asc, created_at asc, id asc
      `,
      [documentId]
    );
    return result.rows.map(mapComponent);
  }

  async createDocument(input: CreateDocumentInput): Promise<DocumentSummary> {
    const result = await this.db.query<DocumentRow>(
      `
        insert into documents (id, project_id, name, source_type, original_format, current_workflow_item_ref)
        values ($1, $2, $3, $4, $5, $6)
        returning id, project_id, name, source_type, original_format, current_workflow_item_ref, ingested_at, updated_at
      `,
      [
        input.id ?? randomUUID(),
        input.projectId ?? null,
        input.name,
        input.sourceType,
        input.originalFormat,
        input.currentWorkflowItemRef ?? null
      ]
    );
    return mapDocument(result.rows[0]!);
  }

  async createDocumentVersion(input: CreateDocumentVersionInput): Promise<DocumentVersion> {
    const result = await this.db.query<VersionRow>(
      `
        insert into document_versions
          (id, document_id, version_number, source_snapshot, current_snapshot, parser_metadata)
        values ($1, $2, $3, $4, $5, $6)
        returning id, document_id, version_number, source_snapshot, current_snapshot, parser_metadata, created_at
      `,
      [
        input.id ?? randomUUID(),
        input.documentId,
        input.versionNumber,
        input.sourceSnapshot,
        input.currentSnapshot,
        toJsonValue(input.parserMetadata ?? {})
      ]
    );
    return mapVersion(result.rows[0]!);
  }

  async createReviewComponents(inputs: CreateReviewComponentInput[]): Promise<ReviewComponent[]> {
    const components: ReviewComponent[] = [];

    for (const input of inputs) {
      const result = await this.db.query<ComponentRow>(
        `
          insert into review_components
            (id, document_id, kind, section_id, source_range, current_text, original_text_hash)
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id, document_id, kind, section_id, source_range, current_text, original_text_hash, created_at, updated_at
        `,
        [
          input.id,
          input.documentId,
          input.kind,
          input.sectionId,
          toJsonValue(input.sourceRange ?? {}),
          input.currentText,
          input.originalTextHash
        ]
      );
      components.push(mapComponent(result.rows[0]!));
    }

    return components;
  }
}

function mapDocument(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    sourceType: row.source_type,
    originalFormat: row.original_format,
    currentWorkflowItemRef: row.current_workflow_item_ref,
    ingestedAt: row.ingested_at,
    updatedAt: row.updated_at
  };
}

function mapVersion(row: VersionRow): DocumentVersion {
  return {
    id: row.id,
    documentId: row.document_id,
    versionNumber: row.version_number,
    sourceSnapshot: row.source_snapshot,
    currentSnapshot: row.current_snapshot,
    parserMetadata: row.parser_metadata,
    createdAt: row.created_at
  };
}

function mapComponent(row: ComponentRow): ReviewComponent {
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
