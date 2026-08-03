import { httpClient } from './lib/http/httpClient';

import { FinanceAdminClient } from './clients/financeClient';
import { OrderAdminClient } from './clients/orderClient';
import { ModelAdminClient } from './clients/modelClient';
import { SystemAdminClient } from './clients/systemClient';
import { TaskAdminClient } from './clients/taskClient';
import { ModerationAdminClient } from './clients/moderationClient';
import { DispatchAdminClient } from './clients/dispatchClient';
import { OperationAdminClient } from './clients/operationClient';
import { TemplateAdminClient } from './clients/templateClient';

export class ApiClient {
  readonly finance: FinanceAdminClient;
  readonly order: OrderAdminClient;
  readonly model: ModelAdminClient;
  readonly system: SystemAdminClient;
  readonly task: TaskAdminClient;
  readonly moderation: ModerationAdminClient;
  readonly dispatch: DispatchAdminClient;
  readonly operation: OperationAdminClient;
  readonly template: TemplateAdminClient;

  constructor() {
    this.finance = new FinanceAdminClient(httpClient);
    this.order = new OrderAdminClient(httpClient);
    this.model = new ModelAdminClient(httpClient);
    this.system = new SystemAdminClient(httpClient);
    this.task = new TaskAdminClient(httpClient);
    this.moderation = new ModerationAdminClient(httpClient);
    this.dispatch = new DispatchAdminClient(httpClient);
    this.operation = new OperationAdminClient(httpClient);
    this.template = new TemplateAdminClient(httpClient);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
