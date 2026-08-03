import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CreateTemplateCoverUploadUrlDto } from "./dto/create-cover-upload-url.dto";
import { CreateTemplateIngestDto } from "./dto/create-template-ingest.dto";
import { TemplateIngestGuard } from "./template-ingest.guard";
import { TemplateIngestService } from "./template-ingest.service";

@Controller("v1/template-ingest")
@UseGuards(TemplateIngestGuard)
export class TemplateIngestController {
  constructor(private readonly templateIngest: TemplateIngestService) {}

  @Get("categories")
  listCategories() {
    return this.templateIngest.listCategories();
  }

  @Post("covers/upload-url")
  createCoverUploadUrl(@Body() dto: CreateTemplateCoverUploadUrlDto) {
    return this.templateIngest.createCoverUploadUrl(dto);
  }

  @Post("templates")
  createTemplate(@Body() dto: CreateTemplateIngestDto) {
    return this.templateIngest.createTemplate(dto);
  }
}
