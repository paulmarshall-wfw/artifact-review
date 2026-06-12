import {
  documentWorkflowBundleSchema,
  type DocumentWorkflowBundle
} from "../workflow/definition.js";
import { AppSettingsRepository } from "./appSettings.js";
import { toJsonValue, type JsonValue, type Queryable } from "./types.js";

const activeDocumentWorkflowKey = "activeDocumentWorkflowDefinition";

export class WorkflowsRepository {
  private readonly appSettings: AppSettingsRepository;

  constructor(db: Queryable) {
    this.appSettings = new AppSettingsRepository(db);
  }

  async getActiveDocumentWorkflow(): Promise<DocumentWorkflowBundle | null> {
    const value = await this.appSettings.get<JsonValue>(activeDocumentWorkflowKey);
    if (!value) {
      return null;
    }

    return documentWorkflowBundleSchema.parse(value);
  }

  async setActiveDocumentWorkflow(definition: DocumentWorkflowBundle): Promise<void> {
    await this.appSettings.set(activeDocumentWorkflowKey, toJsonValue(definition));
  }
}
