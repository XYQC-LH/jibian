import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export const generateRatios = ["auto", "1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export type GenerateRatio = (typeof generateRatios)[number];

export class CreateTaskDto {
  @IsString()
  template_id!: string;

  @IsUUID()
  input_asset_id!: string;

  @IsOptional()
  @IsIn(generateRatios)
  ratio?: GenerateRatio;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotency_key?: string;
}
