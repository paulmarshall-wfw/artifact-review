import type { Queryable } from "./types.js";
import { AiSuggestionsRepository } from "./aiSuggestions.js";
import { AppSettingsRepository } from "./appSettings.js";
import { DocumentsRepository } from "./documents.js";
import { TaskRunsRepository } from "./taskRuns.js";
import { WorkflowsRepository } from "./workflows.js";

export type Repositories = ReturnType<typeof createRepositories>;

export function createRepositories(db: Queryable) {
  return {
    aiSuggestions: new AiSuggestionsRepository(db),
    appSettings: new AppSettingsRepository(db),
    documents: new DocumentsRepository(db),
    taskRuns: new TaskRunsRepository(db),
    workflows: new WorkflowsRepository(db)
  };
}
