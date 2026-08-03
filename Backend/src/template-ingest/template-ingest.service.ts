import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Asset, Prisma, Template, TemplateCategory } from "@prisma/client";
import { AssetsService } from "../assets/assets.service";
import { OperationService } from "../operation/operation.service";
import { FINANCE_CREDIT_PER_CNY, PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicTemplateId, toTemplateUuid } from "../templates/local-template-ids";
import { sortTemplatesByCategoryOrder } from "../templates/template-ordering";
import { CreateTemplateCoverUploadUrlDto } from "./dto/create-cover-upload-url.dto";
import { CreateTemplateIngestDto } from "./dto/create-template-ingest.dto";
import {
  CreateTemplateIngestCategoryDto,
  UpdateTemplateIngestCategoryDto,
} from "./dto/template-ingest-category.dto";
import { TemplateIngestReorderItemDto } from "./dto/template-ingest-reorder.dto";
import { UpdateTemplateIngestDto } from "./dto/update-template-ingest.dto";

const allowedIngestAssetTypes = ["template_cover", "operation_banner"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type TemplateWithCover = Template & { coverAsset?: Asset | null };

type TemplateStats = {
  task_count: number;
  succeeded_count: number;
  failed_count: number;
  running_count: number;
  favorite_count: number;
  success_rate: number;
};

@Injectable()
export class TemplateIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly operation: OperationService,
    private readonly pricing: PricingService,
  ) {}

  async listCategories() {
    const categories = await this.prisma.templateCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return {
      success: true,
      data: {
        items: categories.map((category) => this.serializeCategory(category)),
        total: categories.length,
      },
    };
  }

  async createCategory(dto: CreateTemplateIngestCategoryDto) {
    const name = this.trimRequired(dto.name, "name is required");
    const displayName = String(dto.display_name ?? "").trim() || name;
    const existing = await this.prisma.templateCategory.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException("Category already exists");
    }

    const maxOrder = await this.prisma.templateCategory.aggregate({
      _max: { sortOrder: true },
    });
    const category = await this.prisma.templateCategory.create({
      data: {
        name,
        displayName,
        icon: String(dto.icon ?? "").trim() || null,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });

    return { success: true, data: this.serializeCategory(category) };
  }

  async updateCategory(id: string, dto: UpdateTemplateIngestCategoryDto) {
    const existing = await this.prisma.templateCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Category not found");
    }

    const data: Prisma.TemplateCategoryUncheckedUpdateInput = {};
    let nextName = existing.name;
    if (dto.name !== undefined) {
      nextName = this.trimRequired(dto.name, "name cannot be empty");
      const conflict = await this.prisma.templateCategory.findFirst({
        where: { name: nextName, id: { not: id } },
      });
      if (conflict) {
        throw new BadRequestException("Category already exists");
      }
      data.name = nextName;
    }
    if (dto.display_name !== undefined) {
      data.displayName = String(dto.display_name).trim() || nextName;
    }
    if (dto.icon !== undefined) {
      data.icon = String(dto.icon).trim() || null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const category = await tx.templateCategory.update({ where: { id }, data });
      if (nextName !== existing.name) {
        await tx.template.updateMany({
          where: { category: existing.name },
          data: { category: nextName },
        });
      }
      return category;
    });

    return { success: true, data: this.serializeCategory(updated) };
  }

  async removeCategory(id: string) {
    const existing = await this.prisma.templateCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Category not found");
    }

    const templateCount = await this.prisma.template.count({ where: { category: existing.name } });
    if (templateCount > 0) {
      throw new BadRequestException("Category is used by templates");
    }

    await this.prisma.templateCategory.delete({ where: { id } });
    return { success: true, data: { deleted: true } };
  }

  async reorderCategories(items: TemplateIngestReorderItemDto[]) {
    return this.reorderByIds("category", items);
  }

  async getAgentContext() {
    const [templates, categories, assets, homeBanners, pricing] = await Promise.all([
      this.listTemplates({ page_size: "1000" }),
      this.listCategories(),
      this.listAssets(),
      this.getHomeBanners(),
      this.getPricingSettings(),
    ]);

    return {
      success: true,
      data: {
        templates: templates.data,
        categories: categories.data,
        assets: assets.data,
        operation: homeBanners.data,
        pricing: pricing.data,
      },
    };
  }

  async listAssets(assetType = "template_cover") {
    const normalizedAssetType = String(assetType || "template_cover").trim();
    if (!allowedIngestAssetTypes.includes(normalizedAssetType as (typeof allowedIngestAssetTypes)[number])) {
      throw new BadRequestException("asset_type is not supported");
    }

    const assets = await this.prisma.asset.findMany({
      where: { assetType: normalizedAssetType },
      include: { _count: { select: { templateCovers: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return {
      success: true,
      data: {
        items: assets.map((asset) => ({
          id: asset.id,
          asset_type: asset.assetType,
          storage_key: asset.storageKey,
          public_url: this.assets.getPublicUrl(asset.storageKey),
          used_by_template_count: asset._count.templateCovers,
          created_at: asset.createdAt.toISOString(),
        })),
        total: assets.length,
      },
    };
  }

  async createCoverUploadUrl(dto: CreateTemplateCoverUploadUrlDto) {
    const upload = await this.assets.createUploadUrlForAdmin({
      asset_type: "template_cover",
      content_type: dto.content_type ?? "image/png",
    });

    return {
      success: true,
      data: {
        ...upload,
        public_url: this.assets.getPublicUrl(upload.storage_key),
      },
    };
  }

  async createOperationBannerUploadUrl(dto: CreateTemplateCoverUploadUrlDto) {
    const upload = await this.assets.createUploadUrlForAdmin({
      asset_type: "operation_banner",
      content_type: dto.content_type ?? "image/png",
    });

    return {
      success: true,
      data: {
        ...upload,
        public_url: this.assets.getPublicUrl(upload.storage_key),
      },
    };
  }

  async getHomeBanners() {
    return { success: true, data: await this.operation.getAdminConfig() };
  }

  async updateHomeBanners(input: Record<string, unknown>) {
    const rawBanners = Array.isArray(input.home_banners) ? input.home_banners : [];
    const homeBanners = rawBanners.map((item) => {
      const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        ...record,
        template_id: toTemplateUuid(String(record.template_id ?? record.templateId ?? "").trim()),
      };
    });

    await this.assertHomeBannerRefs(homeBanners);
    return { success: true, data: await this.operation.updateAdminConfig({ home_banners: homeBanners }) };
  }

  async getPricingSettings() {
    return {
      success: true,
      data: {
        global_pricing_multiplier: await this.pricing.getGlobalPricingMultiplier(),
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

  async listTemplates(params: {
    page?: string;
    page_size?: string;
    q?: string;
    category?: string;
    status?: string;
  } = {}) {
    const page = this.readPositiveInteger(params.page, 1);
    const pageSize = Math.min(this.readPositiveInteger(params.page_size, 50), 1000);
    const q = String(params.q || "").trim();
    const category = String(params.category || "").trim();
    const status = String(params.status || "").trim();
    const where: Prisma.TemplateWhereInput = {
      ...(q ? { name: { contains: q } } : {}),
      ...(category ? { category } : {}),
      ...(status && status !== "all" ? { status } : {}),
    };

    const [allTemplates, categoryOrderByName] = await Promise.all([
      this.prisma.template.findMany({
        where,
        include: { coverAsset: true },
      }),
      this.getCategoryOrderByName(),
    ]);
    const orderedTemplates = sortTemplatesByCategoryOrder(allTemplates, categoryOrderByName);
    const total = orderedTemplates.length;
    const items = orderedTemplates.slice((page - 1) * pageSize, page * pageSize);
    const stats = await this.getTemplateStatsByIds(items.map((template) => template.id));

    return {
      success: true,
      data: {
        items: items.map((template) => this.serializeTemplate(template, stats.get(template.id))),
        total,
        page,
        page_size: pageSize,
        total_pages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async createTemplate(dto: CreateTemplateIngestDto) {
    const name = dto.name.trim();
    const category = dto.category.trim();
    const prompt = dto.prompt.trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }
    if (!category) {
      throw new BadRequestException("category is required");
    }
    if (!prompt) {
      throw new BadRequestException("prompt is required");
    }

    const [existingCategory, coverAsset, maxOrder] = await Promise.all([
      this.prisma.templateCategory.findUnique({ where: { name: category } }),
      this.getUploadedAsset(dto.cover_asset_id, ["template_cover"], "Cover asset must be template_cover"),
      this.prisma.template.aggregate({
        where: { category },
        _max: { sortOrder: true },
      }),
    ]);

    if (!existingCategory) {
      throw new BadRequestException("Category does not exist");
    }

    const sortOrder = (maxOrder._max.sortOrder ?? 0) + 10;
    const template = await this.prisma.template.create({
      data: {
        name,
        category,
        coverAssetId: coverAsset.id,
        prompt,
        priceCredits: dto.price_credits,
        resultCount: dto.result_count ?? 1,
        sortOrder,
        status: "published",
      },
      include: { coverAsset: true },
    });

    return {
      success: true,
      data: this.serializeTemplate(template),
    };
  }

  async reorderTemplates(items: TemplateIngestReorderItemDto[]) {
    return this.reorderByIds("template", items);
  }

  async getTemplate(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: toTemplateUuid(id) },
      include: { coverAsset: true },
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    const stats = await this.getTemplateStatsByIds([template.id]);
    return { success: true, data: this.serializeTemplate(template, stats.get(template.id)) };
  }

  async updateTemplate(id: string, dto: UpdateTemplateIngestDto) {
    const uuid = toTemplateUuid(id);
    const existing = await this.prisma.template.findUnique({ where: { id: uuid } });
    if (!existing) {
      throw new NotFoundException("Template not found");
    }

    const data: Prisma.TemplateUncheckedUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = this.trimRequired(dto.name, "name cannot be empty");
    }
    if (dto.prompt !== undefined) {
      data.prompt = this.trimRequired(dto.prompt, "prompt cannot be empty");
    }
    if (dto.price_credits !== undefined) {
      data.priceCredits = dto.price_credits;
    }
    if (dto.result_count !== undefined) {
      data.resultCount = dto.result_count;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }
    if (dto.cover_asset_id !== undefined) {
      const coverAsset = await this.getUploadedAsset(
        dto.cover_asset_id,
        ["template_cover"],
        "Cover asset must be template_cover",
      );
      data.coverAssetId = coverAsset.id;
    }
    if (dto.category !== undefined) {
      const category = this.trimRequired(dto.category, "category cannot be empty");
      await this.assertCategoryExists(category);
      data.category = category;
      if (category !== existing.category && dto.sort_order === undefined) {
        data.sortOrder = await this.getNextTemplateSortOrder(category);
      }
    }
    if (dto.sort_order !== undefined) {
      data.sortOrder = Math.max(0, Math.trunc(dto.sort_order));
    }

    const updated = Object.keys(data).length > 0
      ? await this.prisma.template.update({
          where: { id: uuid },
          data,
          include: { coverAsset: true },
        })
      : await this.prisma.template.findUniqueOrThrow({
          where: { id: uuid },
          include: { coverAsset: true },
        });
    const stats = await this.getTemplateStatsByIds([updated.id]);

    return { success: true, data: this.serializeTemplate(updated, stats.get(updated.id)) };
  }

  async removeTemplate(id: string, confirmName?: string) {
    const uuid = toTemplateUuid(id);
    const template = await this.prisma.template.findUnique({ where: { id: uuid } });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    if (String(confirmName || "").trim() !== template.name) {
      throw new BadRequestException("confirm_name must match template name");
    }

    const taskCount = await this.prisma.task.count({ where: { templateId: uuid } });
    if (taskCount > 0) {
      throw new BadRequestException("Template has tasks; archive it by status instead");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.favorite.deleteMany({ where: { templateId: uuid } });
      await tx.template.delete({ where: { id: uuid } });
    });

    return { success: true, data: { deleted: true } };
  }

  private async assertCategoryExists(category: string) {
    const existingCategory = await this.prisma.templateCategory.findUnique({ where: { name: category } });
    if (!existingCategory) {
      throw new BadRequestException("Category does not exist");
    }
  }

  private async getUploadedAsset(assetId: string, allowedTypes: string[], typeErrorMessage: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new BadRequestException("Asset not found");
    }
    if (!allowedTypes.includes(asset.assetType)) {
      throw new BadRequestException(typeErrorMessage);
    }

    try {
      await this.assets.assertUploaded(asset.storageKey);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException("Asset is not uploaded or reachable");
      }
      throw error;
    }
    return asset;
  }

  private async assertHomeBannerRefs(homeBanners: Record<string, unknown>[]) {
    for (const [index, banner] of homeBanners.entries()) {
      const templateId = String(banner.template_id || "").trim();
      if (!templateId) {
        throw new BadRequestException(`home_banners[${index}].template_id is required`);
      }
      const template = await this.prisma.template.findUnique({ where: { id: templateId } });
      if (!template) {
        throw new BadRequestException(`home_banners[${index}].template_id does not exist`);
      }

      const imageAssetId = String(banner.image_asset_id || "").trim();
      if (imageAssetId && uuidPattern.test(imageAssetId)) {
        await this.getUploadedAsset(
          imageAssetId,
          ["operation_banner", "template_cover"],
          `home_banners[${index}].image_asset_id type is not supported`,
        );
      }
    }
  }

  private async getNextTemplateSortOrder(category: string) {
    const maxOrder = await this.prisma.template.aggregate({
      where: { category },
      _max: { sortOrder: true },
    });
    return (maxOrder._max.sortOrder ?? 0) + 10;
  }

  private async reorderByIds(type: "template" | "category", items: TemplateIngestReorderItemDto[]) {
    if (!Array.isArray(items) || items.length === 0) {
      return { success: true, data: { updated: 0 } };
    }

    const results = await this.prisma.$transaction(
      items.slice(0, 200).map((item) => {
        const order = Math.max(0, Math.trunc(item.order));
        if (type === "template") {
          return this.prisma.template.updateMany({
            where: { id: toTemplateUuid(item.id) },
            data: { sortOrder: order },
          });
        }
        return this.prisma.templateCategory.updateMany({
          where: { id: item.id },
          data: { sortOrder: order },
        });
      }),
    );

    return {
      success: true,
      data: { updated: results.reduce((sum, result) => sum + result.count, 0) },
    };
  }

  private async getCategoryOrderByName() {
    const categories = await this.prisma.templateCategory.findMany({
      select: { name: true, sortOrder: true },
    });

    return new Map(categories.map((category) => [category.name, category.sortOrder]));
  }

  private async getTemplateStatsByIds(templateIds: string[]) {
    const empty = new Map<string, TemplateStats>();
    if (templateIds.length === 0) {
      return empty;
    }

    const [taskRows, favoriteRows] = await Promise.all([
      this.prisma.task.groupBy({
        by: ["templateId", "status"],
        where: { templateId: { in: templateIds } },
        _count: { _all: true },
      }),
      this.prisma.favorite.groupBy({
        by: ["templateId"],
        where: { templateId: { in: templateIds } },
        _count: { _all: true },
      }),
    ]);

    const stats = new Map<string, TemplateStats>();
    for (const templateId of templateIds) {
      stats.set(templateId, {
        task_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        running_count: 0,
        favorite_count: 0,
        success_rate: 0,
      });
    }

    for (const row of taskRows) {
      const stat = stats.get(row.templateId);
      if (!stat) continue;
      const count = row._count._all;
      stat.task_count += count;
      if (row.status === "succeeded") stat.succeeded_count += count;
      if (row.status === "failed") stat.failed_count += count;
      if (row.status === "pending" || row.status === "running") stat.running_count += count;
    }

    for (const row of favoriteRows) {
      const stat = stats.get(row.templateId);
      if (stat) {
        stat.favorite_count = row._count._all;
      }
    }

    for (const stat of stats.values()) {
      stat.success_rate = stat.task_count > 0
        ? Number(((stat.succeeded_count / stat.task_count) * 100).toFixed(2))
        : 0;
    }

    return stats;
  }

  private serializeCategory(category: TemplateCategory) {
    return {
      id: category.id,
      name: category.name,
      display_name: category.displayName,
      icon: category.icon,
      sort_order: category.sortOrder,
      created_at: category.createdAt.toISOString(),
    };
  }

  private serializeTemplate(template: TemplateWithCover, stats?: TemplateStats) {
    return {
      id: template.id,
      public_id: toPublicTemplateId(template.id),
      name: template.name,
      category: template.category,
      cover_asset_id: template.coverAssetId,
      cover_url: template.coverAsset ? this.assets.getPublicUrl(template.coverAsset.storageKey) : null,
      prompt: template.prompt,
      price_credits: template.priceCredits,
      result_count: template.resultCount,
      sort_order: template.sortOrder,
      status: template.status,
      stats: stats ?? {
        task_count: 0,
        succeeded_count: 0,
        failed_count: 0,
        running_count: 0,
        favorite_count: 0,
        success_rate: 0,
      },
    };
  }

  private trimRequired(value: string, message: string) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      throw new BadRequestException(message);
    }
    return trimmed;
  }

  private readPositiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.trunc(parsed);
  }
}
