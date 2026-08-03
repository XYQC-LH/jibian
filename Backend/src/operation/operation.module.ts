import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { OperationController } from "./operation.controller";
import { OperationService } from "./operation.service";

@Module({
  imports: [AssetsModule],
  controllers: [OperationController],
  providers: [OperationService],
  exports: [OperationService],
})
export class OperationModule {}
