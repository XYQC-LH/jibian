import { Injectable, NotFoundException } from "@nestjs/common";
import { SourceAdapterRegistry } from "../generation/sources/source-adapter.registry";
import { PrismaService } from "../prisma/prisma.service";

const SOURCE_META: Record<
  string,
  { vendor: string; display_name: string; module_path: string }
> = {
  "t8-gpt-image-2-edits": {
    vendor: "t8",
    display_name: "T8 图像编辑",
    module_path: "t8-gpt-image-2-edits",
  },
  "t8-gpt-image-2-generations": {
    vendor: "t8",
    display_name: "T8 图像生成",
    module_path: "t8-gpt-image-2-generations",
  },
  "grsai-gpt-image-2": {
    vendor: "grsai",
    display_name: "GRSAI GPT-Image-2",
    module_path: "grsai-gpt-image-2",
  },
  "grsai-gpt-image-2-vip": {
    vendor: "grsai",
    display_name: "GRSAI GPT-Image-2 VIP",
    module_path: "grsai-gpt-image-2-vip",
  },
  "gpt-image-2-c-kuai-cn": {
    vendor: "kuai",
    display_name: "KUAI 快意(中移)",
    module_path: "gpt-image-2-c-kuai-cn",
  },
  "mock-source": {
    vendor: "mock",
    display_name: "Mock 测试源",
    module_path: "mock-source",
  },
};

