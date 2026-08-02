import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Queue } from "bullmq";
import { AssetsService } from "../assets/assets.service";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { toTemplateUuid } from "../templates/local-template-ids";
import { CreateTaskDto, GenerateRatio } from "./dto/create-task.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly pricing: PricingService,
    @InjectQueue("generation") private readonly generationQueue: Queue,
  ) {}

  async create(userId: string | undefined, dto: CreateTaskDto) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const idempotencyKey = this.normalizeIdempotencyKey(dto.idempotency_key);
    if (idempotencyKey) {
      const existing = await this.prisma.task.findFirst({
        where: { userId, idempotencyKey },
      });
      if (existing) {
        return this.toCreateResponse(existing);
      }
    }

    const inputAsset = await this.prisma.asset.findFirst({
      where: {
        id: dto.input_asset_id,
        ownerUserId: userId,
        assetType: "input_image",
      },
    });
    if (!inputAsset) {
      throw new NotFoundException("Input asset not found");
    }
    await this.assets.assertUploaded(inputAsset.storageKey);
    const pricingMultiplier = await this.pricing.getGlobalPricingMultiplier();

    let task: { id: string; status: string };
    try {
      task = await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
        const template = await tx.template.findFirst({
          where: { id: toTemplateUuid(dto.template_id), status: "published" },
        });
        if (!template) {
          throw new NotFoundException("Template not found");
        }

        const creditCost = this.pricing.applyMultiplier(template.priceCredits, pricingMultiplier);
        const account = await tx.creditAccount.findUnique({ where: { userId } });
        const balance = account?.balance ?? 0;
        if (balance < creditCost) {
          throw new BadRequestException("Insufficient credits");
        }

        const created = await tx.task.create({
          data: {
            userId,
            templateId: template.id,
            inputAssetId: inputAsset.id,
            idempotencyKey,
            ratio: this.normalizeRatio(dto.ratio),
            status: "running",
            expectedResultCount: template.resultCount,
            creditCost,
            creditStatus: "charged",
            isVisible: false,
          },
        });

        const balanceAfter = balance - creditCost;
        await tx.creditAccount.upsert({
          where: { userId },
          update: { balance: balanceAfter, updatedAt: new Date() },
          create: { userId, balance: balanceAfter, updatedAt: new Date() },
        });
        await tx.creditLedger.create({
          data: {
            userId,
            type: "charge",
            amount: -creditCost,
            refType: "task",
            refId: created.id,
            balanceAfter,
          },
        });

        return created;
      });
    } catch (error: unknown) {
      if (idempotencyKey && this.isUniqueViolation(error)) {
        const existing = await this.prisma.task.findFirst({
          where: { userId, idempotencyKey },
        });
        if (existing) {
          return this.toCreateResponse(existing);
        }
      }
      throw error;
    }

    try {
      await this.generationQueue.add("generate", { taskId: task.id }, {
        jobId: task.id,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      });
    } catch (error: unknown) {
      await this.markTaskFailedAndRefund(task.id, "Generation queue unavailable");
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "Generation queue unavailable");
    }

    return this.toCreateResponse(task);
  }

  async getForUser(userId: string | undefined, id: string) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { resultAsset: true },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const progress = await this.getProgressPercent(task);

    return {
      task_id: task.id,
      status: task.status,
      progress,
      progress_percent: progress,
      result: task.isVisible && task.resultAsset ? {
        asset_id: task.resultAsset.id,
        storage_key: task.resultAsset.storageKey,
        url: this.assets.getPublicUrl(task.resultAsset.storageKey),
      } : null,
      error: task.errorMessage,
      error_message: task.errorMessage,
      ratio: task.ratio,
      idempotency_key: task.idempotencyKey,
      created_at: task.createdAt,
      finished_at: task.finishedAt,
      duration_ms: task.durationMs,
    };
  }

  private async getProgressPercent(task: {
    status: string;
    createdAt: Date;
    expectedResultCount: number;
  }) {
    if (task.status === "succeeded") return 100;
    if (task.status === "failed") return 100;

    const elapsedSeconds = (Date.now() - task.createdAt.getTime()) / 1000;

    const samples = await this.prisma.task.findMany({
      where: {
        expectedResultCount: task.expectedResultCount,
        status: "succeeded",
        durationMs: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { durationMs: true },
    });

    let anchorSeconds = 30;
    if (samples.length > 0) {
      const avgMs =
        samples.reduce((sum, sample) => sum + (sample.durationMs ?? 0), 0) /
        samples.length;
      anchorSeconds = Math.max(1, Math.floor(avgMs / 1000));
    } else {
      const anchor = await this.prisma.generationTimeAnchor.findUnique({
        where: { resultCount: task.expectedResultCount },
      });
      if (anchor) {
        anchorSeconds = Math.max(1, Math.floor(Number(anchor.anchorDurationSeconds)));
      }
    }

    return Math.min(99, Math.floor((elapsedSeconds / anchorSeconds) * 100));
  }

  private normalizeRatio(ratio: GenerateRatio | undefined): GenerateRatio {
    return ratio ?? "1:1";
  }

  private normalizeIdempotencyKey(value: string | undefined) {
    const normalized = String(value ?? "").trim();
    return normalized ? normalized.slice(0, 128) : null;
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    );
  }

  private async markTaskFailedAndRefund(taskId: string, errorMessage: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.task.update({
        where: { id: task.id },
        data: {
          status: "failed",
          errorMessage,
          creditStatus: "refunded",
          finishedAt: now,
          durationMs: now.getTime() - task.createdAt.getTime(),
        },
      });

      if (task.creditStatus === "refunded") {
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

  private toCreateResponse(task: { id: string; status: string }) {
    return {
      task_id: task.id,
      status: task.status,
      poll_interval_ms: 2000,
    };
  }
}
