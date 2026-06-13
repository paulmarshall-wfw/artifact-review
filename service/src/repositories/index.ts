import type { Queryable } from "./types.js";
import { AiSuggestionsRepository } from "./aiSuggestions.js";
import { AppSettingsRepository } from "./appSettings.js";
import { DocumentsRepository } from "./documents.js";
import { ProviderTasksRepository } from "./providerTasks.js";
import { ReviewRepository } from "./review.js";
import { TaskRunsRepository } from "./taskRuns.js";
import { WorkflowsRepository } from "./workflows.js";

export type Repositories = ReturnType<typeof createRepositories>;

export function createRepositories(db: Queryable) {
  return {
    db,
    aiSuggestions: new AiSuggestionsRepository(db),
    appSettings: new AppSettingsRepository(db),
    documents: new DocumentsRepository(db),
    providerTasks: new ProviderTasksRepository(db),
    review: new ReviewRepository(db),
    taskRuns: new TaskRunsRepository(db),
    workflows: new WorkflowsRepository(db)
  };
}
