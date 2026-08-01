import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type CreateRedeemCodeInput = {
  code?: string;
  credits: number;
  type?: string;
  usage_limit?: number;
  expires_at?: string;
  description?: string;
};

export type BatchCreateRedeemCodeInput = CreateRedeemCodeInput & {
  count: number;
  prefix?: string;
};

export type UpdateRedeemCodeInput = {
  credits?: number;
  status?: string;
  usage_limit?: number;
  expires_at?: string;
  description?: string;
};

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 12;

@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Redeem codes ──

  async listRedeemCodes(params: {
    page: number;
    pageSize: number;
    status?: string;
  }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize =
      Number.isFinite(params.pageSize) && params.pageSize > 0
        ? Math.min(params.pageSize, 100)
        : 20;
    const where = {
      ...(params.status && params.status !== "all" ? { status: params.status } : {}),
    };

    const [total, codes] = await this.prisma.$transaction([
      this.prisma.redeemCode.count({ where }),
      this.prisma.redeemCode.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      success: true,
      data: {
        items: codes.map((code) => this.mapRedeemCode(code)),
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  async createRedeemCode(input: CreateRedeemCodeInput) {
    const credits = this.toPositiveInt(input.credits, "credits");
    const maxUses = this.resolveMaxUses(input.type, input.usage_limit);
    const expiresAt = this.parseExpiresAt(input.expires_at);

    const code =
      String(input.code || "").trim().toUpperCase() || this.generateCode();

    const existing = await this.prisma.redeemCode.findUnique({ where: { code } });
    if (existing) {
      throw new BadRequestException("Redeem code already exists");
    }

    const created = await this.prisma.redeemCode.create({
      data: {
        code,
        amount: credits,
        status: "active",
        maxUses,
        usedCount: 0,
        expiresAt,
      },
    });

    return { success: true, data: this.mapRedeemCode(created) };
  }

  async batchCreateRedeemCodes(input: BatchCreateRedeemCodeInput) {
    const count = this.toPositiveInt(input.count, "count");
    if (count > 500) {
      throw new BadRequestException("count must be at most 500");
    }
    const credits = this.toPositiveInt(input.credits, "credits");
    const maxUses = this.resolveMaxUses(input.type, input.usage_limit);
    const expiresAt = this.parseExpiresAt(input.expires_at);
    const prefix = String(input.prefix || "")
      .trim()
      .toUpperCase()
      .slice(0, 8);

    const created: Array<ReturnType<AdminFinanceService["mapRedeemCode"]>> = [];
    const seen = new Set<string>();
    const attemptsLimit = count * 20;

    for (let i = 0; i < count && i < attemptsLimit; i++) {
      const code = this.generateCode(prefix);
      if (seen.has(code)) {
        continue;
      }
      seen.add(code);
      const row = await this.prisma.redeemCode.create({
        data: {
          code,
          amount: credits,
          status: "active",
          maxUses,
          usedCount: 0,
          expiresAt,
        },
      });
      created.push(this.mapRedeemCode(row));
    }

    return { success: true, data: created };
  }

  async updateRedeemCode(id: string, input: UpdateRedeemCodeInput) {
    const existing = await this.prisma.redeemCode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Redeem code not found");
    }

    const data: Record<string, unknown> = {};
    if (input.credits !== undefined) {
      data.amount = this.toPositiveInt(input.credits, "credits");
    }
    if (input.status !== undefined) {
      if (!["active", "disabled"].includes(input.status)) {
        throw new BadRequestException("Invalid status");
      }
      data.status = input.status;
    }
    if (input.usage_limit !== undefined) {
      const usageLimit = this.toPositiveInt(input.usage_limit, "usage_limit");
      if (usageLimit < existing.usedCount) {
        throw new BadRequestException("usage_limit cannot be below used_count");
      }
      data.maxUses = usageLimit;
    }
    if (input.expires_at !== undefined) {
      data.expiresAt = this.parseExpiresAt(input.expires_at);
    }

    const updated = await this.prisma.redeemCode.update({
      where: { id },
      data,
    });

    return { success: true, data: this.mapRedeemCode(updated) };
  }

  async disableRedeemCode(id: string) {
    const existing = await this.prisma.redeemCode.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Redeem code not found");
    }

    const updated = await this.prisma.redeemCode.update({
      where: { id },
      data: { status: "disabled" },
    });

    return { success: true, data: this.mapRedeemCode(updated) };
  }

  // ── Credit ledger & statistics ──

  async listCreditLedger(params: {
    page: number;
    pageSize: number;
    type?: string;
    user?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize =
      Number.isFinite(params.pageSize) && params.pageSize > 0
        ? Math.min(params.pageSize, 100)
        : 20;
    const where: Record<string, unknown> = {
      ...(params.type && params.type !== "all" ? { type: params.type } : {}),
      ...(params.user ? { user: { OR: [{ nickname: { contains: params.user } }, { phone: { contains: params.user } }] } } : {}),
      ...(params.startDate || params.endDate
        ? {
            createdAt: {
              ...(params.startDate ? { gte: new Date(params.startDate) } : {}),
              ...(params.endDate ? { lte: new Date(params.endDate) } : {}),
            },
          }
        : {}),
    };

    const [total, records] = await this.prisma.$transaction([
      this.prisma.creditLedger.count({ where }),
      this.prisma.creditLedger.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      success: true,
      data: {
        items: records.map((record) => ({
          id: record.id,
          user_id: record.userId,
          user_email: record.user.nickname || record.user.phone || undefined,
          type: record.type,
          amount: record.amount,
          balance_after: record.balanceAfter,
          ref_type: record.refType,
          ref_id: record.refId,
          created_at: record.createdAt.toISOString(),
        })),
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  async getCreditStatistics(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [
      accountCount,
      balanceAgg,
      ledgerAll,
      ledgerSince,
      redeemStats,
    ] = await Promise.all([
      this.prisma.creditAccount.count(),
      this.prisma.creditAccount.aggregate({ _sum: { balance: true } }),
      this.prisma.creditLedger.findMany({ select: { type: true, amount: true } }),
      this.prisma.creditLedger.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, amount: true },
      }),
      this.prisma.redeemCode.aggregate({
        _count: { _all: true },
        _sum: { usedCount: true },
      }),
    ]);

    const sumByType = (records: Array<{ type: string; amount: number }>) => {
      const totals: Record<string, number> = {};
      for (const record of records) {
        totals[record.type] = (totals[record.type] ?? 0) + record.amount;
      }
      return totals;
    };

    const allByType = sumByType(ledgerAll);
    const sinceByType = sumByType(ledgerSince);
    const issuedTypes = ["recharge", "redeem", "adjustment"];
    const spentTypes = ["charge", "refund"];

    const totalIssued = issuedTypes.reduce((sum, type) => sum + (allByType[type] ?? 0), 0);
    const totalSpent = Math.abs(
      spentTypes.reduce((sum, type) => sum + (allByType[type] ?? 0), 0),
    );
    const periodIssued = issuedTypes.reduce((sum, type) => sum + (sinceByType[type] ?? 0), 0);
    const periodSpent = Math.abs(
      spentTypes.reduce((sum, type) => sum + (sinceByType[type] ?? 0), 0),
    );

    const activeCodes = await this.prisma.redeemCode.count({
      where: { status: "active" },
    });

    return {
      success: true,
      data: {
        summary: {
          total_accounts: accountCount,
          total_balance: balanceAgg._sum.balance ?? 0,
          total_ledger_records: ledgerAll.length,
          period_ledger_records: ledgerSince.length,
          total_issued: totalIssued,
          total_spent: totalSpent,
          period_issued: periodIssued,
          period_spent: periodSpent,
        },
        redemption: {
          total_codes: redeemStats._count._all,
          active_codes: activeCodes,
          total_used: redeemStats._sum.usedCount ?? 0,
        },
        by_type: allByType,
        period_days: safeDays,
      },
    };
  }

  // ── Recharge records ──

  async listRechargeRecords(params: {
    page: number;
    pageSize: number;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, pageSize } = this.resolvePagination(params.page, params.pageSize);
    const where = this.buildLedgerWhere(params.userEmail, params.startDate, params.endDate, {
      amount: { gt: 0 },
    });

    const [total, records] = await this.prisma.$transaction([
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
      data: this.paginated(
        records.map((record) => ({
          id: record.id,
          user_id: record.userId,
          user_email: this.userLabel(record.user),
          amount: record.amount,
          credits: record.amount,
          status: "success",
          payment_method: "credits",
          created_at: record.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      ),
    };
  }

  // ── Transactions ──

  async listTransactions(params: {
    page: number;
    pageSize: number;
    transactionType?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { page, pageSize } = this.resolvePagination(params.page, params.pageSize);
    const where = this.buildLedgerWhere(params.userEmail, params.startDate, params.endDate, {
      ...(params.transactionType && params.transactionType !== "all"
        ? { type: params.transactionType }
        : {}),
    });

    const [total, records] = await this.prisma.$transaction([
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
      data: this.paginated(
        records.map((record) => ({
          id: record.id,
          user_id: record.userId,
          user_email: this.userLabel(record.user),
          amount: record.amount,
          balance_before: record.balanceAfter - record.amount,
          balance_after: record.balanceAfter,
          transaction_type: record.type,
          status: "success",
          description: `${record.refType}:${record.refId}`,
          created_at: record.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      ),
    };
  }

  async getTransactionStatistics(days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 90) : 30;
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
    const records = await this.prisma.creditLedger.findMany({
      where: { createdAt: { gte: since } },
      select: { type: true, amount: true },
    });

    const total = records.length;
    const totalAmount = records.reduce((sum, record) => sum + Math.abs(record.amount), 0);
    const successCount = records.filter((record) => record.amount > 0).length;
    const failedCount = records.filter((record) => record.amount < 0).length;
    const byType: Record<string, number> = {};
    for (const record of records) {
      byType[record.type] = (byType[record.type] ?? 0) + record.amount;
    }

    return {
      success: true,
      data: {
        total,
        total_transactions: total,
        total_amount: totalAmount,
        success_count: successCount,
        failed_count: failedCount,
        success_rate: total > 0 ? Number((successCount / total).toFixed(4)) : 0,
        by_type: byType,
        period_days: safeDays,
      },
    };
  }

  async getXianyuIssueRecordsOverview() {
    return {
      success: true,
      data: {
        total: 0,
        today_count: 0,
        pending: 0,
        succeeded: 0,
        failed: 0,
        total_issued: 0,
        recent_records: [],
      },
    };
  }

  // ── Helpers ──

  private resolvePagination(page: number, pageSize: number) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize =
      Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 20;
    return { page: Math.trunc(safePage), pageSize: Math.trunc(safePageSize) };
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

  private buildLedgerWhere(
    userEmail: string | undefined,
    startDate: string | undefined,
    endDate: string | undefined,
    extra: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      ...extra,
      ...(userEmail
        ? {
            user: {
              OR: [{ nickname: { contains: userEmail } }, { phone: { contains: userEmail } }],
            },
          }
        : {}),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };
  }

  private userLabel(user: { nickname: string | null; phone: string | null } | null) {
    if (!user) {
      return undefined;
    }
    return user.nickname || user.phone || undefined;
  }

  private mapRedeemCode(code: {
    id: string;
    code: string;
    amount: number;
    status: string;
    maxUses: number;
    usedCount: number;
    expiresAt: Date | null;
    createdAt: Date;
  }) {
    const type =
      code.maxUses === 1
        ? "single_use"
        : code.expiresAt
          ? "time_limited"
          : "multi_use";
    return {
      id: code.id,
      code: code.code,
      credits: code.amount,
      type,
      status: code.status,
      usage_limit: code.maxUses,
      used_count: code.usedCount,
      expires_at: code.expiresAt?.toISOString() ?? null,
      created_at: code.createdAt.toISOString(),
    };
  }

  private resolveMaxUses(type: string | undefined, usageLimit: number | undefined): number {
    const normalizedType = String(type || "single_use").trim().toLowerCase();
    if (normalizedType === "multi_use" || normalizedType === "time_limited") {
      const parsed = Number(usageLimit);
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
    }
    return 1;
  }

  private parseExpiresAt(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Invalid expires_at");
    }
    return date;
  }

  private toPositiveInt(value: number, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException(`${field} must be a positive integer`);
    }
    return Math.trunc(parsed);
  }

  private generateCode(prefix = ""): string {
    const randomPart = Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
    return `${prefix}${randomPart}`;
  }
}
