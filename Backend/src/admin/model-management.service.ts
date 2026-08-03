import { Injectable, NotFoundException } from "@nestjs/common";
import type { Template } from "@prisma/client";
import { AssetsService } from "../assets/assets.service";
import {
  FINANCE_CREDIT_PER_CNY,
  PricingService,
} from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTemplateDto } from "../templates/dto/update-template.dto";
import { TemplatesService } from "../templates/templates.service";
import { toTemplateUuid } from "../templates/local-template-ids";
import { sortTemplatesByCategoryOrder } from "../templates/template-ordering";

export interface UpdateModelPayload {
  display_name?: string;
  category?: string;
  cover_asset_id?: string;
  description?: string;
  prompt?: string;
  credits_cost?: number;
  order?: number | null;
  is_enabled?: boolean;
  status?: string | null;
}

export interface ReorderModelItem {
  model_id: string;
  order: number;
}

interface ModelPerformanceStats {
  avgProcessingTime: number;
  successRate: number;
  dailyUsage: number;
  totalUsage: number;
}

interface ModelPerformanceTaskRow {
  templateId: string;
  status: string;
  createdAt: Date;
  durationMs: number | null;
}

function emptyPerformanceStats(): ModelPerformanceStats {
  return {
    avgProcessingTime: 0,
    successRate: 0,
    dailyUsage: 0,
    totalUsage: 0,
  };
}

