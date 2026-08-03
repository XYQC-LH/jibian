import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { OperationService } from "../operation/operation.service";
import { AdminSettingsService } from "./admin-settings.service";

@Controller("v1/settings")
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(
    private readonly settings: AdminSettingsService,
    private readonly operation: OperationService,
  ) {}

  @Get("registration-bonus")
  getRegistrationBonus() {
    return this.settings.getRegistrationBonus();
  }

  @Put("registration-bonus")
  updateRegistrationBonus(@Body() body: { registration_bonus_credits?: number }) {
    return this.settings.updateRegistrationBonus(body);
  }

  @Get("system-config")
  getSystemConfig() {
    return this.settings.getSystemConfig();
  }

  @Put("system-config")
  updateSystemConfig(@Body() body: Record<string, unknown>) {
    return this.settings.updateSystemConfig(body);
  }

  @Get("operation")
  async getOperationConfig() {
    return { success: true, data: await this.operation.getAdminConfig() };
  }

  @Put("operation")
  async updateOperationConfig(@Body() body: Record<string, unknown>) {
    return { success: true, data: await this.operation.updateAdminConfig(body) };
  }
}