@Injectable()
export class AdminDispatchService {
  // 内存态的源头启用开关（MVP：不落库，重启后恢复默认）
  private readonly profileOverrides = new Map<string, boolean>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: SourceAdapterRegistry,
  ) {}

  // ── Routes ──

  async listDispatchRoutes() {
    const [templates, adapters] = await Promise.all([
      this.prisma.template.findMany({ orderBy: { sortOrder: "asc" } }),
      Promise.resolve(this.sources.getAll()),
    ]);

    const items = templates.flatMap((template) =>
      adapters.map((adapter, index) => {
        const meta = SOURCE_META[adapter.sourceId] ?? {
          vendor: adapter.sourceId,
          display_name: adapter.sourceId,
          module_path: adapter.sourceId,
        };
        return {
          id: index,
          operation: template.category,
          model_id: template.id,
          source_id: adapter.sourceId,
          vendor: meta.vendor,
          display_name: meta.display_name,
          upstream_model_name: "gpt-image-2",
          priority: index,
          weight: 1,
          expected_cost: 0,
          timeout_ms: 120000,
          is_enabled: this.isSourceEnabled(adapter.sourceId),
          runtime: { circuit_state: "closed" as const },
        };
      }),
    );

    return { success: true, data: { items, total: items.length } };
  }

  // ── Runtime profiles ──

  async listSourceRuntimeProfiles() {
    const adapters = this.sources.getAll();
    const items = adapters.map((adapter) => {
      const meta = SOURCE_META[adapter.sourceId] ?? {
        vendor: adapter.sourceId,
        display_name: adapter.sourceId,
        module_path: adapter.sourceId,
      };
      const configured = adapter.isConfigured();
      return {
        source_id: adapter.sourceId,
        module_path: meta.module_path,
        model_id: "gpt-image-2",
        display_name: meta.display_name,
        is_enabled: this.isSourceEnabled(adapter.sourceId),
        is_active: configured,
        logical_is_enabled: configured && this.isSourceEnabled(adapter.sourceId),
        updated_at: null,
      };
    });

    return { success: true, data: { items, total: items.length } };
  }

  async patchSourceRuntimeProfile(sourceId: string, payload: { is_enabled?: boolean }) {
    const adapters = this.sources.getAll();
    const adapter = adapters.find((item) => item.sourceId === sourceId);
    if (!adapter) {
      throw new NotFoundException("Source not found");
    }

    if (typeof payload.is_enabled === "boolean") {
      this.profileOverrides.set(sourceId, payload.is_enabled);
    }

    const meta = SOURCE_META[adapter.sourceId] ?? {
      vendor: adapter.sourceId,
      display_name: adapter.sourceId,
      module_path: adapter.sourceId,
    };
    const configured = adapter.isConfigured();
    return {
      success: true,
      data: {
        source_id: adapter.sourceId,
        module_path: meta.module_path,
        model_id: "gpt-image-2",
        display_name: meta.display_name,
        is_enabled: this.isSourceEnabled(adapter.sourceId),
        is_active: configured,
        logical_is_enabled: configured && this.isSourceEnabled(adapter.sourceId),
        updated_at: new Date().toISOString(),
      },
    };
  }

  // ── Source stats ──

  async getSourceStats(hours: number, filters: { model_id?: string; source_id?: string } = {}) {
    const windowHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
    const since = windowHours > 0 ? new Date(Date.now() - windowHours * 3600 * 1000) : null;

    const runs = await this.prisma.sourceRun.findMany({
      where: {
        ...(since ? { createdAt: { gte: since } } : {}),
        ...(filters.source_id ? { sourceId: filters.source_id } : {}),
      },
      select: { taskId: true, sourceId: true, status: true },
    });

    const taskIds = Array.from(new Set(runs.map((run) => run.taskId)));
    const tasks = await this.prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, templateId: true },
    });
    const templateByTask = new Map(tasks.map((task) => [task.id, task.templateId]));

    const buckets = new Map<string, { total: number; success: number; failure: number }>();
    for (const run of runs) {
      const modelId = templateByTask.get(run.taskId);
      if (!modelId) continue;
      if (filters.model_id && filters.model_id !== modelId) continue;

      const key = `${modelId}::${run.sourceId}`;
      const bucket = buckets.get(key) ?? { total: 0, success: 0, failure: 0 };
      bucket.total += 1;
      if (run.status === "success") {
        bucket.success += 1;
      } else if (run.status === "failed") {
        bucket.failure += 1;
      }
      buckets.set(key, bucket);
    }

    const items = Array.from(buckets.entries()).map(([key, bucket]) => {
      const [modelId, sourceId] = key.split("::");
      return {
        model_id: modelId,
        source_id: sourceId,
        total: bucket.total,
        success: bucket.success,
        failure: bucket.failure,
        success_rate: bucket.total > 0 ? Number(((bucket.success / bucket.total) * 100).toFixed(2)) : 0,
      };
    });

    return {
      success: true,
      data: {
        window_hours: windowHours,
        total: items.reduce((sum, item) => sum + item.total, 0),
        items,
        updated_at: new Date().toISOString(),
      },
    };
  }

  // ── Models (from templates) ──

  async listModels(params: {
    page: number;
    pageSize: number;
    q?: string;
    modelTypes?: string[];
  }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize =
      Number.isFinite(params.pageSize) && params.pageSize > 0
        ? Math.min(params.pageSize, 200)
        : 20;
    const q = String(params.q || "").trim();

    const types = Array.isArray(params.modelTypes)
      ? params.modelTypes.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : [];
    const supportsAnyRequestedType =
      types.length === 0 || types.some((type) => type === "image" || type === "llm" || type === "text");

    const where = {
      ...(q ? { name: { contains: q } } : {}),
    };

    const [total, templates] = await this.prisma.$transaction([
      this.prisma.template.count({ where }),
      this.prisma.template.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items = supportsAnyRequestedType
      ? templates.map((template) => ({
          id: template.id,
          model_id: template.id,
          name: template.name,
          display_name: template.name,
          type: "image",
          output_type: "image",
          status: template.status,
          is_enabled: template.status === "published",
          is_active: template.status === "published",
          order: template.sortOrder,
          credits_cost: template.priceCredits,
          cost_credits: template.priceCredits,
        }))
      : [];

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      success: true,
      data: {
        items,
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  // ── Helpers ──

  private isSourceEnabled(sourceId: string): boolean {
    const override = this.profileOverrides.get(sourceId);
    return override ?? true;
  }
}
