import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { UserCreationsController } from "./user-creations.controller";
import { UserCreationsService } from "./user-creations.service";

@Module({
  imports: [AssetsModule],
  controllers: [UserCreationsController],
  providers: [UserCreationsService],
})
export class UserCreationsModule {}
