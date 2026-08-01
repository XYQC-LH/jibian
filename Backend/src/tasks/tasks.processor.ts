import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { AssetsService } from "../assets/assets.service";
import { StandardGenerateInput } from "../generation/contracts/standard-generate.contract";
import { SourceAdapterRegistry } from "../generation/sources/source-adapter.registry";
import { ContentModerationService } from "../moderation/content-moderation.service";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";

type GenerateJob = {
  taskId: string;
};

@Injectable()
@Processor("generation")
export class TasksProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: SourceAdapterRegistry,
    private readonly assets: AssetsService,
    private readonly moderation: ContentModerationService,
  ) {
    super();
  }

  async process(job: Job<GenerateJob>) {
    const task = await this.prisma.task.findUnique({
      where: { id: job.data.taskId },
      include: { template: true, inputAsset: true },
    });
    if (!task) return;

    const input: StandardGenerateInput = {
      prompt: task.template.prompt,
      imageUrl: this.assets.getPublicUrl(task.inputAsset.storageKey),
    };

    const preImage = await this.moderation.reviewInputImage(task.id, input.imageUrl);
    if (!preImage.passed) {
      await this.markTaskFailed(task.id, preImage.reason ?? "Input image rejected by moderation");
      return;
    }

    let lastError = "All sources failed";
    for (const source of this.sources.getAll()) {
      const sourceRun = await this.prisma.sourceRun.create({
        data: {
          taskId: task.id,
          sourceId: source.sourceId,
          status: "running",
        },
      });

      try {
        const output = await source.generate(input);
        if (!output.ok) {
          lastError = output.errorMessage;
          await this.markSourceRunFailed(sourceRun.id, output.errorMessage);
          continue;
        }

        const asset = await this.prisma.asset.findUnique({ where: { id: output.assetId } });
        // asset 缺失时传 assetId（非 http(s) URL），会被图片 URL 校验拦截，按不通过处理
        const post = await this.moderation.reviewOutputImage(
          task.id,
          asset ? this.assets.getPublicUrl(asset.storageKey) : output.assetId,
        );
        if (!post.passed) {
          await this.markSourceRunFailed(sourceRun.id, post.reason ?? "Result rejected by moderation");
          await this.markTaskFailed(task.id, post.reason ?? "Result image rejected by moderation");
          return;
        }

        await this.markSucceeded(task.id, sourceRun.id, output.assetId, task.createdAt, task.userId);
        return;
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : "Source call failed";
        await this.markSourceRunFailed(sourceRun.id, lastError);
      }
    }

    await this.markTaskFailed(task.id, lastError);
  }

  private async markSucceeded(
    taskId: string,
    sourceRunId: string,
    assetId: string,
    createdAt: Date,
    userId: string,
  ) {
    const now = new Date();
    const durationMs = now.getTime() - createdAt.getTime();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.sourceRun.update({
        where: { id: sourceRunId },
        data: { status: "success" },
      });
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: "succeeded",
          resultAssetId: assetId,
          isVisible: true,
          finishedAt: now,
          durationMs,
        },
      });
      await tx.userCreation.create({
        data: {
          userId,
          taskId,
          coverAssetId: assetId,
        },
      });
    });
  }

  private async markSourceRunFailed(sourceRunId: string, errorMessage: string) {
    await this.prisma.sourceRun.update({
      where: { id: sourceRunId },
      data: { status: "failed", sourceErrorMessage: errorMessage },
    });
  }

  private async markTaskFailed(taskId: string, errorMessage: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: "failed",
          errorMessage,
          creditStatus: "refunded",
          finishedAt: now,
          durationMs: now.getTime() - task.createdAt.getTime(),
        },
      });
      if (task.creditStatus !== "refunded") {
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
      }
    });
  }
}
