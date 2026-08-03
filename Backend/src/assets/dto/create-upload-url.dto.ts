import { IsIn, IsOptional, IsString } from "class-validator";

const assetTypes = ["input_image", "generated_image", "template_cover", "operation_banner"] as const;

export class CreateUploadUrlDto {
  @IsIn(assetTypes)
  asset_type!: (typeof assetTypes)[number];

  @IsOptional()
  @IsString()
  content_type?: string;
}