@Injectable()
export class ModelManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly assets: AssetsService,
    private readonly pricing: PricingService,
  ) {}

  async list(params: {
    page: number;
    pageSize: number;
    q?: string;
    modelTypes?: string[];
    skipPricing?: boolean;
  }) {
    const page = Number.isFinite(params.page) && params.page > 0 ? Math.trunc(params.page) : 1;
    const pageSize =
      Number.isFinite(params.pageSize) && params.pageSize > 0
        ? Math.min(Math.trunc(params.pageSize), 200)
        : 20;
    const q = String(params.q || "").trim();
    const types = Array.isArray(params.modelTypes)
      ? params.modelTypes.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
      : [];
    // 模板一律视为 image 类型模型
    const supportsImage = types.length === 0 || types.includes("image");

    const emptyPage = {
      success: true,
      data: {
        items: [],
        total: 0,
        page,
        page_size: pageSize,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    };

    if (!supportsImage) {
      return emptyPage;
    }

    const where = q ? { name: { contains: q } } : {};

    const [allTemplates, categoryOrderByName, globalPricingMultiplier] = await Promise.all([
      this.prisma.template.findMany({ where }),
      this.getCategoryOrderByName(),
      this.pricing.getGlobalPricingMultiplier(),
    ]);
    const orderedTemplates = sortTemplatesByCategoryOrder(allTemplates, categoryOrderByName);
    const total = orderedTemplates.length;
    const templates = orderedTemplates.slice((page - 1) * pageSize, page * pageSize);

    const templateIds = templates.map((template) => template.id);
    const coverAssetIds = templates
      .map((template) => template.coverAssetId)
      .filter((id): id is string => Boolean(id));
    const [performanceByTemplate, coverAssets] = await Promise.all([
      this.getPerformanceByTemplateIds(templateIds),
      coverAssetIds.length > 0
        ? this.prisma.asset.findMany({ where: { id: { in: coverAssetIds } } })
        : Promise.resolve([]),
    ]);
    const coverUrlByAsset = new Map<string, string>();
    for (const asset of coverAssets) {
      coverUrlByAsset.set(asset.id, this.assets.getPublicUrl(asset.storageKey));
    }
    const items = templates.map((template) => {
      const performance = performanceByTemplate.get(template.id) ?? emptyPerformanceStats();
      return this.toModel(
        template,
        performance.totalUsage,
        template.coverAssetId ? coverUrlByAsset.get(template.coverAssetId) ?? null : null,
        globalPricingMultiplier,
        categoryOrderByName.get(template.category) ?? null,
        performance,
      );
    });
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

  async update(modelId: string, payload: UpdateModelPayload) {
    // 模板 id 为 UUID 列，前端可能传 slug，统一转成 uuid 再查询
    const uuid = toTemplateUuid(modelId);
    const existing = await this.prisma.template.findUnique({ where: { id: uuid } });
    if (!existing) {
      throw new NotFoundException("Model not found");
    }

    const updateDto = new UpdateTemplateDto();
    if (payload.display_name !== undefined) {
      updateDto.name = payload.display_name;
    }
    if (payload.category !== undefined) {
      updateDto.category = payload.category;
    }
    if (payload.cover_asset_id !== undefined) {
      updateDto.cover_asset_id = payload.cover_asset_id;
    }
    if (payload.prompt !== undefined) {
      updateDto.prompt = payload.prompt;
    }
    if (payload.credits_cost !== undefined) {
      updateDto.price_credits = payload.credits_cost;
    }
    if (payload.order != null) {
      updateDto.sort_order = payload.order;
    }
    if (typeof payload.is_enabled === "boolean") {
      updateDto.status = payload.is_enabled ? "published" : "disabled";
    } else if (payload.status != null) {
      updateDto.status = payload.status;
    }

    const updated = Object.keys(updateDto).length > 0
      ? (await this.templates.updateAdmin(uuid, updateDto)).data
      : existing;

    let coverUrl: string | null = null;
    if (updated.coverAssetId) {
      const coverAsset = await this.prisma.asset.findUnique({ where: { id: updated.coverAssetId } });
      if (coverAsset) {
        coverUrl = this.assets.getPublicUrl(coverAsset.storageKey);
      }
    }

    const category = await this.prisma.templateCategory.findUnique({
      where: { name: updated.category },
      select: { sortOrder: true },
    });
    const performance = (await this.getPerformanceByTemplateIds([uuid])).get(uuid) ?? emptyPerformanceStats();

    return {
      success: true,
      data: this.toModel(
        updated,
        performance.totalUsage,
        coverUrl,
        await this.pricing.getGlobalPricingMultiplier(),
        category?.sortOrder ?? null,
        performance,
      ),
    };
  }

  async reorder(items: ReorderModelItem[]) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    const results = await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.template.updateMany({
          where: { id: toTemplateUuid(item.model_id) },
          data: { sortOrder: item.order },
        }),
      ),
    );

    return {
      success: true,
      data: { updated: results.reduce((sum, result) => sum + result.count, 0) },
    };
  }

  async getPricingSettings() {
    const globalPricingMultiplier = await this.pricing.getGlobalPricingMultiplier();
    return {
      success: true,
      data: {
        global_pricing_multiplier: globalPricingMultiplier,
        finance_credit_per_cny: FINANCE_CREDIT_PER_CNY,
      },
    };
  }

  async updatePricingSettings(globalPricingMultiplier: number) {
    const saved = await this.pricing.setGlobalPricingMultiplier(globalPricingMultiplier);

    return {
      success: true,
      data: {
        global_pricing_multiplier: saved,
        finance_credit_per_cny: FINANCE_CREDIT_PER_CNY,
      },
    };
  }

  async getModelPricing(modelId: string) {
    const uuid = toTemplateUuid(modelId);
    const existing = await this.prisma.template.findUnique({ where: { id: uuid } });
    if (!existing) {
      throw new NotFoundException("Model not found");
    }

    return {
      success: true,
      data: {
        model_id: modelId,
        pricing_mode: "fixed",
        pricing_observation: (await this.buildPricingObservations([existing]))[0] ?? null,
      },
    };
  }

  async getPricingObservations() {
    const [templates, categoryOrderByName] = await Promise.all([
      this.prisma.template.findMany(),
      this.getCategoryOrderByName(),
    ]);
    return {
      success: true,
      data: {
        items: await this.buildPricingObservations(
          sortTemplatesByCategoryOrder(templates, categoryOrderByName),
        ),
      },
    };
  }

  // ── Helpers ──

  private async getCategoryOrderByName() {
    const categories = await this.prisma.templateCategory.findMany({
      select: { name: true, sortOrder: true },
    });

    return new Map(categories.map((category) => [category.name, category.sortOrder]));
  }

  private async getPerformanceByTemplateIds(templateIds: string[]) {
    if (templateIds.length === 0) {
      return new Map<string, ModelPerformanceStats>();
    }

    const taskRows = await this.prisma.task.findMany({
      where: { templateId: { in: templateIds } },
      select: {
        templateId: true,
        status: true,
        createdAt: true,
        durationMs: true,
      },
    });

    return this.buildPerformanceByTemplate(taskRows);
  }

  private buildPerformanceByTemplate(taskRows: ModelPerformanceTaskRow[]) {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const buckets = new Map<string, {
      total: number;
      succeeded: number;
      daily: number;
      durationTotalMs: number;
      durationCount: number;
    }>();

    for (const row of taskRows) {
      const bucket = buckets.get(row.templateId) ?? {
        total: 0,
        succeeded: 0,
        daily: 0,
        durationTotalMs: 0,
        durationCount: 0,
      };

      bucket.total += 1;
      if (row.status === "succeeded") {
        bucket.succeeded += 1;
      }
      if (row.createdAt.getTime() >= since) {
        bucket.daily += 1;
      }
      if (typeof row.durationMs === "number" && Number.isFinite(row.durationMs) && row.durationMs > 0) {
        bucket.durationTotalMs += row.durationMs;
        bucket.durationCount += 1;
      }

      buckets.set(row.templateId, bucket);
    }

    return new Map(
      Array.from(buckets.entries()).map(([templateId, bucket]) => [
        templateId,
        {
          avgProcessingTime: bucket.durationCount > 0
            ? Number(((bucket.durationTotalMs / bucket.durationCount) / 1000).toFixed(2))
            : 0,
          successRate: bucket.total > 0 ? Number(((bucket.succeeded / bucket.total) * 100).toFixed(2)) : 0,
          dailyUsage: bucket.daily,
          totalUsage: bucket.total,
        },
      ]),
    );
  }

  private async buildPricingObservations(templates: Template[]) {
    const templateIds = templates.map((template) => template.id);
    const [runs, globalPricingMultiplier] = await Promise.all([
      templateIds.length > 0
        ? this.prisma.sourceRun.findMany({
            where: {
              costAmount: { not: null },
              task: { templateId: { in: templateIds } },
            },
            select: {
              sourceId: true,
              costAmount: true,
              task: { select: { templateId: true } },
            },
          })
        : Promise.resolve([]),
      this.pricing.getGlobalPricingMultiplier(),
    ]);
    const costsByTemplate = new Map<string, Map<string, number[]>>();
    for (const run of runs) {
      const cost = Number(run.costAmount);
      if (!Number.isFinite(cost)) continue;
      const bySource = costsByTemplate.get(run.task.templateId) ?? new Map<string, number[]>();
      const costs = bySource.get(run.sourceId) ?? [];
      costs.push(cost);
      bySource.set(run.sourceId, costs);
      costsByTemplate.set(run.task.templateId, bySource);
    }

    return templates.map((template) => {
      const bySource = costsByTemplate.get(template.id) ?? new Map<string, number[]>();
      const sourceCosts = Object.fromEntries(
        Array.from(bySource.entries()).map(([sourceId, costs]) => [sourceId, this.round4(this.average(costs))]),
      );
      const observedCosts = Object.values(sourceCosts);
      const minCost = observedCosts.length > 0 ? Math.min(...observedCosts) : null;
      const maxCost = observedCosts.length > 0 ? Math.max(...observedCosts) : null;
      return {
        model_id: template.id,
        display_name: template.name,
        type: "image",
        pricing_mode: "fixed",
        pricing_strategy: null,
        currency_basis: "CNY",
        default_spec_key: "default",
        base_credits_cost: template.priceCredits,
        finance_credit_per_cny: FINANCE_CREDIT_PER_CNY,
        finance_cny_per_credit: this.round4(1 / FINANCE_CREDIT_PER_CNY),
        global_pricing_multiplier: globalPricingMultiplier,
        model_pricing_multiplier: 1,
        accept_global_pricing_multiplier: true,
        effective_multiplier: globalPricingMultiplier,
        specs: [{
          pricing_spec_key: "default",
          pricing_spec_params_snapshot: {},
          matched_source_ids: Array.from(bySource.keys()),
          matched_source_costs_cny: sourceCosts,
          min_upstream_cost_cny: minCost,
          max_upstream_cost_cny: maxCost,
          pricing_anchor_cost_cny: maxCost,
          base_credits_cost: template.priceCredits,
          error: null,
        }],
      };
    });
  }

  private average(values: number[]) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private round4(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  private toModel(
    template: Template,
    usageCount: number,
    coverUrl: string | null = null,
    globalPricingMultiplier = 1,
    categorySortOrder: number | null = null,
    performance: ModelPerformanceStats = emptyPerformanceStats(),
  ) {
    const isEnabled = template.status === "published";
    const effectiveCredits = this.pricing.applyMultiplier(template.priceCredits, globalPricingMultiplier);
    return {
      id: template.id,
      model_id: template.id,
      name: template.name,
      display_name: template.name,
      category: template.category,
      category_sort_order: categorySortOrder,
      cover_asset_id: template.coverAssetId,
      cover_url: coverUrl,
      description: "",
      prompt: template.prompt,
      type: "image",
      output_type: "image",
      provider: null,
      order: template.sortOrder,
      usage_count: usageCount,
      performance: {
        avg_processing_time: performance.avgProcessingTime,
        success_rate: performance.successRate,
        daily_usage: performance.dailyUsage,
        total_usage: performance.totalUsage,
      },
      base_credits_cost: template.priceCredits,
      cost_credits: effectiveCredits,
      credits_cost: effectiveCredits,
      pricing_mode: "fixed",
      pricing_strategy: null,
      is_enabled: isEnabled,
      is_active: isEnabled,
      is_available: isEnabled,
      status: template.status,
      features: [],
      supported_ratios: ["16:9", "9:16", "1:1"],
      accept_global_pricing_multiplier: true,
      model_pricing_multiplier: 1,
      effective_multiplier: globalPricingMultiplier,
      pricing_editable: true,
    };
  }
}
