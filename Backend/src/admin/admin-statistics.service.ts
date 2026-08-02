import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Queue } from "bullmq";
import * as os from "os";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminStatisticsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("generation") private readonly generationQueue: Queue,
  ) {}

  async getStatistics(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const today = this.startOfToday();
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [
      usersTotal,
      activeUsers,
      usersToday,
      usersSince,
      tasks,
      creditRows,
      totalBalance,
      paymentOrders,
      templateRows,
      queueSize,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: "active" } }),
      this.prisma.user.count({ where: { createdAt: { gte: today } } }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, createdAt: true },
      }),
      this.prisma.task.findMany({
        where: { createdAt: { gte: since }, adminDeletedAt: null },
        select: {
          id: true,
          userId: true,
          templateId: true,
          status: true,
          creditCost: true,
          durationMs: true,
          createdAt: true,
        },
      }),
      this.prisma.creditLedger.findMany({
        select: { type: true, amount: true, createdAt: true },
      }),
      this.prisma.creditAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.paymentOrder.findMany({
        where: { createdAt: { gte: since } },
        select: { provider: true, status: true, amountFen: true, createdAt: true },
      }),
      this.prisma.template.findMany({ select: { id: true, name: true } }),
      this.readQueueSize(),
    ]);

    const taskCounts = this.countBy(tasks, "status");
    const totalTasks = tasks.length;
    const completed = taskCounts.succeeded ?? 0;
    const failed = taskCounts.failed ?? 0;
    const generating = taskCounts.running ?? 0;
    const positiveCreditRows = creditRows.filter((row) => row.amount > 0);
    const totalCreditsIssued = positiveCreditRows.reduce((sum, row) => sum + row.amount, 0);
    const monthlyCreditsIssued = positiveCreditRows
      .filter((row) => row.createdAt >= monthStart)
      .reduce((sum, row) => sum + row.amount, 0);
    const dailySpent = Math.abs(
      creditRows
        .filter((row) => row.type === "charge" && row.createdAt >= today)
        .reduce((sum, row) => sum + row.amount, 0),
    );

    const paidOrders = paymentOrders.filter((order) => order.status === "paid" || order.status === "refunded" || order.status === "refund_processing");
    const paidRevenue = paidOrders.reduce((sum, order) => sum + order.amountFen / 100, 0);
    const completedPayments = paymentOrders.filter((order) => order.status === "paid").length;
    const failedPayments = paymentOrders.filter((order) => order.status === "failed").length;
    const pendingPayments = paymentOrders.filter((order) => order.status === "pending").length;

    const templateNames = new Map(templateRows.map((template) => [template.id, template.name]));
    const models = this.buildModelStats(tasks, templateNames);
    const trends = this.buildTrends(safeDays, since, tasks, usersSince, paymentOrders);
    const avgDurationMs = this.average(
      tasks
        .filter((task) => task.status === "succeeded" && task.durationMs !== null)
        .map((task) => task.durationMs ?? 0),
    );
    const [load1] = os.loadavg();
    const cpuCount = os.cpus().length || 1;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();

    return {
      users: {
        total: usersTotal,
        active: activeUsers,
        recent_active: new Set(tasks.map((task) => task.userId)).size,
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
        total_earned: totalCreditsIssued,
        monthly_earned: monthlyCreditsIssued,
        daily_spent: dailySpent,
        total_balance: totalBalance._sum.balance ?? 0,
      },
      transactions: {
        total: paymentOrders.length,
        completed: completedPayments,
        failed: failedPayments,
        pending: pendingPayments,
        average_value: paidOrders.length > 0 ? Number((paidRevenue / paidOrders.length).toFixed(2)) : 0,
        conversion_rate: paymentOrders.length > 0 ? Number(((completedPayments / paymentOrders.length) * 100).toFixed(2)) : 0,
      },
      trends,
      models,
      payment_methods: this.buildPaymentMethods(paymentOrders),
      performance: {
        avg_response_time: Number((avgDurationMs / 1000).toFixed(2)),
        system_uptime: 100,
        queue_size: queueSize,
        cpu_usage: Math.min(100, Math.max(0, Math.round((load1 / cpuCount) * 100))),
        memory_usage: totalMemory > 0 ? Math.round(((totalMemory - freeMemory) / totalMemory) * 100) : 0,
      },
    };
  }

  async getFinanceDashboard(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const [payments, credits] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where: { createdAt: { gte: since }, status: { in: ["paid", "refunded", "refund_processing"] } },
        select: { amountFen: true, createdAt: true },
      }),
      this.prisma.creditLedger.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, amount: true, createdAt: true },
      }),
    ]);

    return {
      success: true,
      data: {
        summary: {
          total_revenue: Number(payments.reduce((sum, row) => sum + row.amountFen / 100, 0).toFixed(2)),
          total_orders: payments.length,
          total_credits_issued: credits.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0),
          total_credits_consumed: Math.abs(credits.filter((row) => row.type === "charge").reduce((sum, row) => sum + row.amount, 0)),
          period_days: safeDays,
        },
        daily_stats: this.buildFinanceDailyStats(safeDays, since, payments, credits),
      },
    };
  }

  private buildTrends(
    safeDays: number,
    since: Date,
    tasks: Array<{ status: string; createdAt: Date }>,
    users: Array<{ createdAt: Date }>,
    payments: Array<{ status: string; amountFen: number; createdAt: Date }>,
  ) {
    const buckets = this.createDailyBuckets(safeDays, since, () => ({
      tasks: 0,
      tasks_completed: 0,
      users: 0,
      revenue: 0,
      transactions: 0,
    }));

    for (const task of tasks) {
      const bucket = buckets.get(this.dateKey(task.createdAt));
      if (!bucket) continue;
      bucket.tasks += 1;
      if (task.status === "succeeded") {
        bucket.tasks_completed += 1;
      }
    }
    for (const user of users) {
      const bucket = buckets.get(this.dateKey(user.createdAt));
      if (bucket) bucket.users += 1;
    }
    for (const payment of payments) {
      if (payment.status !== "paid") continue;
      const bucket = buckets.get(this.dateKey(payment.createdAt));
      if (!bucket) continue;
      bucket.revenue = Number((bucket.revenue + payment.amountFen / 100).toFixed(2));
      bucket.transactions += 1;
    }

    return Array.from(buckets.entries()).map(([date, values]) => ({ date, ...values }));
  }

  private buildModelStats(
    tasks: Array<{ templateId: string; userId: string; creditCost: number }>,
    templateNames: Map<string, string>,
  ) {
    const buckets = new Map<string, { revenue: number; tasks: number; users: Set<string> }>();
    for (const task of tasks) {
      const name = templateNames.get(task.templateId) ?? task.templateId;
      const bucket = buckets.get(name) ?? { revenue: 0, tasks: 0, users: new Set<string>() };
      bucket.tasks += 1;
      bucket.revenue += task.creditCost;
      bucket.users.add(task.userId);
      buckets.set(name, bucket);
    }

    return Object.fromEntries(
      Array.from(buckets.entries()).map(([name, bucket]) => [
        name,
        { revenue: bucket.revenue, tasks: bucket.tasks, users: bucket.users.size },
      ]),
    );
  }

  private buildPaymentMethods(payments: Array<{ provider: string; status: string; amountFen: number }>) {
    const buckets = new Map<string, { revenue: number; count: number }>();
    for (const payment of payments) {
      if (payment.status !== "paid") continue;
      const bucket = buckets.get(payment.provider) ?? { revenue: 0, count: 0 };
      bucket.count += 1;
      bucket.revenue = Number((bucket.revenue + payment.amountFen / 100).toFixed(2));
      buckets.set(payment.provider, bucket);
    }
    return Object.fromEntries(buckets.entries());
  }

  private buildFinanceDailyStats(
    safeDays: number,
    since: Date,
    payments: Array<{ amountFen: number; createdAt: Date }>,
    credits: Array<{ type: string; amount: number; createdAt: Date }>,
  ) {
    const buckets = this.createDailyBuckets(safeDays, since, () => ({
      revenue: 0,
      orders: 0,
      credits_issued: 0,
      credits_consumed: 0,
    }));

    for (const payment of payments) {
      const bucket = buckets.get(this.dateKey(payment.createdAt));
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.revenue = Number((bucket.revenue + payment.amountFen / 100).toFixed(2));
    }
    for (const credit of credits) {
      const bucket = buckets.get(this.dateKey(credit.createdAt));
      if (!bucket) continue;
      if (credit.amount > 0) {
        bucket.credits_issued += credit.amount;
      }
      if (credit.type === "charge") {
        bucket.credits_consumed += Math.abs(credit.amount);
      }
    }

    return Array.from(buckets.entries()).map(([date, values]) => ({ date, ...values }));
  }

  private createDailyBuckets<T extends Record<string, number>>(safeDays: number, since: Date, factory: () => T) {
    const buckets = new Map<string, T>();
    const start = new Date(since);
    start.setHours(0, 0, 0, 0);
    for (let index = 0; index < safeDays; index += 1) {
      const day = new Date(start.getTime() + index * 24 * 60 * 60 * 1000);
      buckets.set(this.dateKey(day), factory());
    }
    return buckets;
  }

  private countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
    return rows.reduce<Record<string, number>>((counts, row) => {
      const value = String(row[key] ?? "");
      counts[value] = (counts[value] ?? 0) + 1;
      return counts;
    }, {});
  }

  private average(values: number[]) {
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private async readQueueSize() {
    try {
      const counts = await this.generationQueue.getJobCounts("waiting", "delayed", "active", "paused");
      return Object.values(counts).reduce((sum, value) => sum + value, 0);
    } catch {
      return 0;
    }
  }

  private startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  private dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
  }
}
