import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import { Queue } from "bullmq";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";
import { WechatPayClient, WechatPayConfig, WechatPayNotifyBody } from "../payments/wechat-pay.client";
import { defaultMembershipPlans } from "./membership-plans";

const RENEWAL_LEAD_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES = new Set(["active", "canceling", "renewal_failed"]);

type MembershipPlanRow = {
  id: string;
  code: string;
  name: string;
  amountFen: number;
  periodDays: number;
  status: string;
  sortOrder: number;
};

type MembershipSubscriptionRow = {
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
  plan?: MembershipPlanRow;
};

type MembershipOrderRow = {
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
  plan?: MembershipPlanRow;
  subscription?: MembershipSubscriptionRow;
};

type WechatPapayPreSignResponse = {
  appid?: string;
  app_id?: string;
  appId?: string;
  path?: string;
  mini_program_path?: string;
  pre_entrustweb_id?: string;
  preEntrustwebId?: string;
  message?: string;
  code?: string;
};

type WechatContractNotify = {
  out_contract_code?: string;
  contract_id?: string;
  contract_state?: string;
  contract_status?: string;
  state?: string;
  operate_type?: string;
};

type WechatTransactionNotify = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  transaction_state?: string;
  amount?: { total?: number };
  fail_reason?: string;
};

