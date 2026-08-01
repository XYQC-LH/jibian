import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @IsOptional()
  @IsUUID()
  cover_asset_id?: string;

  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price_credits?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  result_count?: number;

  @IsOptional()
  @IsInt()
  sort_order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  status?: string;
}
