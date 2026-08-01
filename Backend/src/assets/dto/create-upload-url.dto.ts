import { IsIn } from "class-validator";

const assetTypes = ["input_image", "generated_image", "template_cover"] as const;

export class CreateUploadUrlDto {
  @IsIn(assetTypes)
  asset_type!: (typeof assetTypes)[number];
}
