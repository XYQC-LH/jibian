import { IsIn, IsOptional } from "class-validator";

const templateCoverContentTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export class CreateTemplateCoverUploadUrlDto {
  @IsOptional()
  @IsIn(templateCoverContentTypes)
  content_type?: (typeof templateCoverContentTypes)[number];
}
