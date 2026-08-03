import { ConfigService } from "@nestjs/config";
import { createSign, generateKeyPairSync, randomUUID } from "node:crypto";
import { AdminOrdersService } from "../src/admin/admin-orders.service";
import { PaymentsService } from "../src/payments/payments.service";
import { WechatPayClient } from "../src/payments/wechat-pay.client";
import { PrismaService } from "../src/prisma/prisma.service";

type PaymentOrderRow = {
  id: string;
  userId: string;
  packageId: string;
  outTradeNo: string;
  status: string;
  amountFen: number;
  credits: number;
  wxTransactionId: string | null;
  paidAt: Date | null;
  failureReason: string | null;
  updatedAt: Date;
};

type CreditAccountRow = { userId: string; balance: number; updatedAt: Date };
type CreditLedgerRow = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  refType: string;
  refId: string;
  balanceAfter: number;
  createdAt: Date;
};
type PaymentRefundRow = {
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
};

class FakePaymentPrisma {
  readonly userId = "00000000-0000-4000-8000-000000000301";
  readonly orderId = "00000000-0000-4000-8000-000000000401";
  readonly paymentOrders: PaymentOrderRow[] = [{
    id: this.orderId,
    userId: this.userId,
    packageId: "value",
    outTradeNo: "JB-SMOKE-PAID",
    status: "pending",
    amountFen: 2990,
    credits: 328,
    wxTransactionId: null,
    paidAt: null,
    failureReason: null,
    updatedAt: new Date(),
  }];
  readonly paymentRefunds: PaymentRefundRow[] = [];
  readonly creditAccounts: CreditAccountRow[] = [{ userId: this.userId, balance: 10, updatedAt: new Date() }];
  readonly ledgerRows: CreditLedgerRow[] = [];

  paymentOrder = {
    findUnique: async (args: { where: { id?: string; outTradeNo?: string } }) =>
      this.paymentOrders.find((row) => (
        (args.where.id && row.id === args.where.id) ||
        (args.where.outTradeNo && row.outTradeNo === args.where.outTradeNo)
      )) ?? null,
    update: async (args: { where: { id: string }; data: Partial<PaymentOrderRow> }) => {
      const row = this.required(this.paymentOrders.find((item) => item.id === args.where.id), "paymentOrder");
      Object.assign(row, args.data);
      return row;
    },
  };

