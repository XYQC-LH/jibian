import { Module } from "@nestjs/common";
import { AssetDownloadController } from "./asset-download.controller";
import { AssetUrlService } from "./asset-url.service";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  controllers: [AssetsController, AssetDownloadController],
  providers: [AssetUrlService, AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
