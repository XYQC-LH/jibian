import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const account = await this.prisma.creditAccount.findUnique({ where: { userId } });
    return { balance: account?.balance ?? 0 };
  }

  async listLedger(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const ledger = await this.prisma.creditLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return ledger.map((item) => ({
      id: item.id,
      type: item.type,
      amount: item.amount,
      ref_type: item.refType,
      ref_id: item.refId,
      balance_after: item.balanceAfter,
      created_at: item.createdAt,
    }));
  }

  async redeem(userId: string | undefined, code: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    if (!code) {
      throw new BadRequestException("Missing redeem code");
    }

    return this.prisma.$transaction(async (tx) => {
      const redeemCode = await tx.redeemCode.findUnique({ where: { code } });
      if (!redeemCode || redeemCode.status !== "active") {
        throw new NotFoundException("Redeem code not found");
      }
      if (redeemCode.usedCount >= redeemCode.maxUses) {
        throw new BadRequestException("Redeem code exhausted");
      }
      if (redeemCode.expiresAt && redeemCode.expiresAt.getTime() <= Date.now()) {
        throw new BadRequestException("Redeem code expired");
      }

      const account = await tx.creditAccount.findUnique({ where: { userId } });
      const balanceAfter = (account?.balance ?? 0) + redeemCode.amount;
      await tx.creditAccount.upsert({
        where: { userId },
        update: { balance: balanceAfter, updatedAt: new Date() },
        create: { userId, balance: balanceAfter, updatedAt: new Date() },
      });
      await tx.redeemCode.update({
        where: { id: redeemCode.id },
        data: { usedCount: redeemCode.usedCount + 1 },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          type: "redeem",
          amount: redeemCode.amount,
          refType: "redeem_code",
          refId: redeemCode.id,
          balanceAfter,
        },
      });

      return { balance: balanceAfter };
    });
  }
}
