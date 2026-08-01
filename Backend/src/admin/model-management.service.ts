import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Template } from "@prisma/client";
import { Redis } from "ioredis";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateTemplateDto } from "../templates/dto/update-template.dto";
import { TemplatesService } from "../templates/templates.service";
import { toTemplateUuid } from "../templates/local-template-ids";

const GLOBAL_PRICING_MULTIPLIER = 1;
const FINANCE_CREDIT_PER_CNY = 10;
const PRICING_MULTIPLIER_REDIS_KEY = "jibian:pricing:global_multiplier";

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

@Injectable()
export class ModelManagementService {
  private readonly redisUrl: string;
  private redis: Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly assets: AssetsService,
    private readonly config: ConfigService,
  ) {
    this.redisUrl = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
  }

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

    const [total, templates, taskRows] = await this.prisma.$transaction([
      this.prisma.template.count({ where }),
      this.prisma.template.findMany({
        where,
        orderBy: { sortOrder: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.findMany({ select: { templateId: true } }),
    ]);

    const usageByTemplate = new Map<string, number>();
    for (const row of taskRows) {
      usageByTemplate.set(row.templateId, (usageByTemplate.get(row.templateId) ?? 0) + 1);
    }
    const coverAssetIds = templates
      .map((template) => template.coverAssetId)
      .filter((id): id is string => Boolean(id));
    const coverAssets = coverAssetIds.length > 0
      ? await this.prisma.asset.findMany({ where: { id: { in: coverAssetIds } } })
      : [];
    const coverUrlByAsset = new Map<string, string>();
    for (const asset of coverAssets) {
      coverUrlByAsset.set(asset.id, this.assets.getPublicUrl(asset.storageKey));
    }
    const items = templates.map((template) =>
      this.toModel(
        template,
        usageByTemplate.get(template.id) ?? 0,
        template.coverAssetId ? coverUrlByAsset.get(template.coverAssetId) ?? null : null,
      ),
    );
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
    if (payload.prompt !== undefined) {
      updateDto.prompt = payload.prompt;
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

    return {
      success: true,
      data: this.toModel(updated, await this.countUsage(uuid), coverUrl),
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
    return {
      success: true,
      data: {
        global_pricing_multiplier: GLOBAL_PRICING_MULTIPLIER,
        finance_credit_per_cny: FINANCE_CREDIT_PER_CNY,
      },
    };
  }

  async updatePricingSettings(globalPricingMultiplier: number) {
    try {
      const redis = this.getRedis();
      if (redis) {
        await redis.set(PRICING_MULTIPLIER_REDIS_KEY, String(globalPricingMultiplier));
      }
    } catch {
      // Redis 不可用时降级：不阻断请求
    }

    return {
      success: true,
      data: {
        global_pricing_multiplier: globalPricingMultiplier,
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
        pricing_observation: null,
      },
    };
  }

  async getPricingObservations() {
    return { success: true, data: { items: [] } };
  }

  // ── Helpers ──

  private async countUsage(templateId: string): Promise<number> {
    return this.prisma.task.count({ where: { templateId } });
  }

  private toModel(template: Template, usageCount: number, coverUrl: string | null = null) {
    const isEnabled = template.status === "published";
    return {
      id: template.id,
      model_id: template.id,
      name: template.name,
      display_name: template.name,
      category: template.category,
      cover_asset_id: template.coverAssetId,
      cover_url: coverUrl,
      description: "",
      prompt: template.prompt,
      type: "image",
      output_type: "image",
      provider: null,
      order: template.sortOrder,
      usage_count: usageCount,
      cost_credits: template.priceCredits,
      credits_cost: template.priceCredits,
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
      pricing_editable: true,
    };
  }

  private getRedis(): Redis | null {
    if (!this.redisUrl) {
      return null;
    }
    if (!this.redis) {
      this.redis = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.on("error", () => {
        // 忽略 Redis 错误
      });
    }
    return this.redis;
  }
}
