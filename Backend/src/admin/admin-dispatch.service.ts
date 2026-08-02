import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  DEFAULT_TASK_TIMEOUT_SECONDS,
  TASK_TIMEOUT_SETTING_KEY,
} from "../common/settings.constants";
import { SourceAdapterRegistry } from "../generation/sources/source-adapter.registry";
import { PrismaService } from "../prisma/prisma.service";

const RUNTIME_KEY = (sourceId: string) => `jibian:dispatch:runtime:${sourceId}`;
const RUNTIME_TTL_SECONDS = 365 * 24 * 60 * 60;

type RuntimeConfig = {
  is_enabled: boolean;
  weight: number;
  priority: number;
};

const RUNTIME_DEFAULTS: RuntimeConfig = { is_enabled: true, weight: 1, priority: 0 };

type SourceMeta = {
  vendor: string;
  display_name: string;
  module_path: string;
  upstream_model_name: string;
};

const SOURCE_META: Record<string, SourceMeta> = {
  "t8-gpt-image-2-edits": {
    vendor: "t8",
    display_name: "T8 图像编辑",
    module_path: "t8-gpt-image-2-edits",
    upstream_model_name: "gpt-image-2",
  },
  "t8-gpt-image-2-generations": {
    vendor: "t8",
    display_name: "T8 图像生成",
    module_path: "t8-gpt-image-2-generations",
    upstream_model_name: "gpt-image-2",
  },
  "grsai-gpt-image-2": {
    vendor: "grsai",
    display_name: "GRSAI GPT-Image-2",
    module_path: "grsai-gpt-image-2",
    upstream_model_name: "gpt-image-2",
  },
  "grsai-gpt-image-2-vip": {
    vendor: "grsai",
    display_name: "GRSAI GPT-Image-2 VIP",
    module_path: "grsai-gpt-image-2-vip",
    upstream_model_name: "gpt-image-2-vip",
  },
  "gpt-image-2-c-kuai-cn": {
    vendor: "kuai",
    display_name: "KUAI 快意(中移)",
    module_path: "gpt-image-2-c-kuai-cn",
    upstream_model_name: "gpt-image-2-c",
  },
  mock: {
    vendor: "mock",
    display_name: "Mock 测试源",
    module_path: "mock-source",
    upstream_model_name: "mock",
  },
};

export type TaskRequestSource = {
  id: string;
  userId: string;
  templateId: string;
  inputAssetId: string;
  expectedResultCount: number;
  isVisible: boolean;
  status: string;
  creditCost: number;
  creditStatus: string;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  ratio: string;
  idempotencyKey: string | null;
  user: { nickname: string | null; phone: string | null };
  template: { id: string; name: string; category: string };
  sourceRuns: Array<{
    id: string;
    sourceId: string;
    status: string;
    upstreamJobId: string | null;
    latencyMs: number | null;
    costAmount: unknown | null;
    sourceErrorMessage: string | null;
    createdAt: Date;
  }>;
};

export type TaskModerationSummary = {
  input: {
    checked: boolean;
    decision: "pass" | "block" | "not_checked";
    ok: boolean | null;
    reason: string | null;
    provider: string | null;
    checked_at: string | null;
  };
  output: {
    checked: boolean;
    decision: "pass" | "block" | "not_checked";
    ok: boolean | null;
    reason: string | null;
    provider: string | null;
    checked_at: string | null;
  };
  has_block: boolean;
};

export function classifySourceError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("polling timeout")) return "timeout";
  if (lower.includes("401") || lower.includes("unauthorized") || lower.includes("api key") || lower.includes("auth")) return "auth";
  if (lower.includes("429") || lower.includes("rate") || lower.includes("limit") || lower.includes("quota")) return "rate_limit";
  if (lower.includes("403") || lower.includes("forbidden")) return "forbidden";
  if (lower.includes("moderation") || lower.includes("rejected")) return "moderation";
  if (lower.includes("missing") || lower.includes("response")) return "invalid_response";
  return "upstream_error";
}

export function aggregateSourceStats(
  runs: Array<{ sourceId: string; status: string }>,
  modelId: string,
): Array<{ model_id: string; source_id: string; total: number; success: number; failure: number; success_rate: number }> {
  const buckets = new Map<string, { total: number; success: number; failure: number }>();
  for (const run of runs) {
    const bucket = buckets.get(run.sourceId) ?? { total: 0, success: 0, failure: 0 };
    bucket.total += 1;
    if (run.status === "success") {
      bucket.success += 1;
    } else if (run.status === "failed") {
      bucket.failure += 1;
    }
    buckets.set(run.sourceId, bucket);
  }
  return Array.from(buckets.entries()).map(([sourceId, bucket]) => ({
    model_id: modelId,
    source_id: sourceId,
    total: bucket.total,
    success: bucket.success,
    failure: bucket.failure,
    success_rate: bucket.total > 0 ? Number(((bucket.success / bucket.total) * 100).toFixed(2)) : 0,
  }));
}

