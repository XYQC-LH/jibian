import { Controller, Get, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import * as os from "os";

@Controller("v1/admin/system-monitor")
@UseGuards(AdminGuard)
export class AdminMonitorController {
  @Get()
  snapshot() {
    return { success: true, data: this.buildSnapshot() };
  }

  // 趋势接口返回扁平趋势点（cpu_usage 等），与前端 toMonitorTrendPointFromHistory 契约一致
  @Get("history")
  history() {
    const now = Date.now();
    return {
      success: true,
      data: {
        history: [this.buildTrendPoint(now - 3600_000), this.buildTrendPoint(now)],
      },
    };
  }

  @Get("recent")
  recent() {
    const now = Date.now();
    return {
      success: true,
      data: {
        points: [this.buildTrendPoint(now - 60_000), this.buildTrendPoint(now)],
      },
    };
  }

  private buildSnapshot() {
    const now = new Date();
    const cpus = os.cpus();
    const cores = cpus.length || 1;
    const [load1, load5, load15] = os.loadavg();
    const totalGb = os.totalmem() / 1024 ** 3;
    const availableGb = os.freemem() / 1024 ** 3;
    const usedGb = totalGb - availableGb;

    return {
      timestamp: now.toISOString(),
      cpu: {
        usage_percent: Math.min(100, Math.max(0, Math.round((load1 / cores) * 100))),
        count: cores,
        frequency_mhz: cpus[0]?.speed ?? null,
        load_average: { "1min": load1, "5min": load5, "15min": load15 },
      },
      memory: {
        total_gb: this.round2(totalGb),
        available_gb: this.round2(availableGb),
        used_gb: this.round2(usedGb),
        usage_percent: totalGb > 0 ? Math.round((usedGb / totalGb) * 100) : 0,
        buffers_gb: null,
        cached_gb: null,
      },
      // 磁盘/网络/进程细粒度采集未接入，暂以 0 占位
      disk: {
        total_gb: 0,
        used_gb: 0,
        free_gb: 0,
        usage_percent: 0,
        read_bytes_mb: 0,
        write_bytes_mb: 0,
        read_count: 0,
        write_count: 0,
      },
      network: {
        bytes_sent_mb: 0,
        bytes_recv_mb: 0,
        packets_sent: 0,
        packets_recv: 0,
        active_connections: 0,
        total_connections: 0,
        interfaces: {},
      },
      processes: {
        total_count: 0,
        current_process_cpu: 0,
        current_process_memory_mb: 0,
        current_process_memory_percent: 0,
      },
      system: {
        boot_time: new Date(Date.now() - os.uptime() * 1000).toISOString(),
        uptime_hours: Math.round(os.uptime() / 3600),
        db_connections: 0,
      },
      containers: {
        available: false,
        error: "容器监控尚未接入",
        service_settings: {},
        items: [],
      },
    };
  }

  private buildTrendPoint(timestamp: number) {
    return {
      cpu_usage: 0,
      memory_usage: 0,
      disk_usage: 0,
      active_connections: 0,
      queue_size: 0,
      database_connections: 0,
      timestamp: new Date(timestamp).toISOString(),
    };
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
