import { importDefinitionBundle, type DefinitionBundle } from "state-workflow-runtime";
import { AppSettingsRepository } from "./appSettings.js";
import { toJsonValue, type JsonValue, type Queryable } from "./types.js";

const activeDocumentWorkflowKey = "activeDocumentWorkflowDefinition";

export class WorkflowsRepository {
  private readonly appSettings: AppSettingsRepository;

  constructor(db: Queryable) {
    this.appSettings = new AppSettingsRepository(db);
  }

  async getActiveDocumentWorkflow(): Promise<DefinitionBundle | null> {
    const value = await this.appSettings.get<JsonValue>(activeDocumentWorkflowKey);
    if (!value) {
      return null;
    }

    return importDefinitionBundle(value).bundle;
  }

  async setActiveDocumentWorkflow(definition: DefinitionBundle): Promise<void> {
    await this.appSettings.set(activeDocumentWorkflowKey, toJsonValue(definition));
  }
}
