import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreateTemplateDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(64)
  category!: string;

  @IsOptional()
  @IsUUID()
  cover_asset_id?: string;

  @IsString()
  prompt!: string;

  @IsInt()
  @Min(0)
  price_credits!: number;

  @IsInt()
  @Min(1)
  result_count!: number;

  @IsInt()
  sort_order!: number;

  @IsString()
  @MaxLength(32)
  status!: string;
}
