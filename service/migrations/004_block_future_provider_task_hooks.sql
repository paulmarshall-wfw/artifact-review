update processing_hooks
set implementation_key = 'unimplemented:store-section-summary'
where hook_key = 'store-section-summary';

update processing_hooks
set implementation_key = 'unimplemented:store-draft-review-note'
where hook_key = 'store-draft-review-note';
