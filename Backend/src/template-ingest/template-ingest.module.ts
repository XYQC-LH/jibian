import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { OperationModule } from "../operation/operation.module";
import { PricingModule } from "../pricing/pricing.module";
import { TemplateIngestController } from "./template-ingest.controller";
import { TemplateIngestGuard } from "./template-ingest.guard";
import { TemplateIngestService } from "./template-ingest.service";

@Module({
  imports: [AssetsModule, OperationModule, PricingModule],
  controllers: [TemplateIngestController],
  providers: [TemplateIngestGuard, TemplateIngestService],
})
export class TemplateIngestModule {}
