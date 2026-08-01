import { Module } from "@nestjs/common";
import { AssetUrlService } from "./asset-url.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  controllers: [AssetsController],
  providers: [AssetUrlService, AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
