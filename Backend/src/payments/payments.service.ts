import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDecipheriv, createSign, createVerify, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";
import { CreditPackage, creditPackages, findCreditPackage } from "./payment-packages";

const DEFAULT_NOTIFY_MAX_SKEW_SECONDS = 5 * 60;

type WechatPayConfig = Readonly<{
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  privateKey: string;
  apiV3Key: string;
  notifyUrl: string;
  apiBaseUrl: string;
  platformCert: string;
  platformSerialNo: string;
}>;

type WechatPrepayResponse = {
  prepay_id?: string;
  message?: string;
  code?: string;
};

type WechatQueryResponse = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  amount?: { total?: number };
};

type WechatRefundResponse = {
  refund_id?: string;
  out_refund_no?: string;
  status?: string;
  amount?: { refund?: number; total?: number };
  message?: string;
  code?: string;
};

type WechatNotifyBody = {
  resource?: {
    associated_data?: string;
    nonce?: string;
    ciphertext?: string;
  };
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  listPackages() {
    return creditPackages.map((item) => ({
      id: item.id,
      label: item.label,
      amount_fen: item.amountFen,
      amount_yuan: Number((item.amountFen / 100).toFixed(2)),
      credits: item.credits,
      badge: item.badge ?? "",
    }));
  }

  getWechatPayStatus() {
    if (this.config.get<string>("WECHAT_PAY_ENABLED") !== "true") {
      return {
        enabled: false,
        reason: "disabled",
        message: "微信支付暂未开放，请先使用兑换码获取积分。",
      };
    }

    if (!this.hasWechatPayConfig()) {
      return {
        enabled: false,
        reason: "missing_config",
        message: "微信支付配置未完成，请先使用兑换码获取积分。",
      };
    }

    try {
      const cfg = this.requireWechatPayConfig();
      if (!cfg.privateKey || !cfg.platformCert) {
        return {
          enabled: false,
          reason: "missing_config",
          message: "微信支付配置未完成，请先使用兑换码获取积分。",
        };
      }
    } catch {
      return {
        enabled: false,
        reason: "missing_config",
        message: "微信支付配置未完成，请先使用兑换码获取积分。",
      };
    }

    return {
      enabled: true,
      reason: "ready",
      message: "微信支付已开放。",
    };
  }

  async createWechatOrder(userId: string, packageId: string | undefined) {
    const selected = this.requirePackage(packageId);
    const cfg = this.requireWechatPayConfig();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, openid: true, status: true },
    });
    if (!user || user.status !== "active") {
      throw new NotFoundException("User not found");
    }

    const order = await this.prisma.paymentOrder.create({
      data: {
        userId: user.id,
        packageId: selected.id,
        outTradeNo: this.createOutTradeNo(),
        status: "pending",
        amountFen: selected.amountFen,
        credits: selected.credits,
      },
    });

    const body = JSON.stringify({
      appid: cfg.appId,
      mchid: cfg.mchId,
      description: `即变${selected.label}`,
      out_trade_no: order.outTradeNo,
      notify_url: cfg.notifyUrl,
      amount: { total: selected.amountFen, currency: "CNY" },
      payer: { openid: user.openid },
    });
    let response: WechatPrepayResponse;
    try {
      response = await this.wechatFetch<WechatPrepayResponse>(cfg, "POST", "/v3/pay/transactions/jsapi", body);
    } catch (error: unknown) {
      await this.markPaymentFailed(order.id, error instanceof Error ? error.message : "Wechat prepay failed");
      throw error;
    }
    if (!response.prepay_id) {
      await this.markPaymentFailed(order.id, response.message || response.code || "Wechat prepay failed");
      throw new ServiceUnavailableException(response.message || response.code || "Wechat prepay failed");
    }

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: { prepayId: response.prepay_id, updatedAt: new Date() },
    });

    return {
      success: true,
      data: {
        id: order.id,
        out_trade_no: order.outTradeNo,
        status: "pending",
        amount_fen: selected.amountFen,
        amount_yuan: Number((selected.amountFen / 100).toFixed(2)),
        credits: selected.credits,
        payment: this.createClientPayParams(cfg, response.prepay_id),
      },
    };
  }

  async getWechatOrderForUser(userId: string, outTradeNo: string) {
    const order = await this.prisma.paymentOrder.findFirst({
      where: { userId, outTradeNo },
    });
    if (!order) {
      throw new NotFoundException("Payment order not found");
    }

    if (order.status === "pending" && this.hasWechatPayConfig()) {
      try {
        const remote = await this.queryWechatOrder(outTradeNo);
        if (remote.trade_state === "SUCCESS") {
          await this.applyPaidOrder(remote);
        }
      } catch {
        // 查询失败不影响前端继续轮询本地订单状态
      }
    }

    const latest = await this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
    return { success: true, data: await this.toOrderResponse(latest ?? order) };
  }

  async handleWechatNotify(body: unknown, headers: IncomingHttpHeaders, rawBody: string) {
    this.verifyWechatPaySignature(headers, rawBody);
    const decrypted = this.decryptNotifyResource(body as WechatNotifyBody);
    if (decrypted.out_refund_no) {
      await this.applyRefundNotification(decrypted);
      return { code: "SUCCESS", message: "成功" };
    }

    if (!decrypted.out_trade_no) {
      throw new BadRequestException("Missing out_trade_no");
    }

    const remote = await this.queryWechatOrder(decrypted.out_trade_no);
    if (remote.trade_state === "SUCCESS") {
      await this.applyPaidOrder(remote);
    }

    return { code: "SUCCESS", message: "成功" };
  }

  async refundWechatPaymentOrder(paymentOrderId: string, reason?: string) {
    const cfg = this.requireWechatPayConfig();
    const existing = await this.prisma.paymentRefund.findFirst({
      where: {
        paymentOrderId,
        status: { in: ["processing", "succeeded"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return this.toRefundResponse(existing);
    }

    const order = await this.prisma.paymentOrder.findUnique({ where: { id: paymentOrderId } });
    if (!order) {
      throw new NotFoundException("Payment order not found");
    }
    if (order.status !== "paid") {
      throw new BadRequestException("Only paid orders can be refunded");
    }

    const refund = await this.prisma.paymentRefund.create({
      data: {
        paymentOrderId: order.id,
        outRefundNo: this.createOutRefundNo(),
        status: "processing",
        amountFen: order.amountFen,
        credits: order.credits,
        reason: this.normalizeRefundReason(reason),
      },
    });

    const body = JSON.stringify({
      out_trade_no: order.outTradeNo,
      out_refund_no: refund.outRefundNo,
      reason: refund.reason ?? "管理员退款",
      notify_url: this.readEnv("WECHAT_PAY_REFUND_NOTIFY_URL") || cfg.notifyUrl,
      amount: {
        refund: order.amountFen,
        total: order.amountFen,
        currency: "CNY",
      },
    });

    try {
      const remote = await this.wechatFetch<WechatRefundResponse>(cfg, "POST", "/v3/refund/domestic/refunds", body);
      return this.toRefundResponse(await this.applyRefundRemote(refund.id, remote));
    } catch (error: unknown) {
      await this.prisma.paymentRefund.update({
        where: { id: refund.id },
        data: {
          status: "failed",
          failureReason: error instanceof Error ? error.message : "Wechat refund failed",
          updatedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async applyPaidOrder(remote: WechatQueryResponse) {
    if (!remote.out_trade_no) {
      throw new BadRequestException("Missing out_trade_no");
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const order = await tx.paymentOrder.findUnique({
        where: { outTradeNo: remote.out_trade_no },
      });
      if (!order) {
        throw new NotFoundException("Payment order not found");
      }
      if (order.status === "paid" || order.status === "refunded" || order.status === "refund_processing") {
        return;
      }
      if (remote.trade_state !== "SUCCESS") {
        if (this.isTerminalWechatPayFailure(remote.trade_state)) {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: "failed", failureReason: remote.trade_state || "payment not successful", updatedAt: now },
          });
        }
        return;
      }
      if (Number(remote.amount?.total) !== order.amountFen) {
        throw new BadRequestException("Payment amount mismatch");
      }

      const existingRecharge = await tx.creditLedger.findFirst({
        where: {
          userId: order.userId,
          type: "recharge",
          refType: "payment_order",
          refId: order.id,
          amount: { gt: 0 },
        },
      });
      if (existingRecharge) {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: "paid",
            wxTransactionId: remote.transaction_id,
            paidAt: order.paidAt ?? now,
            updatedAt: now,
          },
        });
        return;
      }

      const account = await tx.creditAccount.findUnique({ where: { userId: order.userId } });
      const balanceAfter = (account?.balance ?? 0) + order.credits;
      await tx.creditAccount.upsert({
        where: { userId: order.userId },
        update: { balance: balanceAfter, updatedAt: now },
        create: { userId: order.userId, balance: balanceAfter, updatedAt: now },
      });
      await tx.creditLedger.create({
        data: {
          userId: order.userId,
          type: "recharge",
          amount: order.credits,
          refType: "payment_order",
          refId: order.id,
          balanceAfter,
        },
      });
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: "paid",
          wxTransactionId: remote.transaction_id,
          paidAt: now,
          updatedAt: now,
        },
      });
    });
  }

  private async applyRefundRemote(refundId: string, remote: WechatRefundResponse) {
    const status = this.normalizeRefundStatus(remote.status);
    const now = new Date();
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const refund = await tx.paymentRefund.update({
        where: { id: refundId },
        data: {
          status,
          wxRefundId: remote.refund_id,
          failureReason: status === "failed" ? (remote.message || remote.code || remote.status || "Wechat refund failed") : null,
          succeededAt: status === "succeeded" ? now : undefined,
          updatedAt: now,
        },
      });
      if (status === "succeeded") {
        await this.revokeRefundedCredits(tx, refund.paymentOrderId, now);
      }
      await tx.paymentOrder.update({
        where: { id: refund.paymentOrderId },
        data: {
          status: status === "succeeded" ? "refunded" : status === "failed" ? "paid" : "refund_processing",
          updatedAt: now,
        },
      });
      return refund;
    });
  }

  private async revokeRefundedCredits(
    tx: PrismaTransactionClient,
    paymentOrderId: string,
    now: Date,
  ) {
    const order = await tx.paymentOrder.findUnique({ where: { id: paymentOrderId } });
    if (!order) {
      throw new NotFoundException("Payment order not found");
    }

    const rechargeLedger = await tx.creditLedger.findFirst({
      where: {
        userId: order.userId,
        type: "recharge",
        refType: "payment_order",
        refId: order.id,
        amount: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });
    if (!rechargeLedger) {
      return;
    }

    const existingReversal = await tx.creditLedger.findFirst({
      where: { refType: "order_refund", refId: rechargeLedger.id },
    });
    if (existingReversal) {
      return;
    }

    const account = await tx.creditAccount.findUnique({ where: { userId: order.userId } });
    const balance = account?.balance ?? 0;
    const balanceAfter = balance - rechargeLedger.amount;
    await tx.creditAccount.update({
      where: { userId: order.userId },
      data: { balance: balanceAfter, updatedAt: now },
    });
    await tx.creditLedger.create({
      data: {
        userId: order.userId,
        type: "adjustment",
        amount: -rechargeLedger.amount,
        refType: "order_refund",
        refId: rechargeLedger.id,
        balanceAfter,
      },
    });
  }

  private async applyRefundNotification(remote: WechatRefundResponse) {
    if (!remote.out_refund_no) {
      throw new BadRequestException("Missing out_refund_no");
    }

    const refund = await this.prisma.paymentRefund.findUnique({
      where: { outRefundNo: remote.out_refund_no },
    });
    if (!refund) {
      throw new NotFoundException("Payment refund not found");
    }
    await this.applyRefundRemote(refund.id, remote);
  }

  private async toOrderResponse(order: {
    id: string;
    userId: string;
    outTradeNo: string;
    packageId: string;
    status: string;
    amountFen: number;
    credits: number;
    paidAt: Date | null;
    failureReason: string | null;
  }) {
    const account = await this.prisma.creditAccount.findUnique({ where: { userId: order.userId } });
    return {
      id: order.id,
      out_trade_no: order.outTradeNo,
      package_id: order.packageId,
      status: order.status,
      amount_fen: order.amountFen,
      amount_yuan: Number((order.amountFen / 100).toFixed(2)),
      credits: order.credits,
      paid_at: order.paidAt,
      failure_reason: order.failureReason,
      ...(account ? { balance: account.balance } : {}),
    };
  }

  private toRefundResponse(refund: {
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
      succeeded_at: refund.succeededAt,
    };
  }

  private decryptNotifyResource(body: WechatNotifyBody): WechatQueryResponse & WechatRefundResponse {
    const resource = body?.resource;
    if (!resource?.ciphertext || !resource.nonce) {
      throw new BadRequestException("Invalid Wechat Pay notification");
    }

    const apiV3Key = this.requireWechatPayConfig().apiV3Key;
    const encrypted = Buffer.from(resource.ciphertext, "base64");
    const authTag = encrypted.subarray(encrypted.length - 16);
    const data = encrypted.subarray(0, encrypted.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(apiV3Key, "utf8"), Buffer.from(resource.nonce, "utf8"));
    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
    }
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted) as WechatQueryResponse & WechatRefundResponse;
  }

  private verifyWechatPaySignature(headers: IncomingHttpHeaders, rawBody: string) {
    const cfg = this.requireWechatPayConfig();
    const timestamp = this.headerValue(headers, "wechatpay-timestamp");
    const nonce = this.headerValue(headers, "wechatpay-nonce");
    const signature = this.headerValue(headers, "wechatpay-signature");
    const serial = this.headerValue(headers, "wechatpay-serial");

    if (!timestamp || !nonce || !signature) {
      throw new BadRequestException("Invalid Wechat Pay signature headers");
    }
    if (cfg.platformSerialNo && serial && cfg.platformSerialNo !== serial) {
      throw new BadRequestException("Wechat Pay platform serial mismatch");
    }
    this.assertFreshWechatPayTimestamp(timestamp);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`);
    verifier.end();
    if (!verifier.verify(cfg.platformCert, signature, "base64")) {
      throw new BadRequestException("Invalid Wechat Pay signature");
    }
  }

  private createClientPayParams(cfg: WechatPayConfig, prepayId: string) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.nonce();
    const packageValue = `prepay_id=${prepayId}`;
    const paySign = this.rsaSign(cfg.privateKey, `${cfg.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`);
    return {
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: "RSA",
      paySign,
    };
  }

  private async queryWechatOrder(outTradeNo: string) {
    const cfg = this.requireWechatPayConfig();
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(cfg.mchId)}`;
    return this.wechatFetch<WechatQueryResponse>(cfg, "GET", path, "");
  }

  private async wechatFetch<T>(cfg: WechatPayConfig, method: "GET" | "POST", path: string, body: string): Promise<T> {
    const response = await fetch(`${cfg.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: this.authorizationHeader(cfg, method, path, body),
      },
      ...(body ? { body } : {}),
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      const message = this.errorMessage(payload, `Wechat Pay request failed: ${response.status}`);
      throw new ServiceUnavailableException(message);
    }
    return payload as T;
  }

  private authorizationHeader(cfg: WechatPayConfig, method: string, path: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.nonce();
    const signature = this.rsaSign(cfg.privateKey, `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`);
    return [
      "WECHATPAY2-SHA256-RSA2048",
      `mchid="${cfg.mchId}"`,
      `nonce_str="${nonceStr}"`,
      `signature="${signature}"`,
      `timestamp="${timestamp}"`,
      `serial_no="${cfg.merchantSerialNo}"`,
    ].join(",");
  }

  private rsaSign(privateKey: string, message: string) {
    const sign = createSign("RSA-SHA256");
    sign.update(message);
    sign.end();
    return sign.sign(privateKey, "base64");
  }

  private requirePackage(packageId: string | undefined): CreditPackage {
    const selected = findCreditPackage(String(packageId ?? "").trim());
    if (!selected) {
      throw new BadRequestException("Invalid credit package");
    }
    return selected;
  }

  private requireWechatPayConfig(): WechatPayConfig {
    if (!this.hasWechatPayConfig()) {
      throw new ServiceUnavailableException("Wechat payment is not enabled");
    }

    return {
      appId: this.readEnv("WECHAT_PAY_APP_ID") || this.readEnv("WECHAT_APP_ID"),
      mchId: this.readEnv("WECHAT_PAY_MCH_ID"),
      merchantSerialNo: this.readEnv("WECHAT_PAY_MCH_SERIAL_NO"),
      privateKey: this.readPrivateKey(),
      apiV3Key: this.readEnv("WECHAT_PAY_API_V3_KEY"),
      notifyUrl: this.readEnv("WECHAT_PAY_NOTIFY_URL"),
      apiBaseUrl: this.readEnv("WECHAT_PAY_API_BASE_URL") || "https://api.mch.weixin.qq.com",
      platformCert: this.readPlatformCert(),
      platformSerialNo: this.readEnv("WECHAT_PAY_PLATFORM_SERIAL_NO"),
    };
  }

  private hasWechatPayConfig() {
    return (
      this.config.get<string>("WECHAT_PAY_ENABLED") === "true" &&
      Boolean(
        (this.readEnv("WECHAT_PAY_APP_ID") || this.readEnv("WECHAT_APP_ID")) &&
        this.readEnv("WECHAT_PAY_MCH_ID") &&
        this.readEnv("WECHAT_PAY_MCH_SERIAL_NO") &&
        (this.readEnv("WECHAT_PAY_PRIVATE_KEY") || this.readEnv("WECHAT_PAY_PRIVATE_KEY_PATH")) &&
        (this.readEnv("WECHAT_PAY_PLATFORM_CERT") || this.readEnv("WECHAT_PAY_PLATFORM_CERT_PATH")) &&
        this.readEnv("WECHAT_PAY_API_V3_KEY") &&
        this.readEnv("WECHAT_PAY_NOTIFY_URL"),
      )
    );
  }

  private readPrivateKey() {
    const inline = this.readEnv("WECHAT_PAY_PRIVATE_KEY");
    if (inline) {
      return inline.replace(/\\n/g, "\n");
    }
    const filePath = this.readEnv("WECHAT_PAY_PRIVATE_KEY_PATH");
    if (filePath) {
      return readFileSync(filePath, "utf8");
    }
    return "";
  }

  private readPlatformCert() {
    const inline = this.readEnv("WECHAT_PAY_PLATFORM_CERT");
    if (inline) {
      return inline.replace(/\\n/g, "\n");
    }
    const filePath = this.readEnv("WECHAT_PAY_PLATFORM_CERT_PATH");
    if (filePath) {
      return readFileSync(filePath, "utf8");
    }
    return "";
  }

  private headerValue(headers: IncomingHttpHeaders, key: string) {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }

  private assertFreshWechatPayTimestamp(timestamp: string) {
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
      throw new BadRequestException("Invalid Wechat Pay timestamp");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > this.notifyMaxSkewSeconds()) {
      throw new BadRequestException("Wechat Pay notification timestamp expired");
    }
  }

  private notifyMaxSkewSeconds() {
    const configured = Number(this.readEnv("WECHAT_PAY_NOTIFY_MAX_SKEW_SECONDS"));
    if (!Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_NOTIFY_MAX_SKEW_SECONDS;
    }
    return Math.floor(configured);
  }

  private readEnv(key: string) {
    return this.config.get<string>(key)?.trim() || "";
  }

  private createOutTradeNo() {
    return `JB${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private createOutRefundNo() {
    return `JBR${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private nonce() {
    return randomBytes(16).toString("hex");
  }

  private normalizeRefundStatus(status: string | undefined) {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (normalized === "SUCCESS") return "succeeded";
    if (normalized === "ABNORMAL" || normalized === "CLOSED") return "failed";
    return "processing";
  }

  private isTerminalWechatPayFailure(status: string | undefined) {
    return ["CLOSED", "REVOKED", "PAYERROR"].includes(String(status ?? "").trim().toUpperCase());
  }

  private normalizeRefundReason(reason: string | undefined) {
    const normalized = String(reason ?? "").trim();
    return normalized ? normalized.slice(0, 80) : "管理员退款";
  }

  private async markPaymentFailed(orderId: string, reason: string) {
    await this.prisma.paymentOrder.update({
      where: { id: orderId },
      data: { status: "failed", failureReason: reason, updatedAt: new Date() },
    });
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  private errorMessage(body: unknown, fallback: string) {
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      return String(record.message || record.code || fallback);
    }
    return String(body || fallback);
  }
}
