import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { CreateTemplateDto } from "../templates/dto/create-template.dto";
import { TemplatesService } from "../templates/templates.service";
import { AdminTemplatesService } from "./admin-templates.service";

@Controller("v1/admin/templates")
@UseGuards(AdminGuard)
export class AdminTemplatesController {
  constructor(
    private readonly templates: AdminTemplatesService,
    private readonly templateService: TemplatesService,
  ) {}

  @Get("statistics")
  getStatistics() {
    return this.templates.getStatistics();
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.createAdmin(dto);
  }
}
