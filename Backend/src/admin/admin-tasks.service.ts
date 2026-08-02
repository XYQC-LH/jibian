import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";

type ListParams = {
  page: number;
  pageSize: number;
  status?: string;
  user?: string;
};

@Injectable()
export class AdminTasksService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue("generation") private readonly generationQueue: Queue,
  ) {}

  async list(params: ListParams) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize = Number.isFinite(params.pageSize) && params.pageSize > 0 ? params.pageSize : 50;
    const where = {
      adminDeletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.user
        ? {
            user: {
              OR: [
                { nickname: { contains: params.user } },
                { phone: { contains: params.user } },
              ],
            },
          }
        : {}),
    };

    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: true,
          template: true,
          sourceRuns: true,
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      success: true,
      data: {
        items: tasks.map((task) => this.mapTask(task)),
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  async get(id: string) {
    const [task, creditLedger, reviewRecords] = await Promise.all([
      this.prisma.task.findUnique({
        where: { id },
        include: {
          user: true,
          template: true,
          sourceRuns: true,
        },
      }),
      this.prisma.creditLedger.findMany({
        where: { refType: "task", refId: id },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.reviewRecord.findMany({
        where: { targetId: id },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return {
      success: true,
      data: {
        ...this.mapTask(task),
        credit_ledger: creditLedger.map((item) => ({
          id: item.id,
          type: item.type,
          amount: item.amount,
          ref_type: item.refType,
          ref_id: item.refId,
          balance_after: item.balanceAfter,
          created_at: item.createdAt.toISOString(),
        })),
        review_records: reviewRecords.map((record) => ({
          id: record.id,
          target_type: record.targetType,
          target_id: record.targetId,
          review_stage: record.reviewStage,
          status: record.status,
          policy_hit: record.policyHit,
          reason: record.reason,
          created_at: record.createdAt.toISOString(),
        })),
      },
    };
  }

  async remove(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.task.update({ where: { id }, data: { isVisible: false, adminDeletedAt: now } }),
      this.prisma.userCreation.updateMany({
        where: { taskId: id, status: "active" },
        data: { status: "deleted", deletedAt: now },
      }),
    ]);

    return { success: true, data: { deleted: true, admin_deleted_at: now.toISOString() } };
  }

  async rerun(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    if (task.status !== "failed") {
      throw new BadRequestException("Only failed tasks can be rerun");
    }
    if (task.adminDeletedAt) {
      throw new BadRequestException("Deleted tasks cannot be rerun");
    }

    const reset = await this.resetTaskForRerun(task);

    try {
      await this.generationQueue.add("generate", { taskId: id }, {
        jobId: `${id}:rerun:${Date.now()}`,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      });
    } catch (error: unknown) {
      await this.markTaskFailedAndRefund(id, "Generation queue unavailable");
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "Generation queue unavailable");
    }

    return { success: true, data: this.mapTask(reset) };
  }

  private async resetTaskForRerun(task: {
    id: string;
    userId: string;
    creditCost: number;
    creditStatus: string;
  }) {
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      if (task.creditStatus === "refunded" && task.creditCost > 0) {
        const account = await tx.creditAccount.findUnique({ where: { userId: task.userId } });
        const balance = account?.balance ?? 0;
        if (balance < task.creditCost) {
          throw new BadRequestException("Insufficient credits to rerun task");
        }

        const now = new Date();
        const balanceAfter = balance - task.creditCost;
        await tx.creditAccount.upsert({
          where: { userId: task.userId },
          update: { balance: balanceAfter, updatedAt: now },
          create: { userId: task.userId, balance: balanceAfter, updatedAt: now },
        });
        await tx.creditLedger.create({
          data: {
            userId: task.userId,
            type: "charge",
            amount: -task.creditCost,
            refType: "task",
            refId: task.id,
            balanceAfter,
          },
        });
      }

      return tx.task.update({
        where: { id: task.id },
        data: {
          status: "running",
          creditStatus: "charged",
          errorMessage: null,
          resultAssetId: null,
          isVisible: false,
          finishedAt: null,
          durationMs: null,
        },
        include: {
          user: true,
          template: true,
          sourceRuns: true,
        },
      });
    });
  }

  private async markTaskFailedAndRefund(taskId: string, errorMessage: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const updated = await tx.task.updateMany({
        where: { id: task.id, status: "running" },
        data: {
          status: "failed",
          errorMessage,
          creditStatus: "refunded",
          finishedAt: now,
          durationMs: now.getTime() - task.createdAt.getTime(),
        },
      });
      if (updated.count !== 1 || task.creditStatus === "refunded") {
        return;
      }

      const account = await tx.creditAccount.findUnique({ where: { userId: task.userId } });
      const balanceAfter = (account?.balance ?? 0) + task.creditCost;
      await tx.creditAccount.upsert({
        where: { userId: task.userId },
        update: { balance: balanceAfter, updatedAt: now },
        create: { userId: task.userId, balance: balanceAfter, updatedAt: now },
      });
      await tx.creditLedger.create({
        data: {
          userId: task.userId,
          type: "refund",
          amount: task.creditCost,
          refType: "task",
          refId: task.id,
          balanceAfter,
        },
      });
    });
  }

  private mapTask(task: Parameters<typeof this.mapTaskInput>[0]) {
    return this.mapTaskInput(task);
  }

  private mapTaskInput(task: {
    id: string;
    userId: string;
    templateId: string;
    status: string;
    creditCost: number;
    creditStatus: string;
    isVisible: boolean;
    adminDeletedAt?: Date | null;
    idempotencyKey?: string | null;
    ratio?: string;
    errorMessage: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    user: { nickname: string | null; phone: string | null };
    template: { id?: string; name: string; category: string };
    sourceRuns: Array<{
      id?: string;
      sourceId: string;
      status: string;
      upstreamJobId?: string | null;
      latencyMs?: number | null;
      costAmount?: unknown | null;
      sourceErrorMessage?: string | null;
      createdAt?: Date;
    }>;
  }) {
    return {
      id: task.id,
      user_id: task.userId,
      username: task.user.nickname,
      user_email: task.user.phone,
      status: task.status,
      type: "image",
      model_id: task.template.id ?? task.template.name,
      model_name: task.template.name,
      operation: task.template.category,
      source_id: task.sourceRuns[0]?.sourceId ?? null,
      idempotency_key: task.idempotencyKey ?? null,
      ratio: task.ratio ?? null,
      attempts: task.sourceRuns.map((run) => ({
        id: run.id,
        status: run.status,
        source_id: run.sourceId,
        upstream_job_id: run.upstreamJobId ?? null,
        latency_ms: run.latencyMs ?? null,
        cost_amount: this.toNumberOrNull(run.costAmount),
        error_message: run.sourceErrorMessage ?? null,
        created_at: run.createdAt?.toISOString() ?? null,
      })),
      credits_consumed: task.creditStatus === "charged" ? task.creditCost : 0,
      credits_refunded: task.creditStatus === "refunded" ? task.creditCost : 0,
      visibility: task.isVisible && !task.adminDeletedAt
        ? null
        : { user_deleted_at: null, admin_deleted_at: task.adminDeletedAt?.toISOString() ?? null },
      error_message: task.errorMessage ?? undefined,
      created_at: task.createdAt.toISOString(),
      finished_at: task.finishedAt?.toISOString() ?? null,
      progress: task.status === "succeeded" || task.status === "failed" ? 100 : 50,
    };
  }

  private toNumberOrNull(value: unknown) {
    if (value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
}
