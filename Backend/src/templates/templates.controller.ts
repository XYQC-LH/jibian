import { Controller, Get } from "@nestjs/common";
import { TemplatesService } from "./templates.service";

@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  listPublished() {
    return this.templates.listPublished();
  }

}
