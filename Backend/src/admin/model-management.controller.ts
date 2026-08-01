import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AdminGuard } from "../auth/admin.guard";
import { ModelManagementService } from "./model-management.service";

class UpdateModelDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsUUID()
  cover_asset_id?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  prompt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  credits_cost?: number;

  @IsOptional()
  @IsInt()
  order?: number | null;

  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @IsOptional()
  @IsString()
  status?: string | null;
}

class ReorderItemDto {
  // 允许 slug（如 pearl-portrait）或 UUID，service 内部转成 uuid 再查询
  @IsString()
  model_id!: string;

  @IsInt()
  order!: number;
}

class ReorderModelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

class UpdatePricingSettingsDto {
  @IsNumber()
  global_pricing_multiplier!: number;
}

@Controller("v1/model-management")
@UseGuards(AdminGuard)
export class ModelManagementController {
  constructor(private readonly models: ModelManagementService) {}

  @Get("models")
  listModels(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("q") q?: string,
    @Query("model_types") modelTypes?: string,
    @Query("skip_pricing") skipPricing?: string,
  ) {
    return this.models.list({
      page: Number(page),
      pageSize: Number(pageSize),
      q,
      modelTypes: modelTypes ? modelTypes.split(",") : [],
      skipPricing: skipPricing === "true",
    });
  }

  @Put("models/:modelId")
  updateModel(@Param("modelId") modelId: string, @Body() dto: UpdateModelDto) {
    return this.models.update(modelId, dto);
  }

  @Post("models/reorder")
  reorderModels(@Body() dto: ReorderModelsDto) {
    return this.models.reorder(dto.items);
  }

  @Get("pricing/settings")
  getPricingSettings() {
    return this.models.getPricingSettings();
  }

  @Put("pricing/settings")
  updatePricingSettings(@Body() dto: UpdatePricingSettingsDto) {
    return this.models.updatePricingSettings(dto.global_pricing_multiplier);
  }

  @Get("models/:modelId/pricing")
  getModelPricing(@Param("modelId") modelId: string) {
    return this.models.getModelPricing(modelId);
  }

  @Get("pricing/observations")
  getPricingObservations() {
    return this.models.getPricingObservations();
  }
}
