import { AdminStatisticsService } from "../src/admin/admin-statistics.service";

type UserRow = { id: string; status: string; createdAt: Date };
type TaskRow = {
  id: string;
  userId: string;
  templateId: string;
  status: string;
  creditCost: number;
  durationMs: number | null;
  createdAt: Date;
};
type CreditLedgerRow = { type: string; amount: number; createdAt: Date };
type CreditAccountRow = { balance: number };
type PaymentOrderRow = { provider: string; status: string; amountFen: number; createdAt: Date };
type TemplateRow = { id: string; name: string };

class FakeStatsPrisma {
  private readonly now = new Date();
  private readonly today = new Date(this.now.getFullYear(), this.now.getMonth(), this.now.getDate());

  readonly users: UserRow[] = [
    { id: "user-a", status: "active", createdAt: this.today },
    { id: "user-b", status: "active", createdAt: this.daysAgo(1) },
    { id: "user-c", status: "banned", createdAt: this.daysAgo(2) },
  ];

  readonly tasks: TaskRow[] = [
    { id: "task-a", userId: "user-a", templateId: "template-a", status: "succeeded", creditCost: 6, durationMs: 2400, createdAt: this.today },
    { id: "task-b", userId: "user-b", templateId: "template-a", status: "failed", creditCost: 6, durationMs: 1600, createdAt: this.daysAgo(1) },
    { id: "task-c", userId: "user-a", templateId: "template-b", status: "running", creditCost: 4, durationMs: null, createdAt: this.daysAgo(2) },
  ];

  readonly creditRows: CreditLedgerRow[] = [
    { type: "recharge", amount: 30, createdAt: this.today },
    { type: "redeem", amount: 10, createdAt: this.daysAgo(1) },
    { type: "charge", amount: -6, createdAt: this.today },
  ];

  readonly creditAccounts: CreditAccountRow[] = [{ balance: 34 }, { balance: 10 }];
  readonly payments: PaymentOrderRow[] = [
    { provider: "wechat_pay", status: "paid", amountFen: 990, createdAt: this.today },
    { provider: "wechat_pay", status: "pending", amountFen: 1990, createdAt: this.daysAgo(1) },
    { provider: "wechat_pay", status: "failed", amountFen: 990, createdAt: this.daysAgo(1) },
  ];
  readonly templates: TemplateRow[] = [
    { id: "template-a", name: "清透珠光写真" },
    { id: "template-b", name: "电影质感" },
  ];

  user = {
    count: async (args?: { where?: { status?: string; createdAt?: { gte?: Date } } }) =>
      this.users.filter((row) => this.matchesUser(row, args?.where)).length,
    findMany: async (args: { where?: { createdAt?: { gte?: Date } }; select: Record<string, boolean> }) =>
      this.users
        .filter((row) => this.matchesUser(row, args.where))
        .map((row) => this.pick(row, args.select)),
  };

  task = {
    findMany: async (args: { where?: { createdAt?: { gte?: Date } }; select: Record<string, boolean> }) =>
      this.tasks
        .filter((row) => this.matchesCreatedAt(row.createdAt, args.where?.createdAt))
        .map((row) => this.pick(row, args.select)),
  };

  creditLedger = {
    findMany: async (args?: { where?: { createdAt?: { gte?: Date } }; select?: Record<string, boolean> }) =>
      this.creditRows
        .filter((row) => this.matchesCreatedAt(row.createdAt, args?.where?.createdAt))
        .map((row) => args?.select ? this.pick(row, args.select) : row),
  };

  creditAccount = {
    aggregate: async () => ({
      _sum: { balance: this.creditAccounts.reduce((sum, row) => sum + row.balance, 0) },
    }),
  };

  paymentOrder = {
    findMany: async (args?: { where?: { createdAt?: { gte?: Date }; status?: { in?: string[] } }; select?: Record<string, boolean> }) =>
      this.payments
        .filter((row) => this.matchesCreatedAt(row.createdAt, args?.where?.createdAt))
        .filter((row) => !args?.where?.status?.in || args.where.status.in.includes(row.status))
        .map((row) => args?.select ? this.pick(row, args.select) : row),
  };

  template = {
    findMany: async (args: { select: Record<string, boolean> }) =>
      this.templates.map((row) => this.pick(row, args.select)),
  };

  private daysAgo(days: number) {
    return new Date(this.today.getTime() - days * 24 * 60 * 60 * 1000);
  }

  private matchesUser(row: UserRow, where?: { status?: string; createdAt?: { gte?: Date } }) {
    if (!where) return true;
    if (where.status && row.status !== where.status) return false;
    return this.matchesCreatedAt(row.createdAt, where.createdAt);
  }

  private matchesCreatedAt(value: Date, where?: { gte?: Date }) {
    return !where?.gte || value >= where.gte;
  }

  private pick<T extends Record<string, unknown>>(row: T, select: Record<string, boolean>) {
    return Object.fromEntries(Object.entries(row).filter(([key]) => select[key]));
  }
}

class FakeQueue {
  async getJobCounts() {
    return { waiting: 2, delayed: 1, active: 1, paused: 0 };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const service = new AdminStatisticsService(
    new FakeStatsPrisma() as never,
    new FakeQueue() as never,
  );

  const stats = await service.getStatistics(30);
  assert(stats.users.total === 3, "total users should be computed");
  assert(stats.users.active === 2, "active users should be computed");
  assert(stats.tasks.completed === 1, "completed tasks should be computed");
  assert(stats.tasks.failed === 1, "failed tasks should be computed");
  assert(stats.credits.daily_spent === 6, "daily spent should be computed from charge ledger");
  assert(stats.transactions.total === 3, "payment order count should be computed");
  assert(stats.payment_methods.wechat_pay.count === 1, "payment method count should be computed from paid orders");
  assert(stats.models["清透珠光写真"].tasks === 2, "top model stats should be computed");
  assert(stats.performance.queue_size === 4, "queue size should come from BullMQ counts");
  assert(stats.trends.length === 30, "trend window should match requested days");
  assert(stats.trends.some((row) => row.tasks > 0), "trends should include task activity");

  const finance = await service.getFinanceDashboard(30);
  assert(finance.data.summary.total_revenue === 9.9, "finance revenue should be computed from paid payment orders");
  assert(finance.data.summary.total_orders === 1, "finance order count should include paid/refund-processing/refunded orders");
  assert(finance.data.daily_stats.length === 30, "finance daily stats should match requested days");

  console.log(JSON.stringify({
    ok: true,
    users: stats.users,
    tasks: stats.tasks,
    credits: stats.credits,
    transactions: stats.transactions,
    payment_methods: stats.payment_methods,
    models: stats.models,
    queue_size: stats.performance.queue_size,
    trend_points: stats.trends.length,
    finance_summary: finance.data.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
