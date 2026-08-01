import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type ListParams = {
  page: number;
  pageSize: number;
  status?: string;
  user?: string;
};

@Injectable()
export class AdminTasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: ListParams) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize = Number.isFinite(params.pageSize) && params.pageSize > 0 ? params.pageSize : 50;
    const where = {
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
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        user: true,
        template: true,
        sourceRuns: true,
      },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    return {
      success: true,
      data: this.mapTask(task),
    };
  }

  async remove(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    await this.prisma.$transaction([
      this.prisma.sourceRun.deleteMany({ where: { taskId: id } }),
      this.prisma.userCreation.deleteMany({ where: { taskId: id } }),
      this.prisma.task.delete({ where: { id } }),
    ]);

    return { success: true, data: { deleted: true } };
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
    errorMessage: string | null;
    createdAt: Date;
    finishedAt: Date | null;
    durationMs: number | null;
    user: { nickname: string | null; phone: string | null };
    template: { name: string; category: string };
    sourceRuns: Array<{ sourceId: string; status: string }>;
  }) {
    return {
      id: task.id,
      user_id: task.userId,
      username: task.user.nickname,
      user_email: task.user.phone,
      status: task.status,
      type: "image",
      model_id: task.template.name,
      operation: task.template.category,
      source_id: task.sourceRuns[0]?.sourceId ?? null,
      attempts: task.sourceRuns.map((run) => ({
        status: run.status,
        source_id: run.sourceId,
      })),
      credits_consumed: task.creditStatus === "charged" ? task.creditCost : 0,
      credits_refunded: task.creditStatus === "refunded" ? task.creditCost : 0,
      visibility: task.isVisible ? null : { user_deleted_at: null, admin_deleted_at: null },
      error_message: task.errorMessage ?? undefined,
      created_at: task.createdAt.toISOString(),
      finished_at: task.finishedAt?.toISOString() ?? null,
      progress: task.status === "succeeded" || task.status === "failed" ? 100 : 50,
    };
  }
}