  paymentRefund = {
    findFirst: async (args: { where: { paymentOrderId: string; status?: { in: string[] } } }) =>
      this.paymentRefunds.find((row) => (
        row.paymentOrderId === args.where.paymentOrderId &&
        (!args.where.status || args.where.status.in.includes(row.status))
      )) ?? null,
    findUnique: async (args: { where: { outRefundNo?: string; id?: string } }) =>
      this.paymentRefunds.find((row) => (
        (args.where.id && row.id === args.where.id) ||
        (args.where.outRefundNo && row.outRefundNo === args.where.outRefundNo)
      )) ?? null,
    create: async (args: { data: Omit<PaymentRefundRow, "id" | "wxRefundId" | "failureReason" | "succeededAt" | "createdAt" | "updatedAt"> }) => {
      const now = new Date();
      const row: PaymentRefundRow = {
        id: randomUUID(),
        wxRefundId: null,
        failureReason: null,
        succeededAt: null,
        createdAt: now,
        updatedAt: now,
        ...args.data,
      };
      this.paymentRefunds.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Partial<PaymentRefundRow> }) => {
      const row = this.required(this.paymentRefunds.find((item) => item.id === args.where.id), "paymentRefund");
      Object.assign(row, args.data);
      return row;
    },
  };

  creditAccount = {
    findUnique: async (args: { where: { userId: string } }) =>
      this.creditAccounts.find((row) => row.userId === args.where.userId) ?? null,
    update: async (args: { where: { userId: string }; data: Partial<CreditAccountRow> }) => {
      const row = this.required(this.creditAccounts.find((item) => item.userId === args.where.userId), "creditAccount");
      Object.assign(row, args.data);
      return row;
    },
    upsert: async (args: {
      where: { userId: string };
      update: { balance: number; updatedAt: Date };
      create: { userId: string; balance: number; updatedAt: Date };
    }) => {
      const existing = this.creditAccounts.find((row) => row.userId === args.where.userId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      this.creditAccounts.push(args.create);
      return args.create;
    },
  };

  creditLedger = {
    findFirst: async (args: {
      where: {
        userId?: string;
        id?: string;
        type?: { in: string[] } | string;
        amount?: { gt: number };
        refType?: string;
        refId?: string;
      };
    }) => {
      const row = this.ledgerRows.find((item) => (
        (!args.where.userId || item.userId === args.where.userId) &&
        (!args.where.id || item.id === args.where.id) &&
        (!args.where.type || (typeof args.where.type === "string" ? item.type === args.where.type : args.where.type.in.includes(item.type))) &&
        (!args.where.amount || item.amount > args.where.amount.gt) &&
        (!args.where.refType || item.refType === args.where.refType) &&
        (!args.where.refId || item.refId === args.where.refId)
      ));
      return row ? { ...row, user: { nickname: null, phone: null } } : null;
    },
    create: async (args: { data: Omit<CreditLedgerRow, "id" | "createdAt"> }) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.ledgerRows.push(row);
      return row;
    },
  };

  async $transaction<T>(operation: (tx: this) => Promise<T>) {
    return operation(this);
  }

  private required<T>(value: T | undefined, label: string): T {
    if (!value) throw new Error(`Missing ${label}`);
    return value;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function wechatClient(values: Record<string, string>) {
  return new WechatPayClient(new ConfigService(values));
}

async function main() {
  const prisma = new FakePaymentPrisma();
  const service = new PaymentsService(
    prisma as unknown as PrismaService,
    wechatClient({}),
  );
  const disabledStatus = service.getWechatPayStatus();
  assert(disabledStatus.enabled === false, "wechat pay status should be disabled without config");
  assert(disabledStatus.reason === "disabled", "wechat pay status should explain disabled flag");
  const applyPaidOrder = (service as unknown as {
    applyPaidOrder(remote: {
      out_trade_no: string;
      transaction_id: string;
      trade_state: string;
      amount: { total: number };
    }): Promise<void>;
  }).applyPaidOrder.bind(service);

  await applyPaidOrder({
    out_trade_no: "JB-SMOKE-PAID",
    transaction_id: "4200000000000000001",
    trade_state: "SUCCESS",
    amount: { total: 2990 },
  });
  await applyPaidOrder({
    out_trade_no: "JB-SMOKE-PAID",
    transaction_id: "4200000000000000001",
    trade_state: "SUCCESS",
    amount: { total: 2990 },
  });

  assert(prisma.paymentOrders[0].status === "paid", "payment order should become paid");
  assert(prisma.paymentOrders[0].wxTransactionId === "4200000000000000001", "transaction id should be stored");
  assert(prisma.creditAccounts[0].balance === 338, "paid order should add credits exactly once");
  assert(prisma.ledgerRows.length === 1, "duplicate confirmation should not create duplicate ledger rows");
  assert(prisma.ledgerRows[0].type === "recharge", "ledger type should be recharge");
  assert(prisma.ledgerRows[0].refType === "payment_order", "ledger should reference the payment order");

  const { privateKey: merchantPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey: platformPrivateKey, publicKey: platformPublicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const platformCert = platformPublicKey.export({ type: "spki", format: "pem" }).toString();
  const signedService = new PaymentsService(
    prisma as unknown as PrismaService,
    wechatClient({
      WECHAT_PAY_ENABLED: "true",
      WECHAT_APP_ID: "wx-smoke",
      WECHAT_PAY_MCH_ID: "mch-smoke",
      WECHAT_PAY_MCH_SERIAL_NO: "merchant-serial",
      WECHAT_PAY_PRIVATE_KEY: merchantPrivateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_CERT: platformCert,
      WECHAT_PAY_PLATFORM_SERIAL_NO: "platform-serial",
      WECHAT_PAY_API_V3_KEY: "12345678901234567890123456789012",
      WECHAT_PAY_NOTIFY_URL: "https://api.example.com/api/payments/wechat/notify",
    }),
  );
  const readyStatus = signedService.getWechatPayStatus();
  assert(readyStatus.enabled === true, "wechat pay status should be ready with complete config");
  assert(readyStatus.reason === "ready", "wechat pay status should explain ready config");
  const rawBody = JSON.stringify({ id: "notify-smoke" });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = "nonce-smoke";
  const signer = createSign("RSA-SHA256");
  signer.update(`${timestamp}\n${nonce}\n${rawBody}\n`);
  signer.end();
  const signature = signer.sign(platformPrivateKey, "base64");
  const verifyWechatPaySignature = (signedService as unknown as {
    verifyWechatPaySignature(headers: Record<string, string>, rawBody: string): void;
  }).verifyWechatPaySignature.bind(signedService);

  verifyWechatPaySignature({
    "wechatpay-timestamp": timestamp,
    "wechatpay-nonce": nonce,
    "wechatpay-signature": signature,
    "wechatpay-serial": "platform-serial",
  }, rawBody);

  let rejectedBadSignature = false;
  try {
    verifyWechatPaySignature({
      "wechatpay-timestamp": timestamp,
      "wechatpay-nonce": nonce,
      "wechatpay-signature": signature,
      "wechatpay-serial": "platform-serial",
    }, `${rawBody}tampered`);
  } catch {
    rejectedBadSignature = true;
  }
  assert(rejectedBadSignature, "tampered notification body should be rejected");

  let rejectedStaleTimestamp = false;
  try {
    verifyWechatPaySignature({
      "wechatpay-timestamp": "1",
      "wechatpay-nonce": nonce,
      "wechatpay-signature": signature,
      "wechatpay-serial": "platform-serial",
    }, rawBody);
  } catch {
    rejectedStaleTimestamp = true;
  }
  assert(rejectedStaleTimestamp, "stale notification timestamp should be rejected");

  (signedService as unknown as {
    wechatFetch<T>(_cfg: unknown, _method: string, _path: string, body: string): Promise<T>;
  }).wechatFetch = async <T>(_cfg: unknown, _method: string, _path: string, body: string) => {
    const payload = JSON.parse(body) as { out_refund_no: string; amount: { refund: number; total: number } };
    return {
      refund_id: "5030000000000000001",
      out_refund_no: payload.out_refund_no,
      status: "SUCCESS",
      amount: payload.amount,
    } as T;
  };

  const adminOrders = new AdminOrdersService(
    prisma as unknown as PrismaService,
    signedService,
  );
  const adminRefund = await adminOrders.processOrderRefund(prisma.ledgerRows[0].id, "smoke admin refund");
  const refund = adminRefund.data.payment_refund as {
    id: string;
    status: string;
    out_refund_no: string;
    wx_refund_id: string | null;
  };
  const duplicateRefund = await signedService.refundWechatPaymentOrder(prisma.orderId, "smoke refund duplicate");
  assert(adminRefund.data.refunded === true, "admin refund should report refunded");
  assert(refund.status === "succeeded", "refund should become succeeded after upstream success");
  assert(duplicateRefund.id === refund.id, "duplicate refund request should reuse existing refund row");
  assert(prisma.paymentRefunds.length === 1, "duplicate refund should not create duplicate refund rows");
  const refundedOrder = prisma.paymentOrders[0] as PaymentOrderRow;
  assert(refundedOrder.status === "refunded", "payment order should become refunded");
  const finalBalance = (prisma.creditAccounts[0] as CreditAccountRow).balance;
  const ledgerCount = [...prisma.ledgerRows].length;
  assert(finalBalance === 10, "admin refund should revoke recharged credits");
  assert(ledgerCount === 2, "admin refund should add exactly one reversal ledger");
  assert(prisma.ledgerRows[1].type === "adjustment", "admin refund reversal should be an adjustment");
  assert(prisma.ledgerRows[1].amount === -328, "admin refund reversal should subtract recharged credits");
  assert(prisma.paymentRefunds[0].reason === "smoke admin refund", "admin refund reason should be stored on payment refund");
  await applyPaidOrder({
    out_trade_no: "JB-SMOKE-PAID",
    transaction_id: "4200000000000000001",
    trade_state: "SUCCESS",
    amount: { total: 2990 },
  });
  assert((prisma.paymentOrders[0] as PaymentOrderRow).status === "refunded", "paid notification after refund should not reopen order");
  assert((prisma.creditAccounts[0] as CreditAccountRow).balance === finalBalance, "paid notification after refund should not re-add credits");
  assert([...prisma.ledgerRows].length === ledgerCount, "paid notification after refund should not create ledger rows");
  const orderDetail = await adminOrders.getOrderDetail(prisma.ledgerRows[0].id);
  assert(orderDetail.data.payment_refund?.reason === "smoke admin refund", "order detail should expose payment refund detail");

  const spentPrisma = new FakePaymentPrisma();
  const spentService = new PaymentsService(
    spentPrisma as unknown as PrismaService,
    wechatClient({
      WECHAT_PAY_ENABLED: "true",
      WECHAT_APP_ID: "wx-smoke",
      WECHAT_PAY_MCH_ID: "mch-smoke",
      WECHAT_PAY_MCH_SERIAL_NO: "merchant-serial",
      WECHAT_PAY_PRIVATE_KEY: merchantPrivateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_CERT: platformCert,
      WECHAT_PAY_PLATFORM_SERIAL_NO: "platform-serial",
      WECHAT_PAY_API_V3_KEY: "12345678901234567890123456789012",
      WECHAT_PAY_NOTIFY_URL: "https://api.example.com/api/payments/wechat/notify",
    }),
  );
  const applySpentPaidOrder = (spentService as unknown as {
    applyPaidOrder(remote: {
      out_trade_no: string;
      transaction_id: string;
      trade_state: string;
      amount: { total: number };
    }): Promise<void>;
  }).applyPaidOrder.bind(spentService);
  await applySpentPaidOrder({
    out_trade_no: "JB-SMOKE-PAID",
    transaction_id: "4200000000000000003",
    trade_state: "SUCCESS",
    amount: { total: 2990 },
  });
  spentPrisma.creditAccounts[0].balance = 100;
  (spentService as unknown as {
    wechatFetch<T>(_cfg: unknown, _method: string, _path: string, body: string): Promise<T>;
  }).wechatFetch = async <T>(_cfg: unknown, _method: string, _path: string, body: string) => {
    const payload = JSON.parse(body) as { out_refund_no: string; amount: { refund: number; total: number } };
    return {
      refund_id: "5030000000000000003",
      out_refund_no: payload.out_refund_no,
      status: "SUCCESS",
      amount: payload.amount,
    } as T;
  };
  const spentAdmin = new AdminOrdersService(
    spentPrisma as unknown as PrismaService,
    spentService,
  );
  await spentAdmin.processOrderRefund(spentPrisma.ledgerRows[0].id, "spent credits refund");
  assert((spentPrisma.creditAccounts[0] as CreditAccountRow).balance === -228, "refund should revoke credits even after user spent part of them");

  const pendingPrisma = new FakePaymentPrisma();
  const pendingService = new PaymentsService(
    pendingPrisma as unknown as PrismaService,
    wechatClient({
      WECHAT_PAY_ENABLED: "true",
      WECHAT_APP_ID: "wx-smoke",
      WECHAT_PAY_MCH_ID: "mch-smoke",
      WECHAT_PAY_MCH_SERIAL_NO: "merchant-serial",
      WECHAT_PAY_PRIVATE_KEY: merchantPrivateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      WECHAT_PAY_PLATFORM_CERT: platformCert,
      WECHAT_PAY_PLATFORM_SERIAL_NO: "platform-serial",
      WECHAT_PAY_API_V3_KEY: "12345678901234567890123456789012",
      WECHAT_PAY_NOTIFY_URL: "https://api.example.com/api/payments/wechat/notify",
    }),
  );
  const applyPendingPaidOrder = (pendingService as unknown as {
    applyPaidOrder(remote: {
      out_trade_no: string;
      transaction_id: string;
      trade_state: string;
      amount: { total: number };
    }): Promise<void>;
  }).applyPaidOrder.bind(pendingService);
  await applyPendingPaidOrder({
    out_trade_no: "JB-SMOKE-PAID",
    transaction_id: "4200000000000000002",
    trade_state: "SUCCESS",
    amount: { total: 2990 },
  });
  (pendingService as unknown as {
    wechatFetch<T>(_cfg: unknown, _method: string, _path: string, body: string): Promise<T>;
  }).wechatFetch = async <T>(_cfg: unknown, _method: string, _path: string, body: string) => {
    const payload = JSON.parse(body) as { out_refund_no: string; amount: { refund: number; total: number } };
    return {
      refund_id: "5030000000000000002",
      out_refund_no: payload.out_refund_no,
      status: "PROCESSING",
      amount: payload.amount,
    } as T;
  };
  const pendingAdmin = new AdminOrdersService(
    pendingPrisma as unknown as PrismaService,
    pendingService,
  );
  const pendingAdminRefund = await pendingAdmin.processOrderRefund(pendingPrisma.ledgerRows[0].id);
  assert(pendingAdminRefund.data.refunded === false, "processing refund should not be reported as refunded");
  assert((pendingPrisma.creditAccounts[0] as CreditAccountRow).balance === 338, "processing refund should not revoke credits yet");
  assert([...pendingPrisma.ledgerRows].length === 1, "processing refund should not create reversal ledger yet");
  assert((pendingPrisma.paymentOrders[0] as PaymentOrderRow).status === "refund_processing", "payment order should be refund_processing");

  const applyRefundNotification = (pendingService as unknown as {
    applyRefundNotification(remote: { out_refund_no: string; refund_id: string; status: string }): Promise<void>;
  }).applyRefundNotification.bind(pendingService);
  await applyRefundNotification({
    out_refund_no: pendingPrisma.paymentRefunds[0].outRefundNo,
    refund_id: "5030000000000000002",
    status: "SUCCESS",
  });
  await applyRefundNotification({
    out_refund_no: pendingPrisma.paymentRefunds[0].outRefundNo,
    refund_id: "5030000000000000002",
    status: "SUCCESS",
  });
  assert((pendingPrisma.creditAccounts[0] as CreditAccountRow).balance === 10, "successful refund notification should revoke credits");
  assert([...pendingPrisma.ledgerRows].length === 2, "duplicate successful notification should not duplicate reversal ledger");
  assert((pendingPrisma.paymentOrders[0] as PaymentOrderRow).status === "refunded", "successful refund notification should mark order refunded");

  console.log(JSON.stringify({
    ok: true,
    order: {
      status: prisma.paymentOrders[0].status,
      out_trade_no: prisma.paymentOrders[0].outTradeNo,
      wx_transaction_id: prisma.paymentOrders[0].wxTransactionId,
    },
    balance: prisma.creditAccounts[0].balance,
    ledger: prisma.ledgerRows.map((row) => ({
      type: row.type,
      amount: row.amount,
      ref_type: row.refType,
      balance_after: row.balanceAfter,
    })),
    signature_verified: true,
    timestamp_window_enforced: true,
    refund: {
      status: refund.status,
      out_refund_no: refund.out_refund_no,
      wx_refund_id: refund.wx_refund_id,
    },
    admin_refund: {
      balance_after: adminRefund.data.balance_after,
      amount: adminRefund.data.amount,
      refund_id: adminRefund.data.refund_id,
    },
    processing_refund: {
      before_notification_balance: 338,
      after_notification_balance: pendingPrisma.creditAccounts[0].balance,
      ledger_rows: pendingPrisma.ledgerRows.length,
    },
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
