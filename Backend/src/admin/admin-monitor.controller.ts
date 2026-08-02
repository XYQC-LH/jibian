import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { AdminGuard } from "../auth/admin.guard";
import * as os from "os";
import { readFile, statfs } from "node:fs/promises";
import { PrismaService } from "../prisma/prisma.service";

type ResourceBody = {
  service?: unknown;
  memory_limit_mb?: unknown;
  worker_concurrency?: unknown;
};

@Controller("v1/admin/system-monitor")
@UseGuards(AdminGuard)
export class AdminMonitorController {
  constructor(
    @InjectQueue("generation") private readonly generationQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async snapshot() {
    return { success: true, data: await this.buildSnapshot() };
  }

  // 趋势接口返回扁平趋势点（cpu_usage 等）数组，与前端 SystemMonitorSnapshot[]/toMonitorTrendPointFromHistory 契约一致
  @Get("history")
  async history() {
    const now = Date.now();
    const snapshot = await this.buildSnapshot();
    return {
      success: true,
      data: [this.buildTrendPoint(now - 3600_000, snapshot), this.buildTrendPoint(now, snapshot)],
    };
  }

  @Get("recent")
  async recent() {
    const now = Date.now();
    const snapshot = await this.buildSnapshot();
    return {
      success: true,
      data: [this.buildTrendPoint(now - 60_000, snapshot), this.buildTrendPoint(now, snapshot)],
    };
  }

  @Get("containers")
  async containers() {
    const snapshot = await this.buildSnapshot();
    return { success: true, data: snapshot.containers.items };
  }

  @Post("containers/memory-limit")
  async updateMemoryLimit(@Body() body: ResourceBody) {
    const service = this.requireService(body.service);
    const memoryLimitMb = this.requirePositiveNumber(body.memory_limit_mb, "memory_limit_mb");
    return {
      success: true,
      data: {
        ...this.buildContainerBase(service),
        memory: { limit_mb: memoryLimitMb, unit: "MB" },
        memory_limit_mb: memoryLimitMb,
        note: "需在部署层（docker-compose）调整",
        snapshot: await this.buildSnapshot(),
      },
    };
  }

  @Post("containers/worker-concurrency")
  async updateWorkerConcurrency(@Body() body: ResourceBody) {
    const service = this.requireService(body.service);
    const workerConcurrency = this.requirePositiveNumber(body.worker_concurrency, "worker_concurrency");
    await this.generationQueue.setGlobalConcurrency(workerConcurrency);
    await this.prisma.setting.upsert({
      where: { key: "system.max_concurrent_tasks" },
      update: { value: String(workerConcurrency) },
      create: { key: "system.max_concurrent_tasks", value: String(workerConcurrency) },
    });
    return {
      success: true,
      data: {
        ...this.buildContainerBase(service),
        memory: { worker_concurrency: workerConcurrency },
        worker_concurrency: workerConcurrency,
        note: "已写入 BullMQ 全局并发",
        snapshot: await this.buildSnapshot(),
      },
    };
  }

  private buildContainerBase(service: string) {
    return {
      service,
      name: service,
      status: "running" as const,
      cpu_percent: 0,
      uptime: "-",
      restart_count: 0,
    };
  }

  private requireService(value: unknown) {
    const service = String(value ?? "").trim();
    if (!service) {
      throw new BadRequestException("service 不能为空");
    }
    return service;
  }

  private requirePositiveNumber(value: unknown, field: string) {
    const parsed = Math.round(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${field} 必须是大于 0 的数值`);
    }
    return parsed;
  }

  private async buildSnapshot() {
    const now = new Date();
    const cpus = os.cpus();
    const cores = cpus.length || 1;
    const [load1, load5, load15] = os.loadavg();
    const totalGb = os.totalmem() / 1024 ** 3;
    const availableGb = os.freemem() / 1024 ** 3;
    const usedGb = totalGb - availableGb;
    const processMemory = process.memoryUsage();
    const currentProcessMemoryMb = processMemory.rss / 1024 ** 2;
    const activeHandles = (process as unknown as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.().length ?? 0;
    const [disk, network, memoryCache, queueSize, dbConnections, workerConcurrency] = await Promise.all([
      this.readDiskUsage(),
      this.readNetworkUsage(),
      this.readLinuxMemoryCache(),
      this.readQueueSize(),
      this.readDbConnections(),
      this.readWorkerConcurrency(),
    ]);
    const currentProcessCpu = this.readCurrentProcessCpuPercent(cores);
    const containerItems = [{
      service: "backend",
      container_name: os.hostname(),
      name: os.hostname(),
      status: "running" as const,
      cpu_percent: Math.min(100, Math.max(0, Math.round((load1 / cores) * 100))),
      memory_used_mb: this.round2(currentProcessMemoryMb),
      memory_limit_mb: this.round2(totalGb * 1024),
      memory_percent: totalGb > 0 ? this.round2((currentProcessMemoryMb / 1024 / totalGb) * 100) : 0,
      pids: 1,
      uptime: `${Math.round(process.uptime())}s`,
      restart_count: 0,
      worker_service: true,
      configured_worker_concurrency: workerConcurrency,
    }];

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
        buffers_gb: memoryCache.buffersGb,
        cached_gb: memoryCache.cachedGb,
      },
      disk: {
        total_gb: disk.totalGb,
        used_gb: disk.usedGb,
        free_gb: disk.freeGb,
        usage_percent: disk.usagePercent,
        read_bytes_mb: disk.readBytesMb,
        write_bytes_mb: disk.writeBytesMb,
        read_count: disk.readCount,
        write_count: disk.writeCount,
      },
      network: {
        bytes_sent_mb: network.bytesSentMb,
        bytes_recv_mb: network.bytesRecvMb,
        packets_sent: network.packetsSent,
        packets_recv: network.packetsRecv,
        active_connections: network.activeConnections,
        total_connections: network.totalConnections,
        interfaces: network.interfaces,
      },
      processes: {
        total_count: activeHandles,
        current_process_cpu: currentProcessCpu,
        current_process_memory_mb: this.round2(currentProcessMemoryMb),
        current_process_memory_percent: totalGb > 0 ? this.round2((currentProcessMemoryMb / 1024 / totalGb) * 100) : 0,
      },
      system: {
        boot_time: new Date(Date.now() - os.uptime() * 1000).toISOString(),
        uptime_hours: this.round2(os.uptime() / 3600),
        db_connections: dbConnections,
      },
      containers: {
        source: "process",
        available: true,
        error: null,
        sampled_at: now.toISOString(),
        queue_size: queueSize,
        service_settings: {
          backend: {
            ...(workerConcurrency ? { worker_concurrency: workerConcurrency } : {}),
          },
        },
        items: containerItems,
      },
    };
  }

  private buildTrendPoint(timestamp: number, snapshot: Awaited<ReturnType<AdminMonitorController["buildSnapshot"]>>) {
    return {
      cpu_usage: snapshot.cpu.usage_percent,
      memory_usage: snapshot.memory.usage_percent,
      disk_usage: snapshot.disk.usage_percent,
      active_connections: snapshot.network.active_connections,
      queue_size: snapshot.containers.queue_size,
      database_connections: snapshot.system.db_connections,
      timestamp: new Date(timestamp).toISOString(),
    };
  }

  private async readQueueSize() {
    try {
      const counts = await this.generationQueue.getJobCounts("waiting", "delayed", "active", "paused");
      return Object.values(counts).reduce((sum, value) => sum + value, 0);
    } catch {
      return 0;
    }
  }

  private async readWorkerConcurrency() {
    try {
      return await this.generationQueue.getGlobalConcurrency();
    } catch {
      return null;
    }
  }

  private async readDbConnections() {
    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ count: number | bigint | string }>>(
        "select count(*)::int as count from pg_stat_activity",
      );
      return Number(rows[0]?.count ?? 0);
    } catch {
      return 0;
    }
  }

  private async readDiskUsage() {
    try {
      const [stats, io] = await Promise.all([
        statfs(process.cwd()),
        this.readLinuxDiskIo(),
      ]);
      const totalGb = Number(stats.blocks * stats.bsize) / 1024 ** 3;
      const freeGb = Number(stats.bavail * stats.bsize) / 1024 ** 3;
      const usedGb = Math.max(totalGb - freeGb, 0);
      return {
        totalGb: this.round2(totalGb),
        usedGb: this.round2(usedGb),
        freeGb: this.round2(freeGb),
        usagePercent: totalGb > 0 ? this.round2((usedGb / totalGb) * 100) : 0,
        ...io,
      };
    } catch {
      return {
        totalGb: 0,
        usedGb: 0,
        freeGb: 0,
        usagePercent: 0,
        readBytesMb: 0,
        writeBytesMb: 0,
        readCount: 0,
        writeCount: 0,
      };
    }
  }

  private async readLinuxDiskIo() {
    try {
      const content = await readFile("/proc/diskstats", "utf8");
      let readCount = 0;
      let writeCount = 0;
      let readSectors = 0;
      let writeSectors = 0;
      for (const line of content.split(/\r?\n/)) {
        const columns = line.trim().split(/\s+/);
        if (columns.length < 14) continue;
        const device = columns[2];
        if (!device || /^(loop|ram|fd|sr)/.test(device)) continue;
        readCount += Number(columns[3]) || 0;
        readSectors += Number(columns[5]) || 0;
        writeCount += Number(columns[7]) || 0;
        writeSectors += Number(columns[9]) || 0;
      }
      return {
        readBytesMb: this.round2((readSectors * 512) / 1024 ** 2),
        writeBytesMb: this.round2((writeSectors * 512) / 1024 ** 2),
        readCount,
        writeCount,
      };
    } catch {
      return { readBytesMb: 0, writeBytesMb: 0, readCount: 0, writeCount: 0 };
    }
  }

  private async readNetworkUsage() {
    const [dev, connections] = await Promise.all([
      this.readLinuxNetworkCounters(),
      this.readLinuxTcpConnections(),
    ]);

    return {
      ...dev,
      ...connections,
      interfaces: this.readNetworkInterfaces(),
    };
  }

  private readNetworkInterfaces() {
    const interfaces: Record<string, { is_up: boolean; speed: number; mtu: number }> = {};
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
      interfaces[name] = {
        is_up: Boolean(addresses?.length),
        speed: 0,
        mtu: 0,
      };
    }
    return interfaces;
  }

  private async readLinuxNetworkCounters() {
    try {
      const content = await readFile("/proc/net/dev", "utf8");
      let bytesRecv = 0;
      let packetsRecv = 0;
      let bytesSent = 0;
      let packetsSent = 0;
      for (const line of content.split(/\r?\n/).slice(2)) {
        const normalized = line.trim();
        if (!normalized || normalized.startsWith("lo:")) continue;
        const [, rawCounters] = normalized.split(":");
        const counters = rawCounters?.trim().split(/\s+/).map(Number) ?? [];
        bytesRecv += counters[0] || 0;
        packetsRecv += counters[1] || 0;
        bytesSent += counters[8] || 0;
        packetsSent += counters[9] || 0;
      }
      return {
        bytesSentMb: this.round2(bytesSent / 1024 ** 2),
        bytesRecvMb: this.round2(bytesRecv / 1024 ** 2),
        packetsSent,
        packetsRecv,
      };
    } catch {
      return { bytesSentMb: 0, bytesRecvMb: 0, packetsSent: 0, packetsRecv: 0 };
    }
  }

  private async readLinuxTcpConnections() {
    const files = ["/proc/net/tcp", "/proc/net/tcp6"];
    let activeConnections = 0;
    let totalConnections = 0;
    for (const file of files) {
      try {
        const content = await readFile(file, "utf8");
        for (const line of content.split(/\r?\n/).slice(1)) {
          const columns = line.trim().split(/\s+/);
          const state = columns[3];
          if (!state) continue;
          totalConnections += 1;
          if (state === "01") {
            activeConnections += 1;
          }
        }
      } catch {
        // 非 Linux 环境或权限不足时保留已读取结果。
      }
    }
    return { activeConnections, totalConnections };
  }

  private async readLinuxMemoryCache() {
    try {
      const content = await readFile("/proc/meminfo", "utf8");
      const values = new Map<string, number>();
      for (const line of content.split(/\r?\n/)) {
        const match = /^(\w+):\s+(\d+)\s+kB/.exec(line);
        if (match) {
          values.set(match[1], Number(match[2]) / 1024 ** 2);
        }
      }
      return {
        buffersGb: this.nullableRound2(values.get("Buffers")),
        cachedGb: this.nullableRound2((values.get("Cached") ?? 0) + (values.get("SReclaimable") ?? 0)),
      };
    } catch {
      return { buffersGb: null, cachedGb: null };
    }
  }

  private readCurrentProcessCpuPercent(cores: number) {
    const usage = process.cpuUsage();
    const totalCpuSeconds = (usage.user + usage.system) / 1_000_000;
    const elapsedCapacitySeconds = Math.max(process.uptime() * cores, 1);
    return this.round2(Math.min(100, Math.max(0, (totalCpuSeconds / elapsedCapacitySeconds) * 100)));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private nullableRound2(value: number | undefined) {
    if (value === undefined || !Number.isFinite(value)) {
      return null;
    }
    return this.round2(value);
  }
}
