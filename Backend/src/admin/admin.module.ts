import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../auth/admin-auth.module";
import { AssetsModule } from "../assets/assets.module";
import { GenerationModule } from "../generation/generation.module";
import { TemplatesModule } from "../templates/templates.module";
import { HealthController } from "../health.controller";
import { AdminAssetsController } from "./admin-assets.controller";
import { AdminDispatchController } from "./admin-dispatch.controller";
import { AdminDispatchService } from "./admin-dispatch.service";
import { AdminFinanceController } from "./admin-finance.controller";
import { AdminFinanceService } from "./admin-finance.service";
import { AdminModerationController } from "./admin-moderation.controller";
import { AdminModerationService } from "./admin-moderation.service";
import { AdminMonitorController } from "./admin-monitor.controller";
import { AdminOrdersController, AdminRedemptionStatsController } from "./admin-orders.controller";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminSettingsController } from "./admin-settings.controller";
import { AdminSettingsService } from "./admin-settings.service";
import { AdminStatisticsController } from "./admin-statistics.controller";
import { AdminStatisticsService } from "./admin-statistics.service";
import { AdminTemplatesController } from "./admin-templates.controller";
import { AdminTemplatesService } from "./admin-templates.service";
import { AdminTasksController } from "./admin-tasks.controller";
import { AdminTasksService } from "./admin-tasks.service";
import { AdminUploadController } from "./admin-upload.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { ModelManagementController } from "./model-management.controller";
import { ModelManagementService } from "./model-management.service";

@Module({
  imports: [AdminAuthModule, TemplatesModule, AssetsModule, GenerationModule],
  controllers: [
    HealthController,
    AdminAssetsController,
    AdminTasksController,
    AdminTemplatesController,
    AdminStatisticsController,
    AdminUsersController,
    AdminMonitorController,
    AdminFinanceController,
    AdminDispatchController,
    AdminSettingsController,
    AdminOrdersController,
    AdminRedemptionStatsController,
    AdminModerationController,
    AdminUploadController,
    ModelManagementController,
  ],
  providers: [
    AdminTasksService,
    AdminStatisticsService,
    AdminUsersService,
    AdminFinanceService,
    AdminTemplatesService,
    AdminDispatchService,
    AdminSettingsService,
    AdminOrdersService,
    AdminModerationService,
    ModelManagementService,
  ],
})
export class AdminModule {}
