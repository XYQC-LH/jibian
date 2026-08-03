import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { CreateTemplateDto } from "../templates/dto/create-template.dto";
import { UpdateTemplateDto } from "../templates/dto/update-template.dto";
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

  @Get()
  list() {
    return this.templateService.listAdmin();
  }

  @Post()
  create(@Body() dto: CreateTemplateDto) {
    return this.templateService.createAdmin(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateTemplateDto) {
    return this.templateService.updateAdmin(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.templateService.deleteAdmin(id);
  }
}
