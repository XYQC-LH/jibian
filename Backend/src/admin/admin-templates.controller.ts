import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminTemplatesService } from "./admin-templates.service";

@Controller("v1/admin/templates")
@UseGuards(AdminGuard)
export class AdminTemplatesController {
  constructor(private readonly templates: AdminTemplatesService) {}

  @Get("statistics")
  getStatistics() {
    return this.templates.getStatistics();
  }
}
