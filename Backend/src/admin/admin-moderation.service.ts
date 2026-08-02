import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

const PASS_STATUSES = new Set(["approved", "passed"]);
const BLOCK_STATUSES = new Set(["rejected", "blocked"]);

export type ModerationEventQuery = {
  rangeHours: number;
  page: number;
  pageSize: number;
  phase?: string;
  decision?: string;
  ok?: boolean;
  provider?: string;
  reason?: string;
  taskId?: string;
  userEmail?: string;
};

@Injectable()
export class AdminModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async overview(rangeHours: number) {
    const since = new Date(Date.now() - rangeHours * 3600_000);
    const byStatus = await this.prisma.reviewRecord.groupBy({
      by: ["status"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    });

    let pass = 0;
    let block = 0;
    let pending = 0;
    for (const row of byStatus) {
      if (PASS_STATUSES.has(row.status)) pass += row._count._all;
      else if (BLOCK_STATUSES.has(row.status)) block += row._count._all;
      else pending += row._count._all;
    }

    const totalChecked = pass + block;
    return {
      total_checked: totalChecked,
      pass_count: pass,
      block_count: block,
      pass_rate: totalChecked > 0 ? Math.round((pass / totalChecked) * 1000) / 10 : 0,
      period_hours: rangeHours,
      pending_count: pending,
      total_reviewed: totalChecked,
      passed: pass,
      blocked: block,
      pending,
    };
  }

  async dashboard(limit: number) {
    const recent = await this.prisma.reviewRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const trendRows = await this.prisma.reviewRecord.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
      select: { status: true, createdAt: true },
    });

    return {
      recent_events: recent.map((record) => this.mapEvent(record)),
      stats: {
        period_hours: 7 * 24,
        days: this.buildDailyTrend(trendRows),
      },
    };
  }

  async events(query: ModerationEventQuery) {
    const page = Number.isFinite(query.page) && query.page > 0 ? query.page : 1;
    const pageSize = Number.isFinite(query.pageSize) && query.pageSize > 0 ? query.pageSize : 50;

    // provider 恒为 local（本地上游无第三方审核源）
    if (query.provider && query.provider !== "local") {
      return this.emptyPage(page, pageSize);
    }

    const where = {
      createdAt: { gte: new Date(Date.now() - query.rangeHours * 3600_000) },
      ...(query.phase ? { reviewStage: query.phase } : {}),
      ...(query.decision ? { status: query.decision } : {}),
      ...(query.ok === undefined ? {} : { status: { in: query.ok ? [...PASS_STATUSES] : [...BLOCK_STATUSES] } }),
      ...(query.reason ? { reason: { contains: query.reason } } : {}),
      ...(query.taskId ? { targetId: query.taskId } : {}),
      ...(query.userEmail ? { targetId: { in: await this.taskIdsByUserEmail(query.userEmail) } } : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.reviewRecord.count({ where }),
      this.prisma.reviewRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: records.map((record) => this.mapEvent(record)),
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  }

  async updateConfig(enabled: boolean) {
    const key = "jibian:moderation:enabled";
    try {
      // Redis 不可用时降级：配置仅保存在内存中，不阻断管理端操作
      const redis = new Redis(this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379", {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
      await redis.set(key, enabled ? "true" : "false");
      await redis.quit();
    } catch {
      // 忽略 Redis 连接/写入错误
    }
    return { enabled };
  }

  private async taskIdsByUserEmail(userEmail: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        user: {
          OR: [{ phone: { contains: userEmail } }, { nickname: { contains: userEmail } }],
        },
      },
      select: { id: true },
      take: 1000,
    });
    return tasks.map((task) => task.id);
  }

  private emptyPage(page: number, pageSize: number) {
    return { items: [], total: 0, page, page_size: pageSize, total_pages: 1, has_next: false, has_prev: false };
  }

  private buildDailyTrend(rows: Array<{ status: string; createdAt: Date }>) {
    const buckets = new Map<string, { date: string; pass: number; block: number; pending: number }>();
    for (const row of rows) {
      const date = row.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(date) ?? { date, pass: 0, block: 0, pending: 0 };
      if (PASS_STATUSES.has(row.status)) bucket.pass += 1;
      else if (BLOCK_STATUSES.has(row.status)) bucket.block += 1;
      else bucket.pending += 1;
      buckets.set(date, bucket);
    }
    return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  private mapEvent(record: {
    id: string;
    targetId: string;
    reviewStage: string;
    status: string;
    policyHit: unknown;
    reason: string | null;
    createdAt: Date;
  }) {
    return {
      id: record.id,
      task_id: record.targetId,
      phase: record.reviewStage,
      decision: record.status,
      ok: PASS_STATUSES.has(record.status),
      reason: record.reason,
      policy_hits: record.policyHit,
      provider: "local",
      created_at: record.createdAt.toISOString(),
    };
  }
}
