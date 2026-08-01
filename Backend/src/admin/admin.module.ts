import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { AssetsModule } from "../assets/assets.module";
import { GenerationModule } from "../generation/generation.module";
import { TemplatesModule } from "../templates/templates.module";
import { AdminAssetsController } from "./admin-assets.controller";
import { AdminDispatchController, AdminModelManagementController } from "./admin-dispatch.controller";
import { AdminDispatchService } from "./admin-dispatch.service";
import { AdminFinanceController } from "./admin-finance.controller";
import { AdminFinanceService } from "./admin-finance.service";
import { AdminMonitorController } from "./admin-monitor.controller";
import { AdminStatisticsController } from "./admin-statistics.controller";
import { AdminStatisticsService } from "./admin-statistics.service";
import { AdminTemplatesController } from "./admin-templates.controller";
import { AdminTemplatesService } from "./admin-templates.service";
import { AdminTasksController } from "./admin-tasks.controller";
import { AdminTasksService } from "./admin-tasks.service";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";

@Module({
  imports: [AdminAuthModule, TemplatesModule, AssetsModule, GenerationModule],
  controllers: [
    AdminAssetsController,
    AdminTasksController,
    AdminTemplatesController,
    AdminStatisticsController,
    AdminUsersController,
    AdminMonitorController,
    AdminFinanceController,
    AdminDispatchController,
    AdminModelManagementController,
  ],
  providers: [
    AdminTasksService,
    AdminStatisticsService,
    AdminUsersService,
    AdminFinanceService,
    AdminTemplatesService,
    AdminDispatchService,
  ],
})
export class AdminModule {}
