import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { GenerationModule } from "../generation/generation.module";
import { ModerationModule } from "../moderation/content-moderation.module";
import { TasksController } from "./tasks.controller";
import { TasksProcessor } from "./tasks.processor";
import { TasksService } from "./tasks.service";

@Module({
  imports: [BullModule.registerQueue({ name: "generation" }), AssetsModule, GenerationModule, ModerationModule],
  controllers: [TasksController],
  providers: [TasksService, TasksProcessor],
  exports: [TasksService],
})
export class TasksModule {}
