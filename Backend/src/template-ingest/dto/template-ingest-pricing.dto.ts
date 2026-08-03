import { IsNumber, Min } from "class-validator";

export class UpdateTemplateIngestPricingDto {
  @IsNumber()
  @Min(0.01)
  global_pricing_multiplier!: number;
}
