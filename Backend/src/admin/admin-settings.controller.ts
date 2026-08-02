import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminSettingsService } from "./admin-settings.service";

@Controller("v1/settings")
@UseGuards(AdminGuard)
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

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

}
