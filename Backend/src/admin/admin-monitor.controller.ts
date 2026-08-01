import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";

@Controller("v1/admin/system-monitor")
@UseGuards(AdminGuard)
export class AdminMonitorController {
  @Get()
  snapshot() {
    return { success: true, data: this.buildSnapshot() };
  }

  @Get("history")
  history() {
    return { success: true, data: [this.buildSnapshot()] };
  }

  @Get("recent")
  recent() {
    return { success: true, data: [this.buildSnapshot()] };
  }

  private buildSnapshot() {
    return {
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      active_connections: 0,
      queue_size: 0,
      database_connections: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
