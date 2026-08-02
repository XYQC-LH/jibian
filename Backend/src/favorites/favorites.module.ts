import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { PricingModule } from "../pricing/pricing.module";
import { FavoritesController } from "./favorites.controller";
import { FavoritesService } from "./favorites.service";

@Module({
  imports: [AssetsModule, PricingModule],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
