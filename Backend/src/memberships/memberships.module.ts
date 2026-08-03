import { BullModule } from "@nestjs/bullmq";
import { Module, Provider } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { AdminMembershipsController } from "./admin-memberships.controller";
import { MembershipsController } from "./memberships.controller";
import { MembershipsProcessor } from "./memberships.processor";
import { MembershipsService } from "./memberships.service";

const providers: Provider[] = [
  MembershipsService,
  ...(process.env.WORKER_ENABLED === "false" ? [] : [MembershipsProcessor]),
];

@Module({
  imports: [BullModule.registerQueue({ name: "membership-renewal" }), PaymentsModule],
  controllers: [MembershipsController, AdminMembershipsController],
  providers,
  exports: [MembershipsService],
})
export class MembershipsModule {}
