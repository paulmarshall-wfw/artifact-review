alter table task_definitions
  add column if not exists display_order integer not null default 0,
  add column if not exists enabled boolean not null default true,
  add column if not exists model_override text,
  add column if not exists display_label text,
  add column if not exists display_description text;

update task_definitions
set
  display_order = case task_key
    when 'suggest-component-revision' then 10
    when 'draft-review-note' then 20
    when 'summarize-section-findings' then 30
    else display_order
  end,
  display_label = case task_key
    when 'suggest-component-revision' then 'AI Suggest'
    when 'draft-review-note' then 'Draft Review Note'
    when 'summarize-section-findings' then 'Summarize Section'
    else coalesce(display_label, task_key)
  end,
  display_description = case task_key
    when 'suggest-component-revision' then 'Propose a component text revision without applying it.'
    when 'draft-review-note' then 'Draft an annotation or question for a component.'
    when 'summarize-section-findings' then 'Summarize review signals for the active section.'
    else display_description
  end;
