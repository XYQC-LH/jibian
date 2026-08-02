import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { PricingModule } from "../pricing/pricing.module";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";

@Module({
  imports: [AssetsModule, PricingModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
