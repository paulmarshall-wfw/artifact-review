insert into processing_hooks (hook_key, implementation_key, policy)
values
  ('store-ai-suggestion', 'store-ai-suggestion', 'block_when_missing'),
  ('store-section-summary', 'store-section-summary', 'block_when_missing'),
  ('store-draft-review-note', 'store-draft-review-note', 'block_when_missing')
on conflict (hook_key)
do update set
  implementation_key = excluded.implementation_key,
  policy = excluded.policy;

insert into task_definitions (task_key, provider_key, required_capability, prompt_version, render_slot, hook_key)
values
  (
    'suggest-component-revision',
    null,
    'llm.generateJson',
    '0.1.0',
    'component.inline.aiSuggest',
    'store-ai-suggestion'
  ),
  (
    'summarize-section-findings',
    null,
    'llm.generateJson',
    '0.1.0',
    'section.toolbar',
    'store-section-summary'
  ),
  (
    'draft-review-note',
    null,
    'llm.generateJson',
    '0.1.0',
    'component.drawer.noteDraft',
    'store-draft-review-note'
  )
on conflict (task_key)
do update set
  provider_key = excluded.provider_key,
  required_capability = excluded.required_capability,
  prompt_version = excluded.prompt_version,
  render_slot = excluded.render_slot,
  hook_key = excluded.hook_key;

insert into prompt_versions (task_key, version, prompt)
values
  (
    'suggest-component-revision',
    '0.1.0',
    '{
      "name": "suggest-component-revision",
      "purpose": "Propose a revised text value for one review component without mutating the document.",
      "systemInstructions": "You are assisting a reviewer. Return only JSON that matches the structured output schema. Do not apply edits directly.",
      "userInstructions": "Suggest a clearer revision for the selected component while preserving meaning, source constraints, and review intent.",
      "variables": ["documentName", "componentId", "componentKind", "sectionId", "currentText", "sourceRange"]
    }'::jsonb
  ),
  (
    'summarize-section-findings',
    '0.1.0',
    '{
      "name": "summarize-section-findings",
      "purpose": "Summarize review findings for a section without applying changes.",
      "systemInstructions": "Return structured JSON only. Do not mutate document state.",
      "userInstructions": "Summarize annotations, questions, evidence, and highlighted issues for the selected section.",
      "variables": ["documentName", "sectionId", "components", "reviewRecords"]
    }'::jsonb
  ),
  (
    'draft-review-note',
    '0.1.0',
    '{
      "name": "draft-review-note",
      "purpose": "Draft a review note for a component without creating an annotation or question automatically.",
      "systemInstructions": "Return structured JSON only. The user decides whether to store the note.",
      "userInstructions": "Draft a concise note explaining the issue or question in the selected component.",
      "variables": ["documentName", "componentId", "currentText", "reviewContext"]
    }'::jsonb
  )
on conflict (task_key, version)
do update set prompt = excluded.prompt;

insert into structured_output_schemas (task_key, version, schema)
values
  (
    'suggest-component-revision',
    '0.1.0',
    '{
      "type": "object",
      "additionalProperties": false,
      "required": ["proposedText", "rationale", "confidence", "sourceComponentId", "warnings"],
      "properties": {
        "proposedText": { "type": "string", "minLength": 1 },
        "rationale": { "type": "string", "minLength": 1 },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "sourceComponentId": { "type": "string", "minLength": 1 },
        "warnings": { "type": "array", "items": { "type": "string" } }
      }
    }'::jsonb
  ),
  (
    'summarize-section-findings',
    '0.1.0',
    '{
      "type": "object",
      "additionalProperties": false,
      "required": ["summary", "openQuestions", "warnings"],
      "properties": {
        "summary": { "type": "string", "minLength": 1 },
        "openQuestions": { "type": "array", "items": { "type": "string" } },
        "warnings": { "type": "array", "items": { "type": "string" } }
      }
    }'::jsonb
  ),
  (
    'draft-review-note',
    '0.1.0',
    '{
      "type": "object",
      "additionalProperties": false,
      "required": ["body", "noteKind", "confidence", "warnings"],
      "properties": {
        "body": { "type": "string", "minLength": 1 },
        "noteKind": { "type": "string", "enum": ["annotation", "question"] },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "warnings": { "type": "array", "items": { "type": "string" } }
      }
    }'::jsonb
  )
on conflict (task_key, version)
do update set schema = excluded.schema;

insert into render_slot_mappings (render_slot, task_key)
values
  ('component.inline.aiSuggest', 'suggest-component-revision'),
  ('section.toolbar', 'summarize-section-findings'),
  ('component.drawer.noteDraft', 'draft-review-note')
on conflict (render_slot)
do update set task_key = excluded.task_key;
