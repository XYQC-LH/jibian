import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminStatisticsService } from "./admin-statistics.service";

@Controller("v1/admin")
@UseGuards(AdminGuard)
export class AdminStatisticsController {
  constructor(private readonly statistics: AdminStatisticsService) {}

  @Get("statistics")
  async getStatistics(@Query("days") days = "30") {
    return { success: true, data: await this.statistics.getStatistics(Number(days)) };
  }

  @Get("finance/dashboard")
  getFinanceDashboard(@Query("days") days = "30") {
    return this.statistics.getFinanceDashboard(Number(days));
  }
}
