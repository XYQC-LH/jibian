import { BullModule } from "@nestjs/bullmq";
import { Module, Provider } from "@nestjs/common";
import { AssetsModule } from "../assets/assets.module";
import { GenerationModule } from "../generation/generation.module";
import { ModerationModule } from "../moderation/content-moderation.module";
import { PricingModule } from "../pricing/pricing.module";
import { TasksController } from "./tasks.controller";
import { TasksProcessor } from "./tasks.processor";
import { TasksService } from "./tasks.service";

const providers: Provider[] = [
  TasksService,
  ...(process.env.WORKER_ENABLED === "false" ? [] : [TasksProcessor]),
];

@Module({
  imports: [BullModule.registerQueue({ name: "generation" }), AssetsModule, GenerationModule, ModerationModule, PricingModule],
  controllers: [TasksController],
  providers,
  exports: [TasksService],
})
export class TasksModule {}
