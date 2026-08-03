import { MembershipsService } from "../src/memberships/memberships.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { WechatPayClient } from "../src/payments/wechat-pay.client";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  amountFen: number;
  periodDays: number;
  status: string;
  sortOrder: number;
};

type SubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  outContractCode: string;
  contractId: string | null;
  status: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  nextRenewAt: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type OrderRow = {
  id: string;
  subscriptionId: string;
  userId: string;
  planId: string;
  orderType: string;
  outTradeNo: string;
  wxTransactionId: string | null;
  status: string;
  amountFen: number;
  periodStart: Date;
  periodEnd: Date;
  failureReason: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type RefundRow = {
  id: string;
  membershipOrderId: string;
  outRefundNo: string;
  wxRefundId: string | null;
  status: string;
  amountFen: number;
  reason: string | null;
  failureReason: string | null;
  succeededAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

class FakeMembershipPrisma {
  readonly userId = "00000000-0000-4000-8000-000000000501";
  private seq = 1;
  readonly users = [{ id: this.userId, openid: "openid-smoke", status: "active" }];
  readonly plans: PlanRow[] = [
    { id: "00000000-0000-4000-8000-000000000601", code: "month", name: "连续包月", amountFen: 1500, periodDays: 30, status: "active", sortOrder: 1 },
    { id: "00000000-0000-4000-8000-000000000602", code: "season", name: "连续包季", amountFen: 4000, periodDays: 90, status: "active", sortOrder: 2 },
    { id: "00000000-0000-4000-8000-000000000603", code: "year", name: "连续包年", amountFen: 10800, periodDays: 365, status: "active", sortOrder: 3 },
  ];
  readonly subscriptions: SubscriptionRow[] = [];
  readonly orders: OrderRow[] = [];
  readonly refunds: RefundRow[] = [];
  readonly events: Array<{ eventId: string; eventType: string; payload: unknown }> = [];

  user = {
    findUnique: async (args: { where: { id: string } }) =>
      this.users.find((user) => user.id === args.where.id) ?? null,
  };

  membershipPlan = {
    findMany: async () => [...this.plans].sort((a, b) => a.sortOrder - b.sortOrder),
    findFirst: async (args: { where: { OR?: Array<{ id?: string; code?: string }>; status?: string } }) =>
      this.plans.find((plan) => (
        (!args.where.status || plan.status === args.where.status) &&
        (!args.where.OR || args.where.OR.some((item) => item.id === plan.id || item.code === plan.code))
      )) ?? null,
  };

  membershipSubscription = {
    create: async (args: { data: Omit<SubscriptionRow, "id" | "contractId" | "currentPeriodStart" | "currentPeriodEnd" | "nextRenewAt" | "cancelAtPeriodEnd" | "canceledAt" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const row: SubscriptionRow = {
        id: this.id("sub"),
        contractId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        nextRenewAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      this.subscriptions.push(row);
      return row;
    },
    findFirst: async (args: { where: { userId?: string; status?: { in: string[] } }; orderBy?: { createdAt: "desc" } }) => {
      const rows = this.subscriptions.filter((row) => (
        (!args.where.userId || row.userId === args.where.userId) &&
        (!args.where.status || args.where.status.in.includes(row.status))
      ));
      return this.withPlan(rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null);
    },
    findUnique: async (args: { where: { id?: string; outContractCode?: string }; include?: { plan?: boolean; orders?: unknown } }) => {
      const row = this.subscriptions.find((item) => (
        (args.where.id && item.id === args.where.id) ||
        (args.where.outContractCode && item.outContractCode === args.where.outContractCode)
      )) ?? null;
      if (!row) return null;
      return {
        ...row,
        ...(args.include?.plan ? { plan: this.requiredPlan(row.planId) } : {}),
        ...(args.include?.orders ? { orders: this.orders.filter((order) => order.subscriptionId === row.id) } : {}),
      };
    },
    update: async (args: { where: { id: string }; data: Partial<SubscriptionRow>; include?: { plan?: boolean } }) => {
      const row = this.required(this.subscriptions.find((item) => item.id === args.where.id), "subscription");
      Object.assign(row, args.data, { updatedAt: new Date() });
      return args.include?.plan ? { ...row, plan: this.requiredPlan(row.planId) } : row;
    },
  };

  membershipOrder = {
    create: async (args: { data: Omit<OrderRow, "id" | "wxTransactionId" | "failureReason" | "paidAt" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const row: OrderRow = {
        id: this.id("order"),
        wxTransactionId: null,
        failureReason: null,
        paidAt: null,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      this.orders.push(row);
      return row;
    },
    findFirst: async (args: { where: { subscriptionId?: string; orderType?: string; status?: { in: string[] } | string; periodStart?: Date }; orderBy?: { createdAt: "desc" } }) => {
      const rows = this.orders.filter((row) => (
        (!args.where.subscriptionId || row.subscriptionId === args.where.subscriptionId) &&
        (!args.where.orderType || row.orderType === args.where.orderType) &&
        (!args.where.periodStart || row.periodStart.getTime() === args.where.periodStart.getTime()) &&
        (!args.where.status || (typeof args.where.status === "string" ? row.status === args.where.status : args.where.status.in.includes(row.status)))
      ));
      return rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null;
    },
    findUnique: async (args: { where: { id?: string; outTradeNo?: string }; include?: { plan?: boolean; subscription?: boolean } }) => {
      const row = this.orders.find((item) => (
        (args.where.id && item.id === args.where.id) ||
        (args.where.outTradeNo && item.outTradeNo === args.where.outTradeNo)
      )) ?? null;
      if (!row) return null;
      return {
        ...row,
        ...(args.include?.plan ? { plan: this.requiredPlan(row.planId) } : {}),
        ...(args.include?.subscription ? { subscription: this.required(this.subscriptions.find((item) => item.id === row.subscriptionId), "subscription") } : {}),
      };
    },
    update: async (args: { where: { id?: string; outTradeNo?: string }; data: Partial<OrderRow> }) => {
      const row = this.required(this.orders.find((item) => (
        (args.where.id && item.id === args.where.id) ||
        (args.where.outTradeNo && item.outTradeNo === args.where.outTradeNo)
      )), "order");
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
  };

  membershipRefund = {
    findFirst: async (args: { where: { membershipOrderId: string; status?: { in: string[] } } }) =>
      this.refunds.find((row) => row.membershipOrderId === args.where.membershipOrderId && (!args.where.status || args.where.status.in.includes(row.status))) ?? null,
    create: async (args: { data: Omit<RefundRow, "id" | "wxRefundId" | "failureReason" | "succeededAt" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const row: RefundRow = {
        id: this.id("refund"),
        wxRefundId: null,
        failureReason: null,
        succeededAt: null,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      this.refunds.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Partial<RefundRow> }) => {
      const row = this.required(this.refunds.find((item) => item.id === args.where.id), "refund");
      Object.assign(row, args.data, { updatedAt: new Date() });
      return row;
    },
  };

  wechatMembershipEvent = {
    create: async (args: { data: { eventId: string; eventType: string; payload: unknown } }) => {
      if (this.events.some((event) => event.eventId === args.data.eventId)) {
        const error = new Error("duplicate") as Error & { code?: string };
        error.code = "P2002";
        throw error;
      }
      this.events.push(args.data);
      return args.data;
    },
  };

  async $transaction<T>(operation: ((tx: this) => Promise<T>) | Array<Promise<unknown>>) {
    return Array.isArray(operation) ? Promise.all(operation) as T : operation(this);
  }

  private withPlan(row: SubscriptionRow | null) {
    return row ? { ...row, plan: this.requiredPlan(row.planId) } : null;
  }

  private requiredPlan(planId: string) {
    return this.required(this.plans.find((plan) => plan.id === planId), "plan");
  }

  private required<T>(value: T | undefined | null, label: string): T {
    if (!value) throw new Error(`Missing ${label}`);
    return value;
  }

  private id(prefix: string) {
    return `${prefix}-${this.seq++}`;
  }
}

class FakeWechatPayClient {
  private idSeq = 1;
  applyCount = 0;
  cancelCount = 0;

  hasPapayConfig() {
    return true;
  }

  requirePapayConfig() {
    return { appId: "wx-smoke", mchId: "mch-smoke", notifyUrl: "https://api.example.com", apiBaseUrl: "https://api.example.com" };
  }

  readEnv(key: string) {
    const values: Record<string, string> = {
      WECHAT_PAPAY_SERVICE_ID: "1001",
      WECHAT_PAPAY_CONTRACT_NOTIFY_URL: "https://api.example.com/api/memberships/wechat/contracts/notify",
      WECHAT_PAPAY_TRANSACTION_NOTIFY_URL: "https://api.example.com/api/memberships/wechat/transactions/notify",
      WECHAT_PAPAY_SIGN_APP_ID: "wx-pay-sign",
      WECHAT_PAPAY_SIGN_PATH: "pages/index/index",
    };
    return values[key] ?? "";
  }

  createId(prefix: string) {
    return `${prefix}-SMOKE-${this.idSeq++}`;
  }

  async fetch<T>(_cfg: unknown, _method: string, path: string, body: string): Promise<T> {
    if (path.includes("pre-entrust-sign")) {
      return { appid: "wx-pay-sign", path: "pages/index/index", pre_entrustweb_id: "pre-smoke" } as T;
    }
    if (path.includes("transactions/apply")) {
      this.applyCount += 1;
      return { accepted: true } as T;
    }
    if (path.includes("terminate")) {
      this.cancelCount += 1;
      return { accepted: true } as T;
    }
    if (path.includes("refund")) {
      const payload = JSON.parse(body) as { out_refund_no: string };
      return { refund_id: "refund-smoke", out_refund_no: payload.out_refund_no, status: "SUCCESS" } as T;
    }
    return {} as T;
  }

  verifySignature() {
    return undefined;
  }

  decryptNotifyResource<T>(_cfg: unknown, body: { decrypted?: T }) {
    return body.decrypted as T;
  }
}

class FakeQueue {
  jobs: unknown[] = [];

  async add(_name: string, data: unknown) {
    this.jobs.push(data);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function statusOf(row: { status: string } | undefined) {
  return row?.status;
}

async function main() {
  const prisma = new FakeMembershipPrisma();
  const wechat = new FakeWechatPayClient();
  const queue = new FakeQueue();
  const service = new MembershipsService(
    prisma as unknown as PrismaService,
    wechat as unknown as WechatPayClient,
    queue as never,
  );

  const plans = await service.listPlans();
  assert(plans.data.length === 3, "membership plans should be listed");

  const preSign = await service.createWechatPreSign(prisma.userId, "month");
  const subscription = prisma.subscriptions[0];
  const initialOrder = prisma.orders[0];
  assert(preSign.data.mini_program.extra_data.pre_entrustweb_id === "pre-smoke", "pre-sign should return mini program data");
  assert(statusOf(subscription) === "pending", "subscription should start pending");
  assert(statusOf(initialOrder) === "pending", "initial order should start pending");

  await service.handleContractNotify({
    id: "contract-event-1",
    decrypted: {
      out_contract_code: subscription.outContractCode,
      contract_id: "contract-smoke",
      contract_state: "SIGNED",
    },
  }, {}, "{}");
  assert(statusOf(subscription) === "pending_payment", "signed contract should wait for first payment");
  assert(statusOf(initialOrder) === "accepted", "signed contract should request first charge");
  assert(wechat.applyCount === 1, "initial charge should be requested once");

  await service.handleContractNotify({
    id: "contract-event-1",
    decrypted: {
      out_contract_code: subscription.outContractCode,
      contract_id: "contract-smoke",
      contract_state: "SIGNED",
    },
  }, {}, "{}");
  assert(wechat.applyCount === 1, "duplicate contract notification should be ignored");

  await service.handleTransactionNotify({
    id: "transaction-event-1",
    decrypted: {
      out_trade_no: initialOrder.outTradeNo,
      transaction_id: "tx-initial",
      trade_state: "SUCCESS",
      amount: { total: initialOrder.amountFen },
    },
  }, {}, "{}");
  assert(statusOf(subscription) === "active", "successful first payment should activate membership");
  assert(subscription.currentPeriodEnd && subscription.currentPeriodEnd > new Date(), "active membership should have a future period end");
  assert(queue.jobs.length === 1, "active membership should schedule renewal");

  await service.renewSubscription(subscription.id);
  const renewalOrder = prisma.orders.find((order) => order.orderType === "renewal");
  assert(statusOf(renewalOrder) === "accepted", "renewal job should create accepted renewal order");

  await service.handleTransactionNotify({
    id: "transaction-event-2",
    decrypted: {
      out_trade_no: renewalOrder?.outTradeNo,
      transaction_id: "tx-renewal",
      trade_state: "SUCCESS",
      amount: { total: renewalOrder?.amountFen },
    },
  }, {}, "{}");
  assert(statusOf(renewalOrder) === "paid", "renewal payment notification should mark order paid");
  assert(statusOf(subscription) === "active", "renewal payment should keep subscription active");

  const cancelResult = await service.cancelMine(prisma.userId);
  assert(cancelResult.data.cancel_at_period_end === true, "cancel should keep paid period but stop auto renewal");
  assert(wechat.cancelCount === 1, "cancel should call upstream termination");

  const refundResult = await service.adminRefundOrder(initialOrder.id, "smoke refund");
  assert(refundResult.data.status === "succeeded", "refund should succeed");
  assert(statusOf(subscription) === "refunded", "refund should stop membership immediately");

  subscription.status = "active";
  subscription.cancelAtPeriodEnd = false;
  subscription.currentPeriodEnd = new Date(Date.now() - 1000);
  prisma.orders.forEach((order) => {
    if (order.status === "paid") {
      order.status = "failed";
    }
  });
  await service.renewSubscription(subscription.id);
  assert(statusOf(subscription) === "expired", "expired paid period without renewal should stop membership");

  console.log(JSON.stringify({
    ok: true,
    subscription: {
      status: subscription.status,
      contract_id: subscription.contractId,
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
    },
    orders: prisma.orders.map((order) => ({ type: order.orderType, status: order.status })),
    refunds: prisma.refunds.map((refund) => ({ status: refund.status, amount_fen: refund.amountFen })),
    events: prisma.events.length,
    queued_jobs: queue.jobs.length,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
