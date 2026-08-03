import { Controller, Get } from "@nestjs/common";
import { OperationService } from "./operation.service";

@Controller("operation")
export class OperationController {
  constructor(private readonly operation: OperationService) {}

  @Get("home")
  async getHomeOperation() {
    return { success: true, data: await this.operation.getPublicHomeConfig() };
  }
}
