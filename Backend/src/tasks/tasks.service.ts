import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Queue } from "bullmq";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { toTemplateUuid } from "../templates/local-template-ids";
import { CreateTaskDto } from "./dto/create-task.dto";

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    @InjectQueue("generation") private readonly generationQueue: Queue,
  ) {}

  async create(userId: string | undefined, dto: CreateTaskDto) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const task = await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const template = await tx.template.findFirst({
        where: { id: toTemplateUuid(dto.template_id), status: "published" },
      });
      if (!template) {
        throw new NotFoundException("Template not found");
      }

      const inputAsset = await tx.asset.findFirst({
        where: {
          id: dto.input_asset_id,
          ownerUserId: userId,
          assetType: "input_image",
        },
      });
      if (!inputAsset) {
        throw new NotFoundException("Input asset not found");
      }

      const account = await tx.creditAccount.findUnique({ where: { userId } });
      const balance = account?.balance ?? 0;
      if (balance < template.priceCredits) {
        throw new BadRequestException("Insufficient credits");
      }

      const created = await tx.task.create({
        data: {
          userId,
          templateId: template.id,
          inputAssetId: inputAsset.id,
          status: "running",
          expectedResultCount: template.resultCount,
          creditCost: template.priceCredits,
          creditStatus: "charged",
          isVisible: false,
        },
      });

      const balanceAfter = balance - template.priceCredits;
      await tx.creditAccount.upsert({
        where: { userId },
        update: { balance: balanceAfter, updatedAt: new Date() },
        create: { userId, balance: balanceAfter, updatedAt: new Date() },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          type: "charge",
          amount: -template.priceCredits,
          refType: "task",
          refId: created.id,
          balanceAfter,
        },
      });

      return created;
    });

    await this.generationQueue.add("generate", { taskId: task.id });

    return {
      task_id: task.id,
      status: task.status,
      poll_interval_ms: 2000,
    };
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
}
