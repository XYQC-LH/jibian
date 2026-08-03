import { Type } from "class-transformer";
import { IsArray, IsInt, IsString, ValidateNested } from "class-validator";

export class TemplateIngestReorderItemDto {
  @IsString()
  id!: string;

  @IsInt()
  order!: number;
}

export class TemplateIngestReorderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateIngestReorderItemDto)
  items!: TemplateIngestReorderItemDto[];
}
