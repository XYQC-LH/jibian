import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { Job } from "bullmq";
import { AssetsService } from "../assets/assets.service";
import { StandardGenerateInput } from "../generation/contracts/standard-generate.contract";
import { SourceAdapterRegistry } from "../generation/sources/source-adapter.registry";
import { ContentModerationService } from "../moderation/content-moderation.service";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_TASK_TIMEOUT_SECONDS,
  TASK_TIMEOUT_SETTING_KEY,
} from "../common/settings.constants";

type GenerateJob = {
  taskId: string;
};

const TASK_TIMEOUT_ERROR = "Generation task timed out";

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
    if (task.status !== "running") return;

    const baseInput: StandardGenerateInput = {
      prompt: task.template.prompt,
      imageUrl: this.assets.getPublicUrl(task.inputAsset.storageKey),
      ratio: task.ratio as StandardGenerateInput["ratio"],
    };

    const preImage = await this.moderation.reviewInputImage(task.id, baseInput.imageUrl);
    if (!preImage.passed) {
      await this.markTaskFailed(task.id, preImage.reason ?? "Input image rejected by moderation");
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), (await this.readTaskTimeoutSeconds()) * 1000);
    let lastError = "All sources failed";
    try {
      for (const source of await this.sources.getRunnable()) {
        if (controller.signal.aborted) {
          await this.markTaskFailed(task.id, TASK_TIMEOUT_ERROR);
          return;
        }

        const sourceRun = await this.prisma.sourceRun.create({
          data: {
            taskId: task.id,
            sourceId: source.sourceId,
            status: "running",
          },
        });
        const startedAt = Date.now();

        try {
          const output = await source.generate({ ...baseInput, signal: controller.signal });
          const latencyMs = Date.now() - startedAt;
          if (controller.signal.aborted) {
            lastError = TASK_TIMEOUT_ERROR;
            await this.markSourceRunFailed(sourceRun.id, lastError, latencyMs, output.upstreamJobId, output.costAmount);
            await this.markTaskFailed(task.id, lastError);
            return;
          }
          if (!output.ok) {
            lastError = output.errorMessage;
            await this.markSourceRunFailed(sourceRun.id, output.errorMessage, latencyMs, output.upstreamJobId, output.costAmount);
            continue;
          }

          const asset = await this.assets.materializeRemoteAsset(output.assetId, task.userId, controller.signal);
          if (controller.signal.aborted) {
            lastError = TASK_TIMEOUT_ERROR;
            await this.markSourceRunFailed(sourceRun.id, lastError, Date.now() - startedAt, output.upstreamJobId, output.costAmount);
            await this.markTaskFailed(task.id, lastError);
            return;
          }
          if (!asset) {
            lastError = "Generated asset not found";
            await this.markSourceRunFailed(sourceRun.id, lastError, latencyMs, output.upstreamJobId, output.costAmount);
            continue;
          }

          const post = await this.moderation.reviewOutputImage(
            task.id,
            this.assets.getPublicUrl(asset.storageKey),
          );
          if (controller.signal.aborted) {
            lastError = TASK_TIMEOUT_ERROR;
            await this.markSourceRunFailed(sourceRun.id, lastError, Date.now() - startedAt, output.upstreamJobId, output.costAmount);
            await this.markTaskFailed(task.id, lastError);
            return;
          }
          if (!post.passed) {
            await this.markSourceRunFailed(sourceRun.id, post.reason ?? "Result rejected by moderation", latencyMs, output.upstreamJobId, output.costAmount);
            await this.markTaskFailed(task.id, post.reason ?? "Result image rejected by moderation");
            return;
          }

          await this.markSucceeded(
            task.id,
            sourceRun.id,
            asset.id,
            task.createdAt,
            task.userId,
            task.expectedResultCount,
            Date.now() - startedAt,
            output.upstreamJobId,
            output.costAmount,
          );
          return;
        } catch (error: unknown) {
          lastError = this.isAbortError(error) || controller.signal.aborted
            ? TASK_TIMEOUT_ERROR
            : error instanceof Error ? error.message : "Source call failed";
          await this.markSourceRunFailed(sourceRun.id, lastError, Date.now() - startedAt);
          if (lastError === TASK_TIMEOUT_ERROR) {
            await this.markTaskFailed(task.id, lastError);
            return;
          }
        }
      }

      await this.markTaskFailed(task.id, lastError);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async markSucceeded(
    taskId: string,
    sourceRunId: string,
    assetId: string,
    createdAt: Date,
    userId: string,
    expectedResultCount: number,
    latencyMs: number,
    upstreamJobId?: string,
    costAmount?: number,
  ) {
    const now = new Date();
    const durationMs = now.getTime() - createdAt.getTime();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const updated = await tx.task.updateMany({
        where: { id: taskId, status: "running" },
        data: {
          status: "succeeded",
          resultAssetId: assetId,
          isVisible: true,
          finishedAt: now,
          durationMs,
        },
      });
      if (updated.count !== 1) {
        await tx.sourceRun.update({
          where: { id: sourceRunId },
          data: {
            status: "failed",
            latencyMs,
            upstreamJobId,
            costAmount,
            sourceErrorMessage: "Task no longer running",
          },
        });
        return;
      }
      await tx.sourceRun.update({
        where: { id: sourceRunId },
        data: {
          status: "success",
          latencyMs,
          upstreamJobId,
          costAmount,
        },
      });
      await tx.userCreation.create({
        data: {
          userId,
          taskId,
          coverAssetId: assetId,
        },
      });
      await tx.generationTimeAnchor.upsert({
        where: { resultCount: expectedResultCount },
        update: { anchorDurationSeconds: Number((durationMs / 1000).toFixed(3)), updatedAt: now },
        create: {
          resultCount: expectedResultCount,
          anchorDurationSeconds: Number((durationMs / 1000).toFixed(3)),
          updatedAt: now,
        },
      });
    });
  }

  private async markSourceRunFailed(
    sourceRunId: string,
    errorMessage: string,
    latencyMs?: number,
    upstreamJobId?: string,
    costAmount?: number,
  ) {
    await this.prisma.sourceRun.updateMany({
      where: { id: sourceRunId, status: "running" },
      data: { status: "failed", sourceErrorMessage: errorMessage, latencyMs, upstreamJobId, costAmount },
    });
  }

  private async markTaskFailed(taskId: string, errorMessage: string) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    const now = new Date();
    await this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const updated = await tx.task.updateMany({
        where: { id: taskId, status: "running" },
        data: {
          status: "failed",
          errorMessage,
          creditStatus: "refunded",
          finishedAt: now,
          durationMs: now.getTime() - task.createdAt.getTime(),
        },
      });
      if (updated.count !== 1) {
        return;
      }
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

  private async readTaskTimeoutSeconds() {
    const setting = await this.prisma.setting.findUnique({ where: { key: TASK_TIMEOUT_SETTING_KEY } });
    const parsed = Number(setting?.value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_TASK_TIMEOUT_SECONDS;
    }
    return Math.trunc(parsed);
  }

  private isAbortError(error: unknown) {
    return (
      error instanceof Error &&
      (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
    );
  }
}
