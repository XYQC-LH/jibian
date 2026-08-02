import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";

const ORDER_TYPES = ["recharge", "redeem", "adjustment"];
const REFUND_REF_TYPE = "order_refund";

type CreditOrder = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  refType: string;
  refId: string;
  balanceAfter: number;
  createdAt: Date;
  user?: { nickname: string | null; phone: string | null } | null;
};

type PaymentOrderSummary = {
  amountFen: number;
  packageId: string;
  status: string;
  outTradeNo: string;
};

type OrderStatisticsRow = {
  id: string;
  amount: number;
  refType: string;
  refId: string;
  createdAt: Date;
};

type ListOrderParams = {
  page: number;
  pageSize: number;
  status?: string;
  userEmail?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
};

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async listOrders(params: ListOrderParams) {
    const { page, pageSize } = this.resolvePagination(params.page, params.pageSize);
    const orders = await this.prisma.creditLedger.findMany({
      where: this.buildOrderWhere(params),
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
    const refundIds = await this.refundedOrderIds(orders.map((order) => order.id));
    const paymentOrders = await this.paymentOrdersByRefIds(orders);
    const filtered = orders
      .map((order) => this.mapOrder(order, refundIds.has(order.id), paymentOrders.get(order.refId)))
      .filter((order) => this.matchesOrderFilters(order, params));
    const offset = (page - 1) * pageSize;

    return {
      success: true,
      data: this.paginated(
        filtered.slice(offset, offset + pageSize),
        filtered.length,
        page,
        pageSize,
      ),
    };
  }

  async getOrderDetail(orderId: string) {
    const order = await this.findOrder(orderId);
    const refund = await this.prisma.creditLedger.findFirst({
      where: { refType: REFUND_REF_TYPE, refId: order.id },
      orderBy: { createdAt: "desc" },
    });
    const payment = order.refType === "payment_order"
      ? await this.prisma.paymentOrder.findUnique({ where: { id: order.refId } })
      : null;
    const paymentRefund = payment
      ? await this.prisma.paymentRefund.findFirst({
          where: { paymentOrderId: payment.id },
          orderBy: { createdAt: "desc" },
        })
      : null;

    return {
      success: true,
      data: {
        ...this.mapOrder(order, Boolean(refund), payment ?? undefined),
        refund: refund
          ? {
              id: refund.id,
              amount: refund.amount,
              balance_after: refund.balanceAfter,
              created_at: refund.createdAt.toISOString(),
            }
          : null,
        payment_refund: paymentRefund ? this.mapPaymentRefund(paymentRefund) : null,
      },
    };
  }

  async processOrderRefund(orderId: string, reason?: string) {
    const order = await this.findOrder(orderId);
    const existingRefund = await this.prisma.creditLedger.findFirst({
      where: { refType: REFUND_REF_TYPE, refId: order.id },
    });
    if (existingRefund) {
      return { success: true, data: { refunded: true, refund_id: existingRefund.id, already_refunded: true } };
    }

    const paymentRefund = await this.refundPaymentOrderIfNeeded(order, reason);
    if (paymentRefund) {
      const creditRefund = await this.prisma.creditLedger.findFirst({
        where: { refType: REFUND_REF_TYPE, refId: order.id },
        orderBy: { createdAt: "desc" },
      });
      return {
        success: true,
        data: {
          refunded: paymentRefund.status === "succeeded",
          refund_id: creditRefund?.id ?? null,
          amount: creditRefund?.amount,
          balance_after: creditRefund?.balanceAfter,
          payment_refund: paymentRefund,
        },
      };
    }

    const refund = await this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({ where: { userId: order.userId } });
      const balance = account?.balance ?? 0;
      if (balance < order.amount) {
        throw new BadRequestException("Insufficient user balance to refund credits");
      }

      const balanceAfter = balance - order.amount;
      await tx.creditAccount.update({
        where: { userId: order.userId },
        data: { balance: balanceAfter, updatedAt: new Date() },
      });

      return tx.creditLedger.create({
        data: {
          userId: order.userId,
          type: "adjustment",
          amount: -order.amount,
          refType: REFUND_REF_TYPE,
          refId: order.id,
          balanceAfter,
        },
      });
    });

    return {
      success: true,
      data: {
        refunded: true,
        refund_id: refund.id,
        amount: refund.amount,
        balance_after: refund.balanceAfter,
        payment_refund: paymentRefund,
      },
    };
  }

  async getOrderStatistics(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.trunc(days), 365) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const [orders, refunds] = await Promise.all([
      this.prisma.creditLedger.findMany({
        where: { type: { in: ORDER_TYPES }, amount: { gt: 0 }, createdAt: { gte: since } },
        select: { id: true, amount: true, refType: true, refId: true, createdAt: true },
      }),
      this.prisma.creditLedger.findMany({
        where: { refType: REFUND_REF_TYPE, createdAt: { gte: since } },
        select: { refId: true, amount: true, createdAt: true },
      }),
    ]);
    const refundedIds = new Set(refunds.map((refund) => refund.refId));
    const paymentOrders = await this.paymentOrdersByRefIds(orders);
    const totalAmount = orders
      .filter((order) => !refundedIds.has(order.id))
      .reduce((sum, order) => sum + this.orderAmountYuan(order, paymentOrders), 0);

    return {
      success: true,
      data: {
        total_orders: orders.length,
        total_amount: Number(totalAmount.toFixed(2)),
        total_credits: orders.reduce((sum, order) => sum + order.amount, 0),
        success_count: orders.filter((order) => !refundedIds.has(order.id)).length,
        failed_count: 0,
        refund_count: refundedIds.size,
        refunded_credits: Math.abs(refunds.reduce((sum, refund) => sum + refund.amount, 0)),
        period_days: safeDays,
        date_breakdown: this.buildDateBreakdown(orders, paymentOrders, refundedIds),
      },
    };
  }

  async listRedemptionCodeUsages(codeId: string, params: { page: number; pageSize: number }) {
    const { page, pageSize } = this.resolvePagination(params.page, params.pageSize);
    const where = { refType: "redeem_code", refId: codeId };
    const [total, usages] = await this.prisma.$transaction([
      this.prisma.creditLedger.count({ where }),
      this.prisma.creditLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: true },
      }),
    ]);

    return {
      success: true,
      data: this.paginated(usages.map((usage) => ({
        id: usage.id,
        user_id: usage.userId,
        user_email: this.userLabel(usage.user),
        credits: usage.amount,
        balance_after: usage.balanceAfter,
        created_at: usage.createdAt.toISOString(),
      })), total, page, pageSize),
    };
  }

  async getRedemptionStatistics() {
    const now = new Date();
    const [codes, redeemed] = await Promise.all([
      this.prisma.redeemCode.findMany(),
      this.prisma.creditLedger.findMany({
        where: { refType: "redeem_code" },
        select: { amount: true },
      }),
    ]);

    return {
      success: true,
      data: {
        total_codes: codes.length,
        active_codes: codes.filter((code) => code.status === "active" && (!code.expiresAt || code.expiresAt > now)).length,
        expired_codes: codes.filter((code) => code.expiresAt && code.expiresAt <= now).length,
        total_credits_issued: codes.reduce((sum, code) => sum + code.amount * code.maxUses, 0),
        total_credits_redeemed: redeemed.reduce((sum, row) => sum + row.amount, 0),
      },
    };
  }

  private async findOrder(orderId: string) {
    const order = await this.prisma.creditLedger.findFirst({
      where: { id: orderId, type: { in: ORDER_TYPES }, amount: { gt: 0 } },
      include: { user: true },
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  private buildOrderWhere(params: ListOrderParams): Record<string, unknown> {
    const createdAt: Record<string, Date> = {};
    const start = this.parseDate(params.startDate);
    const end = this.parseDate(params.endDate);
    if (start) createdAt.gte = start;
    if (end) createdAt.lte = end;

    return {
      type: { in: ORDER_TYPES },
      amount: { gt: 0 },
      ...(Object.keys(createdAt).length > 0 ? { createdAt } : {}),
      ...(params.userEmail
        ? {
            user: {
              OR: [
                { nickname: { contains: params.userEmail } },
                { phone: { contains: params.userEmail } },
              ],
            },
          }
        : {}),
    };
  }

  private matchesOrderFilters(order: ReturnType<AdminOrdersService["mapOrder"]>, params: ListOrderParams) {
    const status = String(params.status || "").trim();
    if (status && status !== "all" && order.status !== status) {
      return false;
    }

    const paymentMethod = String(params.paymentMethod || "").trim();
    if (paymentMethod && paymentMethod !== "all" && order.payment_method !== paymentMethod) {
      return false;
    }

    return true;
  }

  private async refundPaymentOrderIfNeeded(order: CreditOrder, reason?: string) {
    if (order.refType !== "payment_order") {
      return null;
    }
    const payment = await this.prisma.paymentOrder.findUnique({ where: { id: order.refId } });
    if (!payment) {
      throw new NotFoundException("Payment order not found");
    }
    return this.payments.refundWechatPaymentOrder(payment.id, reason || `Admin refund ${order.id}`);
  }

  private async refundedOrderIds(orderIds: string[]) {
    if (orderIds.length === 0) return new Set<string>();
    const refunds = await this.prisma.creditLedger.findMany({
      where: { refType: REFUND_REF_TYPE, refId: { in: orderIds } },
      select: { refId: true },
    });
    return new Set(refunds.map((refund) => refund.refId));
  }

  private async paymentOrdersByRefIds(orders: Array<{ refType: string; refId: string }>) {
    const paymentOrderIds = orders
      .filter((order) => order.refType === "payment_order")
      .map((order) => order.refId);
    if (paymentOrderIds.length === 0) return new Map<string, PaymentOrderSummary>();

    const paymentOrders = await this.prisma.paymentOrder.findMany({
      where: { id: { in: paymentOrderIds } },
      select: { id: true, amountFen: true, packageId: true, status: true, outTradeNo: true },
    });
    return new Map(paymentOrders.map((order) => [order.id, order]));
  }

  private mapOrder(order: CreditOrder, refunded = false, payment?: PaymentOrderSummary) {
    return {
      id: order.id,
      order_no: payment?.outTradeNo ?? `credit-${order.id.slice(0, 8)}`,
      user_id: order.userId,
      user_email: this.userLabel(order.user),
      type: order.type,
      status: refunded ? "refunded" : "success",
      payment_method: order.refType === "payment_order" ? "wechat_pay" : order.type === "redeem" ? "redeem_code" : "credits",
      total_amount: payment ? Number((payment.amountFen / 100).toFixed(2)) : 0,
      credits: order.amount,
      ref_type: order.refType,
      ref_id: order.refId,
      package_id: payment?.packageId,
      balance_after: order.balanceAfter,
      created_at: order.createdAt.toISOString(),
    };
  }

  private buildDateBreakdown(
    orders: OrderStatisticsRow[],
    paymentOrders: Map<string, PaymentOrderSummary>,
    refundedIds: Set<string>,
  ) {
    const buckets = new Map<string, { date: string; order_count: number; credits: number; amount: number }>();
    for (const order of orders) {
      const date = order.createdAt.toISOString().slice(0, 10);
      const bucket = buckets.get(date) ?? { date, order_count: 0, credits: 0, amount: 0 };
      bucket.order_count += 1;
      bucket.credits += order.amount;
      if (!refundedIds.has(order.id)) {
        bucket.amount = Number((bucket.amount + this.orderAmountYuan(order, paymentOrders)).toFixed(2));
      }
      buckets.set(date, bucket);
    }
    return [...buckets.values()].sort((left, right) => left.date.localeCompare(right.date));
  }

  private orderAmountYuan(order: { refType: string; refId: string }, paymentOrders: Map<string, PaymentOrderSummary>) {
    if (order.refType !== "payment_order") {
      return 0;
    }
    const payment = paymentOrders.get(order.refId);
    return payment ? payment.amountFen / 100 : 0;
  }

  private resolvePagination(page: number, pageSize: number) {
    const safePage = Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.trunc(pageSize), 100) : 20;
    return { page: safePage, pageSize: safePageSize };
  }

  private parseDate(value: string | undefined) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private paginated(items: unknown[], total: number, page: number, pageSize: number) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items,
      total,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    };
  }

  private userLabel(user: { nickname: string | null; phone: string | null } | null | undefined) {
    return user?.nickname || user?.phone || undefined;
  }

  private mapPaymentRefund(refund: {
    id: string;
    paymentOrderId: string;
    outRefundNo: string;
    wxRefundId: string | null;
    status: string;
    amountFen: number;
    credits: number;
    reason: string | null;
    failureReason: string | null;
    succeededAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: refund.id,
      payment_order_id: refund.paymentOrderId,
      out_refund_no: refund.outRefundNo,
      wx_refund_id: refund.wxRefundId,
      status: refund.status,
      amount_fen: refund.amountFen,
      amount_yuan: Number((refund.amountFen / 100).toFixed(2)),
      credits: refund.credits,
      reason: refund.reason,
      failure_reason: refund.failureReason,
      succeeded_at: refund.succeededAt?.toISOString() ?? null,
      created_at: refund.createdAt.toISOString(),
      updated_at: refund.updatedAt.toISOString(),
    };
  }
}
