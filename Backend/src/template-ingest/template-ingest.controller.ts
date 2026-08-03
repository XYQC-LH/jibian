import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { CreateTemplateCoverUploadUrlDto } from "./dto/create-cover-upload-url.dto";
import { CreateTemplateIngestDto } from "./dto/create-template-ingest.dto";
import {
  CreateTemplateIngestCategoryDto,
  UpdateTemplateIngestCategoryDto,
} from "./dto/template-ingest-category.dto";
import { UpdateTemplateIngestPricingDto } from "./dto/template-ingest-pricing.dto";
import { TemplateIngestReorderDto } from "./dto/template-ingest-reorder.dto";
import { UpdateTemplateIngestDto } from "./dto/update-template-ingest.dto";
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

  @Post("categories")
  createCategory(@Body() dto: CreateTemplateIngestCategoryDto) {
    return this.templateIngest.createCategory(dto);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: UpdateTemplateIngestCategoryDto) {
    return this.templateIngest.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  removeCategory(@Param("id") id: string) {
    return this.templateIngest.removeCategory(id);
  }

  @Post("categories/reorder")
  reorderCategories(@Body() dto: TemplateIngestReorderDto) {
    return this.templateIngest.reorderCategories(dto.items);
  }

  @Get("agent-context")
  getAgentContext() {
    return this.templateIngest.getAgentContext();
  }

  @Get("assets")
  listAssets(@Query("asset_type") assetType?: string) {
    return this.templateIngest.listAssets(assetType);
  }

  @Post("covers/upload-url")
  createCoverUploadUrl(@Body() dto: CreateTemplateCoverUploadUrlDto) {
    return this.templateIngest.createCoverUploadUrl(dto);
  }

  @Post("operation/banners/upload-url")
  createOperationBannerUploadUrl(@Body() dto: CreateTemplateCoverUploadUrlDto) {
    return this.templateIngest.createOperationBannerUploadUrl(dto);
  }

  @Get("operation/home-banners")
  getHomeBanners() {
    return this.templateIngest.getHomeBanners();
  }

  @Put("operation/home-banners")
  updateHomeBanners(@Body() dto: Record<string, unknown>) {
    return this.templateIngest.updateHomeBanners(dto);
  }

  @Get("pricing/settings")
  getPricingSettings() {
    return this.templateIngest.getPricingSettings();
  }

  @Put("pricing/settings")
  updatePricingSettings(@Body() dto: UpdateTemplateIngestPricingDto) {
    return this.templateIngest.updatePricingSettings(dto.global_pricing_multiplier);
  }

  @Get("templates")
  listTemplates(
    @Query("page") page?: string,
    @Query("page_size") pageSize?: string,
    @Query("q") q?: string,
    @Query("category") category?: string,
    @Query("status") status?: string,
  ) {
    return this.templateIngest.listTemplates({ page, page_size: pageSize, q, category, status });
  }

  @Post("templates")
  createTemplate(@Body() dto: CreateTemplateIngestDto) {
    return this.templateIngest.createTemplate(dto);
  }

  @Post("templates/reorder")
  reorderTemplates(@Body() dto: TemplateIngestReorderDto) {
    return this.templateIngest.reorderTemplates(dto.items);
  }

  @Get("templates/:id")
  getTemplate(@Param("id") id: string) {
    return this.templateIngest.getTemplate(id);
  }

  @Patch("templates/:id")
  updateTemplate(@Param("id") id: string, @Body() dto: UpdateTemplateIngestDto) {
    return this.templateIngest.updateTemplate(id, dto);
  }

  @Delete("templates/:id")
  removeTemplate(@Param("id") id: string, @Query("confirm_name") confirmName?: string) {
    return this.templateIngest.removeTemplate(id, confirmName);
  }
}
