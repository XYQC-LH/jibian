import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateTemplateIngestDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(64)
  category!: string;

  @IsUUID()
  cover_asset_id!: string;

  @IsString()
  prompt!: string;

  @IsInt()
  @Min(0)
  price_credits!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  result_count?: number;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  external_id?: string;
}
