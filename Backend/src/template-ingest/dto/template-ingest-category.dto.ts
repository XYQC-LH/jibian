import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTemplateIngestCategoryDto {
  @IsString()
  @MaxLength(32)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;
}

export class UpdateTemplateIngestCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;
}
