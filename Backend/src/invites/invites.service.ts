import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";

export const INVITE_REWARD_CREDITS = 30;

type InviteBindStatus = "bound" | "ignored" | "invalid";

type InviteBindResult = {
  status: InviteBindStatus;
  inviter?: {
    id: string;
    label?: string;
  };
  reason?: string;
};

const INVITE_CODE_PREFIX = "JB";
const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_RANDOM_LENGTH = 8;
const INVITE_CODE_ATTEMPTS = 5;

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string | undefined) {
    const safeUserId = this.requireUserId(userId);
    const inviteCode = await this.ensureInviteCode(safeUserId);

    const [inviteCount, rewardedCount, creditsEarned, canBindInviter] = await Promise.all([
      this.prisma.inviteRelation.count({ where: { inviterId: safeUserId } }),
      this.prisma.inviteRelation.count({ where: { inviterId: safeUserId, status: "rewarded" } }),
      this.prisma.inviteRelation.aggregate({
        where: { inviterId: safeUserId, status: "rewarded" },
        _sum: { rewardCredits: true },
      }),
      this.canBindInviter(safeUserId),
    ]);

    return {
      invite_code: inviteCode,
      reward_credits: INVITE_REWARD_CREDITS,
      invite_count: inviteCount,
      rewarded_count: rewardedCount,
      pending_count: Math.max(inviteCount - rewardedCount, 0),
      credits_earned: creditsEarned._sum.rewardCredits ?? 0,
      can_bind_inviter: canBindInviter,
    };
  }

  async bindByCode(userId: string | undefined, inviteCode: string | undefined): Promise<InviteBindResult> {
    return this.tryBindByCode(this.requireUserId(userId), inviteCode);
  }

  async tryBindByCode(userId: string, inviteCode: string | undefined): Promise<InviteBindResult> {
    const normalizedCode = this.normalizeInviteCode(inviteCode);
    if (!normalizedCode) {
      return { status: "invalid", reason: "missing_code" };
    }

    const inviter = await this.prisma.user.findUnique({
      where: { inviteCode: normalizedCode },
      select: { id: true, nickname: true, phone: true },
    });
    if (!inviter) {
      return { status: "invalid", reason: "invite_code_not_found" };
    }
    if (inviter.id === userId) {
      return { status: "ignored", reason: "self_invite" };
    }
    if (!(await this.canBindInviter(userId))) {
      return { status: "ignored", reason: "not_eligible" };
    }

    try {
      const relation = await this.prisma.inviteRelation.create({
        data: {
          inviterId: inviter.id,
          inviteeId: userId,
          rewardCredits: INVITE_REWARD_CREDITS,
          updatedAt: new Date(),
        },
      });
      return {
        status: "bound",
        inviter: { id: relation.inviterId, label: this.userLabel(inviter) },
      };
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        return { status: "ignored", reason: "already_bound" };
      }
      throw error;
    }
  }

  async rewardFirstSuccessfulTask(
    tx: PrismaTransactionClient,
    userId: string,
    taskId: string,
  ) {
    const relation = await tx.inviteRelation.findUnique({
      where: { inviteeId: userId },
    });
    if (!relation || relation.status !== "bound") {
      return { rewarded: false };
    }

    const previousSuccesses = await tx.task.count({
      where: {
        userId,
        status: "succeeded",
        id: { not: taskId },
      },
    });
    if (previousSuccesses > 0) {
      return { rewarded: false };
    }

    const now = new Date();
    const updated = await tx.inviteRelation.updateMany({
      where: { id: relation.id, status: "bound" },
      data: { status: "rewarded", rewardedAt: now, updatedAt: now },
    });
    if (updated.count !== 1) {
      return { rewarded: false };
    }

    const rewardCredits = relation.rewardCredits || INVITE_REWARD_CREDITS;
    await this.addInviteReward(tx, relation.inviterId, relation.id, rewardCredits, now);
    await this.addInviteReward(tx, relation.inviteeId, relation.id, rewardCredits, now);

    return { rewarded: true, rewardCredits };
  }

  async ensureInviteCode(userId: string, tx: PrismaTransactionClient | PrismaService = this.prisma) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { inviteCode: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.inviteCode) {
      return user.inviteCode;
    }

    for (let attempt = 0; attempt < INVITE_CODE_ATTEMPTS; attempt += 1) {
      const inviteCode = this.generateInviteCode();
      try {
        const updated = await tx.user.updateMany({
          where: { id: userId, inviteCode: null },
          data: { inviteCode },
        });
        if (updated.count === 1) {
          return inviteCode;
        }

        const latest = await tx.user.findUnique({
          where: { id: userId },
          select: { inviteCode: true },
        });
        if (latest?.inviteCode) {
          return latest.inviteCode;
        }
      } catch (error: unknown) {
        if (!this.isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException("Invite code generation failed");
  }

  private async canBindInviter(userId: string) {
    const [existingRelation, succeededTasks] = await Promise.all([
      this.prisma.inviteRelation.findUnique({
        where: { inviteeId: userId },
        select: { id: true },
      }),
      this.prisma.task.count({
        where: { userId, status: "succeeded" },
      }),
    ]);

    return !existingRelation && succeededTasks === 0;
  }

  private async addInviteReward(
    tx: PrismaTransactionClient,
    userId: string,
    relationId: string,
    amount: number,
    now: Date,
  ) {
    const account = await tx.creditAccount.upsert({
      where: { userId },
      update: { balance: { increment: amount }, updatedAt: now },
      create: { userId, balance: amount, updatedAt: now },
    });
    await tx.creditLedger.create({
      data: {
        userId,
        type: "invite_reward",
        amount,
        refType: "invite_relation",
        refId: relationId,
        balanceAfter: account.balance,
      },
    });
  }

  private requireUserId(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    return userId;
  }

  private normalizeInviteCode(value: string | undefined) {
    return String(value ?? "").trim().toUpperCase();
  }

  private generateInviteCode() {
    let suffix = "";
    for (let index = 0; index < INVITE_CODE_RANDOM_LENGTH; index += 1) {
      suffix += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
    }
    return `${INVITE_CODE_PREFIX}${suffix}`;
  }

  private userLabel(user: { nickname: string | null; phone: string | null }) {
    return user.nickname || user.phone || undefined;
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    );
  }
}
