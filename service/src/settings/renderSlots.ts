export type RenderSlotDefinition = {
  slot: string;
  label: string;
  description: string;
};

export const artifactReviewRenderSlots: RenderSlotDefinition[] = [
  {
    slot: "component.inline.aiSuggest",
    label: "Inline AI Suggest",
    description: "Actions shown inside the selected component AI suggestions panel."
  },
  {
    slot: "component.inline.textTools",
    label: "Inline Text Tools",
    description: "Actions near component text editing and review controls."
  },
  {
    slot: "component.drawer.noteDraft",
    label: "Note Draft Drawer",
    description: "Actions for drafting annotations or questions for a selected component."
  },
  {
    slot: "section.toolbar",
    label: "Section Toolbar",
    description: "Actions scoped to a document section."
  },
  {
    slot: "document.toolbar",
    label: "Document Toolbar",
    description: "Actions available from the document toolbar."
  },
  {
    slot: "document.footer",
    label: "Document Footer",
    description: "Lower-priority document actions and status-adjacent controls."
  },
  {
    slot: "admin.diagnostics",
    label: "Settings Diagnostics",
    description: "Diagnostic and provider-readiness task actions in Settings."
  }
];

export function isKnownArtifactReviewRenderSlot(slot: string): boolean {
  return artifactReviewRenderSlots.some((definition) => definition.slot === slot);
}