type WechatRefundResponse = {
  refund_id?: string;
  out_refund_no?: string;
  status?: string;
  amount?: { refund?: number; total?: number };
  message?: string;
  code?: string;
};

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wechat: WechatPayClient,
    @InjectQueue("membership-renewal") private readonly renewalQueue: Queue,
  ) {}

  async listPlans() {
    const plans = await this.prisma.membershipPlan.findMany({
      where: { status: "active" },
      orderBy: [{ sortOrder: "asc" }, { amountFen: "asc" }],
    });
    const rows = plans.length > 0 ? plans : defaultMembershipPlans.map((plan, index) => ({
      id: plan.code,
      code: plan.code,
      name: plan.name,
      amountFen: plan.amountFen,
      periodDays: plan.periodDays,
      status: "active",
      sortOrder: index + 1,
    }));
    return { success: true, data: rows.map((plan) => this.toPlanResponse(plan)) };
  }

  async getMe(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    const subscription = await this.findCurrentSubscription(userId);
    return {
      success: true,
      data: {
        ...this.toMembershipStatus(subscription),
        subscription_available: this.wechat.hasPapayConfig(),
        unavailable_reason: this.wechat.hasPapayConfig() ? "" : "会员订阅暂未开放，请稍后再试。",
      },
    };
  }

  async createWechatPreSign(userId: string | undefined, planId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    const selectedPlan = await this.requirePlan(planId);
    const cfg = this.wechat.requirePapayConfig();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, openid: true, status: true },
    });
    if (!user || user.status !== "active") {
      throw new NotFoundException("User not found");
    }

    const current = await this.findCurrentSubscription(userId);
    if (this.isSubscriptionActive(current)) {
      throw new BadRequestException("Membership is already active");
    }

    const now = new Date();
    const periodEnd = this.addDays(now, selectedPlan.periodDays);
    const created = await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const subscription = await tx.membershipSubscription.create({
        data: {
          userId,
          planId: selectedPlan.id,
          outContractCode: this.wechat.createId("JBC"),
          status: "pending",
        },
      });
      const order = await tx.membershipOrder.create({
        data: {
          subscriptionId: subscription.id,
          userId,
          planId: selectedPlan.id,
          orderType: "initial",
          outTradeNo: this.wechat.createId("JBM"),
          status: "pending",
          amountFen: selectedPlan.amountFen,
          periodStart: now,
          periodEnd,
        },
      });
      return { subscription, order };
    });

    try {
      const remote = await this.requestPreSign(cfg, user.openid, selectedPlan, created.subscription.outContractCode);
      const preEntrustwebId = remote.pre_entrustweb_id || remote.preEntrustwebId;
      if (!preEntrustwebId) {
        await this.markPreSignFailed(created.subscription.id, created.order.id, remote.message || remote.code || "Wechat pre-sign response missing pre_entrustweb_id");
        throw new ServiceUnavailableException(remote.message || remote.code || "Wechat pre-sign response missing pre_entrustweb_id");
      }
      return {
        success: true,
        data: {
          subscription: this.toSubscriptionResponse(created.subscription, selectedPlan),
          order: this.toOrderResponse(created.order, selectedPlan),
          mini_program: {
            app_id: remote.appid || remote.app_id || remote.appId || this.wechat.readEnv("WECHAT_PAPAY_SIGN_APP_ID"),
            path: remote.path || remote.mini_program_path || this.wechat.readEnv("WECHAT_PAPAY_SIGN_PATH"),
            extra_data: { pre_entrustweb_id: preEntrustwebId },
          },
        },
      };
    } catch (error: unknown) {
      await this.markPreSignFailed(created.subscription.id, created.order.id, error instanceof Error ? error.message : "Wechat pre-sign failed");
      throw error;
    }
  }

  async handleContractNotify(body: unknown, headers: IncomingHttpHeaders, rawBody: string) {
    const cfg = this.wechat.requirePapayConfig();
    this.wechat.verifySignature(cfg, headers, rawBody);
    const decrypted = this.wechat.decryptNotifyResource<WechatContractNotify>(cfg, body as WechatPayNotifyBody);
    const eventId = this.eventId(body, decrypted, "contract");
    const stored = await this.storeEventOnce(eventId, this.eventType(body, "contract"), decrypted);
    if (!stored) {
      return { code: "SUCCESS", message: "成功" };
    }

    await this.applyContractEvent(decrypted);
    return { code: "SUCCESS", message: "成功" };
  }

  async handleTransactionNotify(body: unknown, headers: IncomingHttpHeaders, rawBody: string) {
    const cfg = this.wechat.requirePapayConfig();
    this.wechat.verifySignature(cfg, headers, rawBody);
    const decrypted = this.wechat.decryptNotifyResource<WechatTransactionNotify>(cfg, body as WechatPayNotifyBody);
    const eventId = this.eventId(body, decrypted, "transaction");
    const stored = await this.storeEventOnce(eventId, this.eventType(body, "transaction"), decrypted);
    if (!stored) {
      return { code: "SUCCESS", message: "成功" };
    }

    await this.applyTransactionEvent(decrypted);
    return { code: "SUCCESS", message: "成功" };
  }

  async cancelMine(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    const subscription = await this.findCurrentSubscription(userId);
    if (!subscription) {
      throw new NotFoundException("Membership subscription not found");
    }
    return { success: true, data: await this.cancelSubscription(subscription.id, "用户取消自动续费") };
  }

  async adminListMemberships() {
    const subscriptions = await this.prisma.membershipSubscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { plan: true },
    });
    return { success: true, data: { items: subscriptions.map((item) => this.toSubscriptionResponse(item, item.plan)) } };
  }

  async adminGetMembership(id: string) {
    const subscription = await this.prisma.membershipSubscription.findUnique({
      where: { id },
      include: { plan: true, orders: { orderBy: { createdAt: "desc" }, take: 20 } },
    });
    if (!subscription) {
      throw new NotFoundException("Membership subscription not found");
    }
    return {
      success: true,
      data: {
        subscription: this.toSubscriptionResponse(subscription, subscription.plan),
        orders: subscription.orders.map((order) => this.toOrderResponse(order, subscription.plan)),
      },
    };
  }

  async adminCancelMembership(id: string) {
    return { success: true, data: await this.cancelSubscription(id, "客服取消自动续费") };
  }

  async adminRefundOrder(orderId: string, reason?: string) {
    const order = await this.prisma.membershipOrder.findUnique({
      where: { id: orderId },
      include: { plan: true, subscription: true },
    });
    if (!order) {
      throw new NotFoundException("Membership order not found");
    }
    if (order.status !== "paid") {
      throw new BadRequestException("Only paid membership orders can be refunded");
    }
    const existing = await this.prisma.membershipRefund.findFirst({
      where: { membershipOrderId: order.id, status: { in: ["processing", "succeeded"] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return { success: true, data: this.toRefundResponse(existing) };
    }

    const refundable = this.refundableAmountFen(order);
    if (refundable <= 0) {
      throw new BadRequestException("No refundable membership period remains");
    }

    const cfg = this.wechat.requirePapayConfig();
    const refund = await this.prisma.membershipRefund.create({
      data: {
        membershipOrderId: order.id,
        outRefundNo: this.wechat.createId("JBMR"),
        status: "processing",
        amountFen: refundable,
        reason: this.normalizeReason(reason),
      },
    });

    const body = JSON.stringify({
      out_trade_no: order.outTradeNo,
      out_refund_no: refund.outRefundNo,
      reason: refund.reason ?? "会员退款",
      notify_url: this.wechat.readEnv("WECHAT_PAPAY_REFUND_NOTIFY_URL") || this.wechat.readEnv("WECHAT_PAY_REFUND_NOTIFY_URL") || cfg.notifyUrl,
      amount: {
        refund: refundable,
        total: order.amountFen,
        currency: "CNY",
      },
    });
    try {
      const remote = await this.wechat.fetch<WechatRefundResponse>(cfg, "POST", "/v3/refund/domestic/refunds", body);
      const applied = await this.applyRefundRemote(refund.id, remote);
      return { success: true, data: this.toRefundResponse(applied) };
    } catch (error: unknown) {
      await this.prisma.membershipRefund.update({
        where: { id: refund.id },
        data: {
          status: "failed",
          failureReason: error instanceof Error ? error.message : "Wechat membership refund failed",
        },
      });
      throw error;
    }
  }

  async renewSubscription(subscriptionId: string) {
    const subscription = await this.prisma.membershipSubscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });
    if (!subscription || !subscription.currentPeriodEnd) return;

    const now = new Date();
    if (subscription.cancelAtPeriodEnd) {
      if (subscription.currentPeriodEnd.getTime() <= now.getTime()) {
        await this.prisma.membershipSubscription.update({
          where: { id: subscription.id },
          data: { status: "canceled", nextRenewAt: null },
        });
        return;
      }
      await this.enqueueRenewal(subscription.id, subscription.currentPeriodEnd);
      return;
    }

    if (subscription.currentPeriodEnd.getTime() <= now.getTime()) {
      const paidFuture = await this.prisma.membershipOrder.findFirst({
        where: { subscriptionId, status: "paid", periodEnd: { gt: now } },
        orderBy: { periodEnd: "desc" },
      });
      if (!paidFuture) {
        await this.prisma.membershipSubscription.update({
          where: { id: subscription.id },
          data: { status: "expired", nextRenewAt: null },
        });
      }
      return;
    }

    if (!subscription.contractId) return;
    const existing = await this.prisma.membershipOrder.findFirst({
      where: {
        subscriptionId,
        orderType: "renewal",
        periodStart: subscription.currentPeriodEnd,
        status: { in: ["pending", "accepted", "paid"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return;
    }

    const order = await this.prisma.membershipOrder.create({
      data: {
        subscriptionId: subscription.id,
        userId: subscription.userId,
        planId: subscription.planId,
        orderType: "renewal",
        outTradeNo: this.wechat.createId("JBM"),
        status: "pending",
        amountFen: subscription.plan.amountFen,
        periodStart: subscription.currentPeriodEnd,
        periodEnd: this.addDays(subscription.currentPeriodEnd, subscription.plan.periodDays),
      },
    });

    try {
      await this.requestMembershipCharge(this.wechat.requirePapayConfig(), subscription.contractId, order, subscription.plan);
      await this.prisma.membershipOrder.update({ where: { id: order.id }, data: { status: "accepted" } });
    } catch (error: unknown) {
      await this.prisma.$transaction([
        this.prisma.membershipOrder.update({
          where: { id: order.id },
          data: { status: "failed", failureReason: error instanceof Error ? error.message : "Wechat renewal request failed" },
        }),
        this.prisma.membershipSubscription.update({
          where: { id: subscription.id },
          data: { status: "renewal_failed", nextRenewAt: subscription.currentPeriodEnd },
        }),
      ]);
    }
    await this.enqueueRenewal(subscription.id, subscription.currentPeriodEnd);
  }

  private async applyContractEvent(event: WechatContractNotify) {
    const outContractCode = event.out_contract_code;
    if (!outContractCode) {
      throw new BadRequestException("Missing out_contract_code");
    }
    const subscription = await this.prisma.membershipSubscription.findUnique({
      where: { outContractCode },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException("Membership subscription not found");
    }

    if (this.isContractCanceled(event)) {
      await this.prisma.membershipSubscription.update({
        where: { id: subscription.id },
        data: {
          status: this.isSubscriptionActive(subscription) ? "canceling" : "canceled",
          cancelAtPeriodEnd: true,
          canceledAt: new Date(),
          nextRenewAt: null,
        },
      });
      return;
    }

    if (!this.isContractSigned(event)) return;
    const updated = await this.prisma.membershipSubscription.update({
      where: { id: subscription.id },
      data: {
        contractId: event.contract_id ?? subscription.contractId,
        status: "pending_payment",
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: { plan: true },
    });
    if (!updated.contractId) return;

    const order = await this.prisma.membershipOrder.findFirst({
      where: { subscriptionId: updated.id, orderType: "initial", status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    if (!order) return;

    try {
      await this.requestMembershipCharge(this.wechat.requirePapayConfig(), updated.contractId, order, updated.plan);
      await this.prisma.membershipOrder.update({ where: { id: order.id }, data: { status: "accepted" } });
    } catch (error: unknown) {
      await this.prisma.$transaction([
        this.prisma.membershipOrder.update({
          where: { id: order.id },
          data: { status: "failed", failureReason: error instanceof Error ? error.message : "Wechat membership charge failed" },
        }),
        this.prisma.membershipSubscription.update({
          where: { id: updated.id },
          data: { status: "failed", nextRenewAt: null },
        }),
      ]);
    }
  }

  private async applyTransactionEvent(event: WechatTransactionNotify) {
    if (!event.out_trade_no) {
      throw new BadRequestException("Missing out_trade_no");
    }
    const status = String(event.trade_state ?? event.transaction_state ?? "").trim().toUpperCase();
    if (status !== "SUCCESS") {
      await this.markMembershipOrderFailed(event.out_trade_no, event.fail_reason || status || "membership payment not successful");
      return;
    }
    await this.applyPaidMembershipOrder(event);
  }

  private async applyPaidMembershipOrder(event: WechatTransactionNotify) {
    const outTradeNo = event.out_trade_no;
    if (!outTradeNo) throw new BadRequestException("Missing out_trade_no");
    const now = new Date();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const order = await tx.membershipOrder.findUnique({
        where: { outTradeNo },
        include: { subscription: true, plan: true },
      });
      if (!order) {
        throw new NotFoundException("Membership order not found");
      }
      if (order.status === "paid" || order.status === "refunded") {
        return;
      }
      if (Number(event.amount?.total) !== order.amountFen) {
        throw new BadRequestException("Membership payment amount mismatch");
      }
      await tx.membershipOrder.update({
        where: { id: order.id },
        data: {
          status: "paid",
          wxTransactionId: event.transaction_id,
          paidAt: now,
          failureReason: null,
        },
      });
      await tx.membershipSubscription.update({
        where: { id: order.subscriptionId },
        data: {
          status: "active",
          currentPeriodStart: order.periodStart,
          currentPeriodEnd: order.periodEnd,
          nextRenewAt: this.nextRenewAt(order.periodEnd),
          cancelAtPeriodEnd: false,
          canceledAt: null,
        },
      });
    });

    const latest = await this.prisma.membershipOrder.findUnique({ where: { outTradeNo } });
    if (latest) {
      await this.enqueueRenewal(latest.subscriptionId, this.nextRenewAt(latest.periodEnd));
    }
  }

  private async requestPreSign(
    cfg: WechatPayConfig,
    openid: string,
    plan: MembershipPlanRow,
    outContractCode: string,
  ) {
    const body = JSON.stringify({
      appid: cfg.appId,
      mchid: cfg.mchId,
      plan_id: Number(this.wechat.readEnv("WECHAT_PAPAY_SERVICE_ID")) || this.wechat.readEnv("WECHAT_PAPAY_SERVICE_ID"),
      out_contract_code: outContractCode,
      contract_display_account: openid,
      notify_url: this.wechat.readEnv("WECHAT_PAPAY_CONTRACT_NOTIFY_URL"),
      openid,
      amount: { total: plan.amountFen, currency: "CNY" },
    });
    const path = this.wechat.readEnv("WECHAT_PAPAY_PRE_SIGN_PATH") ||
      "/v3/password-exempt-contract/contracts/normal/pre-entrust-sign/mini-program";
    return this.wechat.fetch<WechatPapayPreSignResponse>(cfg, "POST", path, body);
  }

  private async requestMembershipCharge(
    cfg: WechatPayConfig,
    contractId: string,
    order: MembershipOrderRow,
    plan: MembershipPlanRow,
  ) {
    const body = JSON.stringify({
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: `即变${plan.name}`,
      out_trade_no: order.outTradeNo,
      contract_id: contractId,
      notify_url: this.wechat.readEnv("WECHAT_PAPAY_TRANSACTION_NOTIFY_URL"),
      amount: { total: order.amountFen, currency: "CNY" },
    });
    const path = this.wechat.readEnv("WECHAT_PAPAY_APPLY_PATH") || "/v3/papay/pay/transactions/apply";
    return this.wechat.fetch(cfg, "POST", path, body);
  }

  private async cancelSubscription(id: string, reason: string) {
    const subscription = await this.prisma.membershipSubscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException("Membership subscription not found");
    }
    if (!subscription.contractId) {
      const updated = await this.prisma.membershipSubscription.update({
        where: { id },
        data: { status: "canceled", cancelAtPeriodEnd: true, canceledAt: new Date(), nextRenewAt: null },
        include: { plan: true },
      });
      return this.toSubscriptionResponse(updated, updated.plan);
    }

    const cfg = this.wechat.requirePapayConfig();
    const pathTemplate = this.wechat.readEnv("WECHAT_PAPAY_CANCEL_PATH_TEMPLATE") ||
      "/v3/papay/contracts/{contract_id}/terminate";
    const path = pathTemplate.replace("{contract_id}", encodeURIComponent(subscription.contractId));
    await this.wechat.fetch(cfg, "POST", path, JSON.stringify({
      appid: cfg.appId,
      mchid: cfg.mchId,
      contract_termination_remark: reason,
    }));
    const updated = await this.prisma.membershipSubscription.update({
      where: { id },
      data: {
        status: this.isSubscriptionActive(subscription) ? "canceling" : "canceled",
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
        nextRenewAt: null,
      },
      include: { plan: true },
    });
    return this.toSubscriptionResponse(updated, updated.plan);
  }

  private async applyRefundRemote(refundId: string, remote: WechatRefundResponse) {
    const status = this.normalizeRefundStatus(remote.status);
    const now = new Date();
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const refund = await tx.membershipRefund.update({
        where: { id: refundId },
        data: {
          status,
          wxRefundId: remote.refund_id,
          failureReason: status === "failed" ? (remote.message || remote.code || remote.status || "Wechat membership refund failed") : null,
          succeededAt: status === "succeeded" ? now : undefined,
        },
      });
      if (status === "succeeded") {
        const order = await tx.membershipOrder.update({
          where: { id: refund.membershipOrderId },
          data: { status: "refunded" },
        });
        await tx.membershipSubscription.update({
          where: { id: order.subscriptionId },
          data: {
            status: "refunded",
            currentPeriodEnd: now,
            nextRenewAt: null,
            cancelAtPeriodEnd: true,
            canceledAt: now,
          },
        });
      }
      return refund;
    });
  }

  private async markMembershipOrderFailed(outTradeNo: string, reason: string) {
    const now = new Date();
    const order = await this.prisma.membershipOrder.update({
      where: { outTradeNo },
      data: { status: "failed", failureReason: reason },
    });
    const subscription = await this.prisma.membershipSubscription.findUnique({ where: { id: order.subscriptionId } });
    if (!subscription?.currentPeriodEnd || subscription.currentPeriodEnd.getTime() <= now.getTime()) {
      await this.prisma.membershipSubscription.update({
        where: { id: order.subscriptionId },
        data: { status: "expired", nextRenewAt: null },
      });
    }
  }

  private async requirePlan(planId: string | undefined): Promise<MembershipPlanRow> {
    const normalized = String(planId ?? "").trim();
    if (!normalized) {
      throw new BadRequestException("Missing plan_id");
    }
    const plan = await this.prisma.membershipPlan.findFirst({
      where: { OR: [{ id: normalized }, { code: normalized }], status: "active" },
    });
    if (!plan) {
      throw new NotFoundException("Membership plan not found");
    }
    return plan;
  }

  private async findCurrentSubscription(userId: string) {
    return this.prisma.membershipSubscription.findFirst({
      where: {
        userId,
        status: { in: ["pending", "pending_payment", "active", "canceling", "renewal_failed"] },
      },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
  }

  private isSubscriptionActive(subscription: MembershipSubscriptionRow | null) {
    return Boolean(
      subscription?.currentPeriodEnd &&
      ACTIVE_STATUSES.has(subscription.status) &&
      subscription.currentPeriodEnd.getTime() > Date.now(),
    );
  }

  private async enqueueRenewal(subscriptionId: string, runAt: Date | null) {
    if (!runAt || !this.renewalQueue) return;
    const delay = Math.max(0, runAt.getTime() - Date.now());
    await this.renewalQueue.add("renew", { subscriptionId }, {
      jobId: `membership-renewal:${subscriptionId}:${runAt.getTime()}`,
      delay,
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    });
  }

  private nextRenewAt(periodEnd: Date) {
    const early = new Date(periodEnd.getTime() - RENEWAL_LEAD_MS);
    return early.getTime() > Date.now() ? early : periodEnd;
  }

  private addDays(date: Date, days: number) {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private eventId(body: unknown, decrypted: Record<string, unknown>, prefix: string) {
    const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
    return String(source.id || decrypted.id || decrypted.out_trade_no || decrypted.out_contract_code || `${prefix}:${Date.now()}`);
  }

  private eventType(body: unknown, fallback: string) {
    const source = body && typeof body === "object" ? body as Record<string, unknown> : {};
    return String(source.event_type || fallback).slice(0, 64);
  }

  private async storeEventOnce(eventId: string, eventType: string, payload: unknown) {
    try {
      await this.prisma.wechatMembershipEvent.create({
        data: { eventId, eventType, payload: payload as object },
      });
      return true;
    } catch (error: unknown) {
      if (typeof error === "object" && error && (error as { code?: string }).code === "P2002") {
        return false;
      }
      throw error;
    }
  }

  private isContractSigned(event: WechatContractNotify) {
    const status = String(event.contract_state || event.contract_status || event.state || "").trim().toUpperCase();
    return Boolean(event.contract_id) || ["SIGNED", "EFFECTIVE", "NORMAL"].includes(status);
  }

  private isContractCanceled(event: WechatContractNotify) {
    const status = String(event.contract_state || event.contract_status || event.state || event.operate_type || "").trim().toUpperCase();
    return ["TERMINATED", "CANCELED", "CANCELLED", "UNSIGNED", "STOPPED", "REVOKED", "DELETE"].includes(status);
  }

  private refundableAmountFen(order: MembershipOrderRow) {
    const totalMs = order.periodEnd.getTime() - order.periodStart.getTime();
    const remainingMs = order.periodEnd.getTime() - Date.now();
    if (totalMs <= 0 || remainingMs <= 0) return 0;
    return Math.floor(order.amountFen * Math.min(remainingMs, totalMs) / totalMs);
  }

  private normalizeRefundStatus(status: string | undefined) {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (normalized === "SUCCESS") return "succeeded";
    if (normalized === "ABNORMAL" || normalized === "CLOSED") return "failed";
    return "processing";
  }

  private normalizeReason(reason: string | undefined) {
    const normalized = String(reason ?? "").trim();
    return normalized ? normalized.slice(0, 80) : "会员退款";
  }

  private async markPreSignFailed(subscriptionId: string, orderId: string, reason: string) {
    await this.prisma.$transaction([
      this.prisma.membershipSubscription.update({
        where: { id: subscriptionId },
        data: { status: "failed", nextRenewAt: null },
      }),
      this.prisma.membershipOrder.update({
        where: { id: orderId },
        data: { status: "failed", failureReason: reason },
      }),
    ]);
  }

  private toPlanResponse(plan: MembershipPlanRow) {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      amount_fen: plan.amountFen,
      amount_yuan: Number((plan.amountFen / 100).toFixed(2)),
      period_days: plan.periodDays,
      status: plan.status,
    };
  }

  private toMembershipStatus(subscription: MembershipSubscriptionRow | null) {
    return {
      active: this.isSubscriptionActive(subscription),
      status: subscription?.status ?? "none",
      plan: subscription?.plan ? this.toPlanResponse(subscription.plan) : null,
      current_period_end: subscription?.currentPeriodEnd ?? null,
      auto_renewing: Boolean(subscription && !subscription.cancelAtPeriodEnd && subscription.contractId && this.isSubscriptionActive(subscription)),
      cancel_at_period_end: subscription?.cancelAtPeriodEnd ?? false,
    };
  }

  private toSubscriptionResponse(subscription: MembershipSubscriptionRow, plan?: MembershipPlanRow) {
    return {
      id: subscription.id,
      user_id: subscription.userId,
      plan: plan ? this.toPlanResponse(plan) : null,
      status: subscription.status,
      out_contract_code: subscription.outContractCode,
      contract_id: subscription.contractId,
      current_period_start: subscription.currentPeriodStart,
      current_period_end: subscription.currentPeriodEnd,
      next_renew_at: subscription.nextRenewAt,
      auto_renewing: Boolean(!subscription.cancelAtPeriodEnd && subscription.contractId && this.isSubscriptionActive(subscription)),
      cancel_at_period_end: subscription.cancelAtPeriodEnd,
      canceled_at: subscription.canceledAt,
    };
  }

  private toOrderResponse(order: MembershipOrderRow, plan?: MembershipPlanRow) {
    return {
      id: order.id,
      subscription_id: order.subscriptionId,
      user_id: order.userId,
      plan: plan ? this.toPlanResponse(plan) : null,
      order_type: order.orderType,
      out_trade_no: order.outTradeNo,
      status: order.status,
      amount_fen: order.amountFen,
      amount_yuan: Number((order.amountFen / 100).toFixed(2)),
      period_start: order.periodStart,
      period_end: order.periodEnd,
      paid_at: order.paidAt,
      failure_reason: order.failureReason,
    };
  }

  private toRefundResponse(refund: {
    id: string;
    membershipOrderId: string;
    outRefundNo: string;
    wxRefundId: string | null;
    status: string;
    amountFen: number;
    reason: string | null;
    failureReason: string | null;
    succeededAt: Date | null;
  }) {
    return {
      id: refund.id,
      membership_order_id: refund.membershipOrderId,
      out_refund_no: refund.outRefundNo,
      wx_refund_id: refund.wxRefundId,
      status: refund.status,
      amount_fen: refund.amountFen,
      amount_yuan: Number((refund.amountFen / 100).toFixed(2)),
      reason: refund.reason,
      failure_reason: refund.failureReason,
      succeeded_at: refund.succeededAt,
    };
  }
}
