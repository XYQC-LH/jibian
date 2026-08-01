import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminStatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatistics(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [usersTotal, usersToday, taskStats, creditSum] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: this.startOfToday() } } }),
      this.prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.creditLedger.aggregate({
        where: { type: "charge", createdAt: { gte: since } },
        _sum: { amount: true },
      }),
    ]);

    const taskCounts = Object.fromEntries(taskStats.map((item) => [item.status, item._count._all]));
    const totalTasks = Object.values(taskCounts).reduce((sum, value) => sum + value, 0);
    const completed = taskCounts.succeeded ?? 0;
    const failed = taskCounts.failed ?? 0;
    const generating = taskCounts.running ?? 0;

    return {
      users: {
        total: usersTotal,
        active: usersTotal,
        recent_active: usersTotal,
        today_registrations: usersToday,
        new: usersToday,
      },
      tasks: {
        total: totalTasks,
        completed,
        failed,
        generating,
        pending: 0,
      },
      credits: {
        total_earned: Math.abs(creditSum._sum.amount ?? 0),
        monthly_earned: Math.abs(creditSum._sum.amount ?? 0),
        daily_spent: 0,
        total_balance: 0,
      },
      transactions: {
        total: 0,
        completed: 0,
        failed: 0,
        pending: 0,
        average_value: 0,
        conversion_rate: 0,
      },
      trends: [],
      models: {},
      payment_methods: {},
      performance: {
        avg_response_time: 0,
        system_uptime: 100,
        queue_size: 0,
        cpu_usage: 0,
        memory_usage: 0,
      },
    };
  }

  async getFinanceDashboard(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.creditLedger.aggregate({
      where: { type: "charge", createdAt: { gte: since } },
      _sum: { amount: true },
      _count: { _all: true },
    });

    return {
      success: true,
      data: {
        summary: {
          total_revenue: Math.abs(result._sum.amount ?? 0),
          total_orders: result._count._all,
        },
      },
    };
  }

  private startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
}
