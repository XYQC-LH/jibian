import { Controller, Get, Query } from "@nestjs/common";
import { AdminStatisticsService } from "./admin-statistics.service";

@Controller("v1/admin")
export class AdminStatisticsController {
  constructor(private readonly statistics: AdminStatisticsService) {}

  @Get("statistics")
  getStatistics(@Query("days") days = "30") {
    return this.statistics.getStatistics(Number(days));
  }

  @Get("finance/dashboard")
  getFinanceDashboard(@Query("days") days = "30") {
    return this.statistics.getFinanceDashboard(Number(days));
  }
}