export function taskErrorCode(task: {
  errorMessage: string | null;
  sourceRuns: Array<{ status: string; sourceErrorMessage: string | null }>;
}) {
  const message =
    task.errorMessage ??
    task.sourceRuns.find((run) => run.status === "failed" && run.sourceErrorMessage)?.sourceErrorMessage ??
    null;
  return message ? classifySourceError(message) : null;
}

export function mapTaskRequestItem(task: TaskRequestSource, moderation?: TaskModerationSummary) {
  const firstRun = task.sourceRuns[0];
  return {
    id: task.id,
    user_id: task.userId,
    user_email: task.user.phone,
    username: task.user.nickname,
    request_type: "image",
    model_id: task.template.id,
    model_name: task.template.name,
    source: firstRun?.sourceId ?? null,
    idempotency_key: task.idempotencyKey,
    trace_id: task.id,
    status: task.status,
    task_id: task.id,
    credits_cost: task.creditStatus === "charged" ? task.creditCost : 0,
    cost: task.creditCost,
    duration: task.durationMs,
    error_code: taskErrorCode(task),
    error_message: task.errorMessage,
    moderation,
    meta: {
      template_id: task.templateId,
      input_asset_id: task.inputAssetId,
      expected_result_count: task.expectedResultCount,
      credit_status: task.creditStatus,
      ratio: task.ratio,
    },
    created_at: task.createdAt.toISOString(),
    updated_at: (task.finishedAt ?? task.createdAt).toISOString(),
    finished_at: task.finishedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AdminDispatchService {
  private readonly redis: Redis | null = null;
  private readonly memoryRuntime = new Map<string, RuntimeConfig>();
  private readonly lastUpdatedAt = new Map<string, string>();
  private readonly syncedSourceIds = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sources: SourceAdapterRegistry,
    private readonly config: ConfigService,
  ) {
    const url = config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    if (url) {
      try {
        const client = new Redis(url, {
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
          retryStrategy: () => null,
        });
        client.on("error", () => undefined);
        this.redis = client;
      } catch {
        this.redis = null;
      }
    }
  }

  // ── Model routes（模型层 -> 源头层） ──

  async listModelRoutes(filters: {
    operation?: string;
    model_id?: string;
    source_id?: string;
    enabled?: boolean;
  } = {}) {
    const [adapters, model, timeoutMs] = await Promise.all([
      Promise.resolve(this.sources.getAll()),
      this.resolveDisplayModel(),
      this.readTaskTimeoutMs(),
    ]);
    const items = [];
    for (const [index, adapter] of adapters.entries()) {
      const meta = this.sourceMeta(adapter.sourceId);
      const runtime = await this.readRuntime(adapter.sourceId);
      const route = {
        id: index,
        operation: model.operation,
        model_id: model.id,
        model_name: model.name,
        source_id: adapter.sourceId,
        vendor: meta.vendor,
        display_name: meta.display_name,
        upstream_model_name: meta.upstream_model_name,
        priority: runtime.priority,
        weight: runtime.weight,
        expected_cost: 0,
        timeout_ms: timeoutMs,
        first_commit_timeout_ms: null,
        is_enabled: runtime.is_enabled,
        circuit_breaker_policy: null,
        config: {},
        runtime: { circuit_state: "closed", open_until: null },
        created_at: null,
        updated_at: null,
      };
      if (filters.operation && route.operation !== filters.operation) continue;
      if (filters.model_id && route.model_id !== filters.model_id) continue;
      if (filters.source_id && route.source_id !== filters.source_id) continue;
      if (filters.enabled !== undefined && route.is_enabled !== filters.enabled) continue;
      items.push(route);
    }
    return { success: true, data: { items, total: items.length } };
  }

  // ── Dispatch overview ──

  async getDispatchOverview(hours: number) {
    const windowHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
    const since = new Date(Date.now() - windowHours * 3600 * 1000);
    const runs = await this.prisma.sourceRun.findMany({
      where: { createdAt: { gte: since } },
      select: { sourceId: true, status: true, sourceErrorMessage: true },
    });

    const byStatus: Record<string, number> = {};
    const byErrorType: Record<string, number> = {};
    const bySource = new Map<string, { total: number; success: number; failure: number }>();
    for (const run of runs) {
      byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;
      const bucket = bySource.get(run.sourceId) ?? { total: 0, success: 0, failure: 0 };
      bucket.total += 1;
      if (run.status === "success") {
        bucket.success += 1;
      } else if (run.status === "failed") {
        bucket.failure += 1;
      }
      bySource.set(run.sourceId, bucket);
      if (run.status === "failed" && run.sourceErrorMessage) {
        const type = classifySourceError(run.sourceErrorMessage);
        byErrorType[type] = (byErrorType[type] ?? 0) + 1;
      }
    }

    const total = runs.length;
    const success = byStatus["success"] ?? 0;
    return {
      success: true,
      data: {
        window_hours: windowHours,
        total_attempts: total,
        success_rate: total > 0 ? Number(((success / total) * 100).toFixed(2)) : 0,
        by_status: byStatus,
        by_error_type: byErrorType,
        by_source: Array.from(bySource.entries()).map(([sourceId, bucket]) => ({
          source_id: sourceId,
          total: bucket.total,
          success: bucket.success,
          failure: bucket.failure,
          success_rate: bucket.total > 0 ? Number(((bucket.success / bucket.total) * 100).toFixed(2)) : 0,
        })),
        open_circuits: { routes: 0, half_open_routes: 0 },
        updated_at: new Date().toISOString(),
      },
    };
  }

  // ── Source stats ──

  async getSourceStats(hours: number, filters: { model_id?: string; source_id?: string } = {}) {
    const windowHours = Number.isFinite(hours) && hours > 0 ? hours : 0;
    const since = windowHours > 0 ? new Date(Date.now() - windowHours * 3600 * 1000) : undefined;
    const runs = await this.prisma.sourceRun.findMany({
      where: {
        ...(since ? { createdAt: { gte: since } } : {}),
        ...(filters.source_id ? { sourceId: filters.source_id } : {}),
      },
      select: { sourceId: true, status: true },
    });

    const model = await this.resolveDisplayModel();
    let items = aggregateSourceStats(runs, model.id);
    if (filters.model_id) {
      items = items.filter((item) => item.model_id === filters.model_id);
    }

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

  // ── Dispatch routes（运行时视图） ──

  async listDispatchRoutes(filters: {
    operation?: string;
    model_id?: string;
    source_id?: string;
    enabled?: boolean;
  } = {}) {
    const [adapters, model, timeoutMs] = await Promise.all([
      Promise.resolve(this.sources.getAll()),
      this.resolveDisplayModel(),
      this.readTaskTimeoutMs(),
    ]);
    const items = [];
    for (const [index, adapter] of adapters.entries()) {
      const meta = this.sourceMeta(adapter.sourceId);
      const runtime = await this.readRuntime(adapter.sourceId);
      const route = {
        id: index,
        operation: model.operation,
        model_id: model.id,
        model_name: model.name,
        source_id: adapter.sourceId,
        vendor: meta.vendor,
        display_name: meta.display_name,
        upstream_model_name: meta.upstream_model_name,
        priority: runtime.priority,
        weight: runtime.weight,
        expected_cost: 0,
        timeout_ms: timeoutMs,
        first_commit_timeout_ms: null,
        is_enabled: runtime.is_enabled,
        circuit_breaker_policy: null,
        config: {},
        runtime: { circuit_state: "closed", open_until: null },
        pricing_display_mode: "unknown",
        pricing_display_value_cny: null,
        pricing_display_min_cny: null,
        pricing_display_max_cny: null,
        created_at: null,
        updated_at: null,
      };
      if (filters.operation && route.operation !== filters.operation) continue;
      if (filters.model_id && route.model_id !== filters.model_id) continue;
      if (filters.source_id && route.source_id !== filters.source_id) continue;
      if (filters.enabled !== undefined && route.is_enabled !== filters.enabled) continue;
      items.push(route);
    }
    return { success: true, data: { items, total: items.length } };
  }

  // ── Dispatch attempts ──

  async listDispatchAttempts(params: {
    page?: number;
    page_size?: number;
    limit?: number;
    task_id?: string;
    source_id?: string;
    status?: string;
    error_type?: string;
  }) {
    const page = typeof params.page === "number" && Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSizeValue =
      Number.isFinite(params.page_size) && (params.page_size as number) > 0
        ? (params.page_size as number)
        : Number.isFinite(params.limit) && (params.limit as number) > 0
          ? (params.limit as number)
          : 20;
    const pageSize = Math.min(Math.floor(pageSizeValue), 100);
    const where = {
      ...(params.task_id ? { taskId: params.task_id } : {}),
      ...(params.source_id ? { sourceId: params.source_id } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    if (params.error_type) {
      const failed = await this.prisma.sourceRun.findMany({
        where: { ...where, status: "failed" },
        include: { task: { include: { template: true } } },
        orderBy: { createdAt: "desc" },
      });
      const filtered = failed.filter(
        (run) => run.sourceErrorMessage && classifySourceError(run.sourceErrorMessage) === params.error_type,
      );
      return {
        success: true,
        data: {
          items: filtered.slice((page - 1) * pageSize, page * pageSize).map((run) => this.mapAttempt(run, run.task.template)),
          total: filtered.length,
        },
      };
    }

    const [total, runs] = await this.prisma.$transaction([
      this.prisma.sourceRun.count({ where }),
      this.prisma.sourceRun.findMany({
        where,
        include: { task: { include: { template: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      success: true,
      data: { items: runs.map((run) => this.mapAttempt(run, run.task.template)), total },
    };
  }

  // ── Source providers（registry 视图） ──

  async listSourceProviders(filters: {
    model_id?: string;
    source_id?: string;
    vendor?: string;
    traffic_tier?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  } = {}) {
    const [adapters, model] = await Promise.all([Promise.resolve(this.sources.getAll()), this.resolveDisplayModel()]);
    const items = [];
    for (const adapter of adapters) {
      const meta = this.sourceMeta(adapter.sourceId);
      const runtime = await this.readRuntime(adapter.sourceId);
      const provider = {
        id: adapter.sourceId,
        model_id: model.id,
        upstream_model_name: meta.upstream_model_name,
        base_url: this.envBaseUrl(adapter.sourceId),
        api_key_ref: this.envKeyRef(adapter.sourceId),
        credentials: null,
        param_mapping: { model: meta.upstream_model_name },
        priority: runtime.priority,
        weight: runtime.weight,
        expected_cost: 0,
        constraints: null,
        config: {},
        circuit_breaker_policy: null,
        traffic_tier: "all",
        is_active: adapter.isConfigured(),
        created_at: null,
        updated_at: null,
      };
      if (filters.source_id && provider.id !== filters.source_id) continue;
      if (filters.vendor && meta.vendor !== filters.vendor) continue;
      if (filters.traffic_tier && provider.traffic_tier !== filters.traffic_tier) continue;
      if (filters.is_active !== undefined && provider.is_active !== filters.is_active) continue;
      if (filters.model_id && provider.model_id !== filters.model_id) continue;
      items.push(provider);
    }
    const offset = Number.isFinite(filters.offset) && (filters.offset as number) > 0 ? (filters.offset as number) : 0;
    const limit = Number.isFinite(filters.limit) && (filters.limit as number) > 0 ? (filters.limit as number) : undefined;
    const sliced = limit ? items.slice(offset, offset + limit) : items;
    return { success: true, data: sliced };
  }

  async syncSourceProvidersFromRegistry(options: { bootstrap?: boolean; force_refresh?: boolean } = {}) {
    const adapters = this.sources.getAll();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const adapter of adapters) {
      try {
        if (this.syncedSourceIds.has(adapter.sourceId) && !options.force_refresh) {
          skipped += 1;
        } else {
          created += 1;
          this.syncedSourceIds.add(adapter.sourceId);
        }
      } catch (error: unknown) {
        errors.push(`${adapter.sourceId}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return {
      success: true,
      data: {
        bootstrap: options.bootstrap ?? true,
        force_refresh: options.force_refresh ?? false,
        scanned: adapters.length,
        created,
        updated,
        skipped,
        errors,
      },
    };
  }

  // ── Source runtime profiles ──

  async listSourceRuntimeProfiles() {
    const [adapters, model] = await Promise.all([Promise.resolve(this.sources.getAll()), this.resolveDisplayModel()]);
    const items = [];
    for (const adapter of adapters) {
      const runtime = await this.readRuntime(adapter.sourceId);
      items.push(this.buildProfile(adapter, model.id, runtime));
    }
    return { success: true, data: { items, total: items.length } };
  }

  async patchSourceRuntimeProfile(sourceId: string, payload: { is_enabled?: boolean; weight?: number; priority?: number }) {
    const adapter = this.sources.getAll().find((item) => item.sourceId === sourceId);
    if (!adapter) {
      throw new NotFoundException("Source not found");
    }
    const patch: Partial<RuntimeConfig> = {};
    if (typeof payload.is_enabled === "boolean") {
      patch.is_enabled = payload.is_enabled;
    }
    if (typeof payload.weight === "number" && Number.isFinite(payload.weight)) {
      patch.weight = Math.max(0, payload.weight);
    }
    if (typeof payload.priority === "number" && Number.isFinite(payload.priority)) {
      patch.priority = payload.priority;
    }
    const runtime = await this.writeRuntime(sourceId, patch);
    const model = await this.resolveDisplayModel();
    return { success: true, data: this.buildProfile(adapter, model.id, runtime) };
  }

  // ── Task requests（Task 表视图） ──

  async listTaskRequests(params: {
    page?: number;
    page_size?: number;
    status?: string;
    user?: string;
    model_id?: string;
    source?: string;
    from?: string;
    to?: string;
  }) {
    const page = typeof params.page === "number" && Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize = Number.isFinite(params.page_size) && (params.page_size as number) > 0 ? (params.page_size as number) : 20;
    const where = this.buildTaskWhere(params);

    const [total, tasks] = await this.prisma.$transaction([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: true, template: true, sourceRuns: true },
      }),
    ]);

    const reviewMap = await this.latestReviewRecords(tasks.map((task) => task.id));
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      success: true,
      data: {
        items: tasks.map((task) => mapTaskRequestItem(task, this.buildModerationSummary(reviewMap.get(task.id) ?? []))),
        total,
        page,
        page_size: pageSize,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    };
  }

  async getTaskRequest(requestId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: requestId },
      include: { user: true, template: true, sourceRuns: true, resultAsset: true },
    });
    if (!task) {
      throw new NotFoundException("Task request not found");
    }
    const [reviewMap, creditLedger, reviewRecords] = await Promise.all([
      this.latestReviewRecords([task.id]),
      this.prisma.creditLedger.findMany({
        where: { refType: "task", refId: task.id },
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.reviewRecord.findMany({
        where: { targetId: task.id },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const moderation = this.buildModerationSummary(reviewMap.get(task.id) ?? []);
    return {
      success: true,
      data: {
        ...mapTaskRequestItem(task, moderation),
        task: this.mapTaskDetail(task, moderation),
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

  async getDispatchTaskTimeline(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { template: true, sourceRuns: true },
    });
    if (!task) {
      throw new NotFoundException("Task not found");
    }

    const attempts = task.sourceRuns.map((run) => this.mapAttempt(run, task.template));
    const events = [
      { id: 1, event_type: "task_created", occurred_at: task.createdAt.toISOString(), payload: { task_id: task.id } },
      ...task.sourceRuns.map((run, index) => ({
        id: index + 2,
        event_type: `source_${run.status}`,
        occurred_at: run.createdAt.toISOString(),
        payload: {
          source_id: run.sourceId,
          upstream_job_id: run.upstreamJobId,
          latency_ms: run.latencyMs,
          cost_amount: this.toNumberOrNull(run.costAmount),
          error_message: run.sourceErrorMessage,
        },
      })),
      ...(task.finishedAt
        ? [
            {
              id: task.sourceRuns.length + 2,
              event_type: "task_finished",
              occurred_at: task.finishedAt.toISOString(),
              payload: { status: task.status },
            },
          ]
        : []),
    ];

    return {
      success: true,
      data: {
        task: {
          id: task.id,
          status: task.status,
          error_code: taskErrorCode(task),
          error_message: task.errorMessage,
          created_at: task.createdAt.toISOString(),
          started_at: task.sourceRuns[0]?.createdAt.toISOString() ?? task.createdAt.toISOString(),
          updated_at: (task.finishedAt ?? task.createdAt).toISOString(),
          finished_at: task.finishedAt?.toISOString() ?? null,
        },
        source_run: {
          source_run_id: task.sourceRuns[0]?.id ?? null,
          upstream_job_id: task.sourceRuns[0]?.upstreamJobId ?? null,
          latency_ms: task.sourceRuns[0]?.latencyMs ?? null,
          cost_amount: this.toNumberOrNull(task.sourceRuns[0]?.costAmount ?? null),
          source_callback: null,
        },
        attempts,
        events,
      },
    };
  }

  async getTaskRequestOverview(params: {
    status?: string;
    user?: string;
    model_id?: string;
    source?: string;
    from?: string;
    to?: string;
  }) {
    const where = this.buildTaskWhere(params);
    const [byStatus, creditsAgg, recentErrors, groupRows] = await Promise.all([
      this.prisma.task.groupBy({ by: ["status"], where, _count: { _all: true } }),
      this.prisma.task.aggregate({ where: { ...where, creditStatus: "charged" }, _sum: { creditCost: true } }),
      this.prisma.task.findMany({
        where: { ...where, status: "failed", errorMessage: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: true, template: true, sourceRuns: { orderBy: { createdAt: "asc" }, take: 1 } },
      }),
      this.prisma.task.groupBy({ by: ["templateId", "status"], where, _count: { _all: true }, _sum: { creditCost: true } }),
    ]);

    const countByStatus = (status: string) => byStatus.find((row) => row.status === status)?._count._all ?? 0;
    const total = countByStatus("running") + countByStatus("succeeded") + countByStatus("failed");
    const succeeded = countByStatus("succeeded");
    const failed = countByStatus("failed");
    const running = countByStatus("running");

    const templateIds = Array.from(new Set(groupRows.map((row) => row.templateId)));
    const templates = templateIds.length
      ? await this.prisma.template.findMany({ where: { id: { in: templateIds } }, select: { id: true, name: true } })
      : [];
    const templateNames = new Map(templates.map((template) => [template.id, template.name]));

    const modelStats = new Map<string, { request_count: number; success_count: number; failure_count: number; credits_cost: number }>();
    for (const row of groupRows) {
      const stat = modelStats.get(row.templateId) ?? { request_count: 0, success_count: 0, failure_count: 0, credits_cost: 0 };
      stat.request_count += row._count._all;
      stat.credits_cost += row._sum.creditCost ?? 0;
      if (row.status === "succeeded") stat.success_count += row._count._all;
      if (row.status === "failed") stat.failure_count += row._count._all;
      modelStats.set(row.templateId, stat);
    }

    const topModels = Array.from(modelStats.entries())
      .map(([modelId, stat]) => ({
        model_id: modelId,
        model_name: templateNames.get(modelId) ?? null,
        request_count: stat.request_count,
        success_count: stat.success_count,
        failure_count: stat.failure_count,
        credits_cost: stat.credits_cost,
        success_rate: stat.request_count > 0 ? Number(((stat.success_count / stat.request_count) * 100).toFixed(2)) : 0,
        failure_rate: stat.request_count > 0 ? Number(((stat.failure_count / stat.request_count) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.request_count - a.request_count)
      .slice(0, 10);

    return {
      success: true,
      data: {
        total_requests: total,
        success_count: succeeded,
        failure_count: failed,
        in_progress_count: running,
        duplicated_count: 0,
        total_credits_cost: creditsAgg._sum.creditCost ?? 0,
        success_rate: total > 0 ? Number(((succeeded / total) * 100).toFixed(2)) : 0,
        failure_rate: total > 0 ? Number(((failed / total) * 100).toFixed(2)) : 0,
        top_models: topModels,
        recent_errors: recentErrors.map((task) => ({
          request_id: task.id,
          user_email: task.user.phone,
          model_id: task.template.id,
          source: task.sourceRuns[0]?.sourceId ?? null,
          error_code: taskErrorCode(task),
          error_message: task.errorMessage,
          trace_id: task.id,
          created_at: task.createdAt.toISOString(),
        })),
      },
    };
  }

  // ── Models（模型管理，来自 Template 表） ──

  async listModels(params: { page: number; pageSize: number; q?: string; modelTypes?: string[] }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? params.page : 1;
    const pageSize = Number.isFinite(params.pageSize) && params.pageSize > 0 ? Math.min(params.pageSize, 200) : 20;
    const q = String(params.q || "").trim();
    const types = Array.isArray(params.modelTypes)
      ? params.modelTypes.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : [];
    const supportsAnyRequestedType =
      types.length === 0 || types.some((type) => type === "image" || type === "llm" || type === "text");

    const where = { ...(q ? { name: { contains: q } } : {}) };
    const [total, templates] = await this.prisma.$transaction([
      this.prisma.template.count({ where }),
      this.prisma.template.findMany({ where, orderBy: { sortOrder: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
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

  private async resolveDisplayModel(): Promise<{ id: string; name: string; operation: string }> {
    const templates = await this.prisma.template.findMany({
      orderBy: { sortOrder: "asc" },
      take: 20,
      select: { id: true, name: true, category: true, status: true },
    });
    const template = templates.find((item) => item.status === "published") ?? templates[0];
    if (template) {
      return { id: template.id, name: template.name, operation: template.category };
    }
    return { id: "default", name: "图片模型", operation: "image" };
  }

  private sourceMeta(sourceId: string): SourceMeta {
    return (
      SOURCE_META[sourceId] ?? {
        vendor: sourceId,
        display_name: sourceId,
        module_path: sourceId,
        upstream_model_name: sourceId,
      }
    );
  }

  private envBaseUrl(sourceId: string): string | null {
    if (sourceId.startsWith("t8-")) return this.config?.get<string>("T8_BASE_URL") ?? null;
    if (sourceId.startsWith("grsai-")) return this.config?.get<string>("GRSAI_API_HOST") ?? null;
    if (sourceId.startsWith("gpt-image-2-c-")) return this.config?.get<string>("KUAI_BASE_URL") ?? "https://api.kuai.host";
    return null;
  }

  private envKeyRef(sourceId: string): string | null {
    if (sourceId.startsWith("t8-")) return "env:T8_API_KEY";
    if (sourceId.startsWith("grsai-")) return "env:GRSAI_API_KEY";
    if (sourceId.startsWith("gpt-image-2-c-")) return "env:KUAI_API_KEY";
    return null;
  }

  private async readRuntime(sourceId: string): Promise<RuntimeConfig> {
    if (this.redis) {
      try {
        const raw = await this.redis.get(RUNTIME_KEY(sourceId));
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<RuntimeConfig>;
          return { ...RUNTIME_DEFAULTS, ...parsed };
        }
      } catch {
        // Redis 不可用，降级为内存 Map
      }
    }
    return this.memoryRuntime.get(sourceId) ?? { ...RUNTIME_DEFAULTS };
  }

  private async writeRuntime(sourceId: string, patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
    const merged = { ...(await this.readRuntime(sourceId)), ...patch };
    if (this.redis) {
      try {
        await this.redis.set(RUNTIME_KEY(sourceId), JSON.stringify(merged), "EX", RUNTIME_TTL_SECONDS);
        this.lastUpdatedAt.set(sourceId, new Date().toISOString());
        return merged;
      } catch {
        // Redis 不可用，降级为内存 Map
      }
    }
    this.memoryRuntime.set(sourceId, merged);
    this.lastUpdatedAt.set(sourceId, new Date().toISOString());
    return merged;
  }

  private async readTaskTimeoutMs() {
    const row = await this.prisma.setting.findUnique({ where: { key: TASK_TIMEOUT_SETTING_KEY } });
    const seconds = Number(row?.value);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      return DEFAULT_TASK_TIMEOUT_SECONDS * 1000;
    }
    return Math.trunc(seconds) * 1000;
  }

  private buildProfile(
    adapter: { sourceId: string; isConfigured(): boolean },
    modelId: string,
    runtime: RuntimeConfig,
  ) {
    const meta = this.sourceMeta(adapter.sourceId);
    const configured = adapter.isConfigured();
    return {
      source_id: adapter.sourceId,
      module_path: meta.module_path,
      model_id: modelId,
      display_name: meta.display_name,
      is_enabled: runtime.is_enabled,
      is_active: configured,
      logical_is_enabled: configured && runtime.is_enabled,
      updated_at: this.lastUpdatedAt.get(adapter.sourceId) ?? null,
    };
  }

  private mapAttempt(
    run: {
      id: string;
      taskId: string;
      sourceId: string;
      status: string;
      upstreamJobId: string | null;
      latencyMs: number | null;
      costAmount: unknown | null;
      sourceErrorMessage: string | null;
      createdAt: Date;
    },
    template: { id: string; category: string },
  ) {
    const meta = this.sourceMeta(run.sourceId);
    const errorType = run.sourceErrorMessage ? classifySourceError(run.sourceErrorMessage) : null;
    return {
      id: run.id,
      task_id: run.taskId,
      operation: template.category,
      model_id: template.id,
      source_id: run.sourceId,
      upstream_model_name: meta.upstream_model_name,
      attempt_no: 1,
      status: run.status,
      error_type: errorType,
      error_code: errorType,
      error_message: run.sourceErrorMessage,
      latency_ms: run.latencyMs,
      cost_amount: this.toNumberOrNull(run.costAmount),
      commit_at: null,
      extra: run.upstreamJobId ? { upstream_job_id: run.upstreamJobId } : undefined,
      created_at: run.createdAt.toISOString(),
    };
  }

  private buildTaskWhere(params: { status?: string; user?: string; model_id?: string; source?: string; from?: string; to?: string }) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (params.from) {
      const from = new Date(params.from);
      if (!Number.isNaN(from.getTime())) createdAt.gte = from;
    }
    if (params.to) {
      const to = new Date(params.to);
      if (!Number.isNaN(to.getTime())) createdAt.lte = to;
    }
    return {
      adminDeletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.model_id ? { templateId: params.model_id } : {}),
      ...(params.user
        ? {
            user: {
              OR: [{ nickname: { contains: params.user } }, { phone: { contains: params.user } }],
            },
          }
        : {}),
      ...(params.source ? { sourceRuns: { some: { sourceId: params.source } } } : {}),
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    };
  }

  private async latestReviewRecords(taskIds: string[]) {
    if (taskIds.length === 0) return new Map<string, Array<{ reviewStage: string; status: string; policyHit: unknown; reason: string | null; createdAt: Date }>>();
    const records = await this.prisma.reviewRecord.findMany({
      where: { targetId: { in: taskIds } },
      orderBy: { createdAt: "desc" },
      select: { targetId: true, reviewStage: true, status: true, policyHit: true, reason: true, createdAt: true },
    });
    const byTask = new Map<string, Array<typeof records[number]>>();
    for (const record of records) {
      const list = byTask.get(record.targetId) ?? [];
      list.push(record);
      byTask.set(record.targetId, list);
    }
    return byTask;
  }

  private buildModerationSummary(
    records: Array<{ reviewStage: string; status: string; policyHit: unknown; reason: string | null; createdAt: Date }>,
  ): TaskModerationSummary | undefined {
    if (records.length === 0) return undefined;
    type BlockInfo = TaskModerationSummary["input"];
    const latest = (stage: string) => records.find((record) => record.reviewStage === stage);
    const toBlock = (record: typeof records[number] | undefined): BlockInfo => {
      if (!record) {
        return { checked: false, decision: "not_checked", ok: null, reason: null, provider: null, checked_at: null };
      }
      const passed = record.status === "approved";
      return {
        checked: true,
        decision: passed ? "pass" : "block",
        ok: passed,
        reason: record.reason,
        provider: null,
        checked_at: record.createdAt.toISOString(),
      };
    };
    const input = toBlock(latest("input"));
    const output = toBlock(latest("output"));
    return { input, output, has_block: input.ok === false || output.ok === false };
  }

  private mapTaskDetail(
    task: TaskRequestSource & {
      resultAsset?: { id: string } | null;
      inputAsset?: { id: string } | null;
    },
    moderation?: TaskModerationSummary,
  ) {
    const firstRun = task.sourceRuns[0];
    const meta = firstRun ? this.sourceMeta(firstRun.sourceId) : undefined;
    return {
      id: task.id,
      user_id: task.userId,
      username: task.user.nickname,
      user_email: task.user.phone,
      status: task.status,
      type: "image",
      model_id: task.template.id,
      operation: task.template.category,
      source: firstRun?.sourceId ?? null,
      source_id: firstRun?.sourceId ?? null,
      vendor: meta?.vendor ?? null,
      upstream_model_name: meta?.upstream_model_name ?? null,
      attempts: task.sourceRuns.map((run) => ({
        error_code: run.sourceErrorMessage ? classifySourceError(run.sourceErrorMessage) : null,
        attempt_no: 1,
        status: run.status,
        source_id: run.sourceId,
        vendor: this.sourceMeta(run.sourceId).vendor,
        upstream_job_id: run.upstreamJobId,
        latency_ms: run.latencyMs,
        cost_amount: this.toNumberOrNull(run.costAmount),
        error_message: run.sourceErrorMessage,
      })),
      created_at: task.createdAt.toISOString(),
      started_at: firstRun?.createdAt.toISOString() ?? task.createdAt.toISOString(),
      updated_at: (task.finishedAt ?? task.createdAt).toISOString(),
      finished_at: task.finishedAt?.toISOString() ?? null,
      error_code: taskErrorCode(task),
      error_message: task.errorMessage,
      credits_reserved: task.creditCost,
      credits_consumed: task.creditStatus === "charged" ? task.creditCost : 0,
      credits_refunded: task.creditStatus === "refunded" ? task.creditCost : 0,
      progress: task.status === "succeeded" || task.status === "failed" ? 100 : 50,
      moderation,
    };
  }

  private toNumberOrNull(value: unknown) {
    if (value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
}
