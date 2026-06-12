import { z } from "zod";

export const suggestComponentRevisionOutputSchema = z.object({
  proposedText: z.string().min(1),
  rationale: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sourceComponentId: z.string().min(1),
  warnings: z.array(z.string()).default([])
});

export type TaskDefinition = {
  taskKey: string;
  requiredCapability: string;
  promptVersion: string;
  renderSlot: string;
  hookKey: string;
};

export const mvpTaskDefinitions: TaskDefinition[] = [
  {
    taskKey: "suggest-component-revision",
    requiredCapability: "llm.generateJson",
    promptVersion: "0.1.0",
    renderSlot: "component.inline.aiSuggest",
    hookKey: "store-ai-suggestion"
  },
  {
    taskKey: "summarize-section-findings",
    requiredCapability: "llm.generateJson",
    promptVersion: "0.1.0",
    renderSlot: "section.toolbar",
    hookKey: "store-section-summary"
  },
  {
    taskKey: "draft-review-note",
    requiredCapability: "llm.generateJson",
    promptVersion: "0.1.0",
    renderSlot: "component.drawer.noteDraft",
    hookKey: "store-draft-review-note"
  }
];

