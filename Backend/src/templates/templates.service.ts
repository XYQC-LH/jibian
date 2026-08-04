import { Injectable } from "@nestjs/common";
import { AssetsService } from "../assets/assets.service";
import { PricingService } from "../pricing/pricing.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { toPublicTemplateId } from "./local-template-ids";
import { sortTemplatesByCategoryOrder } from "./template-ordering";
import { UpdateTemplateDto } from "./dto/update-template.dto";

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly pricing: PricingService,
  ) {}

  async listPublished() {
    const [templates, categoryOrderByName, multiplier] = await Promise.all([
      this.prisma.template.findMany({
        where: { status: "published" },
        select: {
          id: true,
          name: true,
          category: true,
          coverAssetId: true,
          coverAsset: { select: { storageKey: true } },
          priceCredits: true,
          resultCount: true,
          sortOrder: true,
          status: true,
        },
      }),
      this.getCategoryOrderByName(),
      this.pricing.getGlobalPricingMultiplier(),
    ]);

    return sortTemplatesByCategoryOrder(templates, categoryOrderByName).map((template) => ({
      id: toPublicTemplateId(template.id),
      name: template.name,
      category: template.category,
      cover_asset_id: template.coverAssetId,
      cover_url: template.coverAsset ? this.assets.getPublicUrl(template.coverAsset.storageKey) : null,
      price_credits: this.pricing.applyMultiplier(template.priceCredits, multiplier),
      base_price_credits: template.priceCredits,
      result_count: template.resultCount,
      sort_order: template.sortOrder,
      status: template.status,
    }));
  }

  async listCategories() {
    const [categories, categoryOrderByName] = await Promise.all([
      this.prisma.templateCategory.findMany({
        select: {
          name: true,
          displayName: true,
          icon: true,
          sortOrder: true,
        },
        orderBy: [{ sortOrder: "asc" }],
      }),
      this.getCategoryOrderByName(),
    ]);

    const sorted = categories.sort((left, right) => {
      const leftOrder = categoryOrderByName.get(left.name) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = categoryOrderByName.get(right.name) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.sortOrder - right.sortOrder;
    });

    return sorted.map((category) => ({
      name: category.name,
      display_name: category.displayName,
      icon: category.icon,
      sort_order: category.sortOrder,
    }));
  }

  async listAdmin() {
    const [templates, categoryOrderByName] = await Promise.all([
      this.prisma.template.findMany({
        include: { coverAsset: { select: { storageKey: true } } },
      }),
      this.getCategoryOrderByName(),
    ]);

    const data = sortTemplatesByCategoryOrder(templates, categoryOrderByName).map((template) => ({
      id: template.id, // 保持原始 UUID,运营轮播绑定需要
      name: template.name,
      category: template.category,
      cover_asset_id: template.coverAssetId,
      cover_url: template.coverAsset ? this.assets.getPublicUrl(template.coverAsset.storageKey) : null,
      prompt: template.prompt,
      price_credits: template.priceCredits,
      result_count: template.resultCount,
      sort_order: template.sortOrder,
      status: template.status,
    }));

    return { success: true, data };
  }

  async createAdmin(dto: CreateTemplateDto) {
    const template = await this.prisma.template.create({
      data: {
        name: dto.name,
        category: dto.category,
        coverAssetId: dto.cover_asset_id,
        prompt: dto.prompt,
        priceCredits: dto.price_credits,
        resultCount: dto.result_count,
        sortOrder: dto.sort_order,
        status: dto.status,
      },
    });

    return { success: true, data: template };
  }

  async updateAdmin(id: string, dto: UpdateTemplateDto) {
    const template = await this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.cover_asset_id !== undefined ? { coverAssetId: dto.cover_asset_id } : {}),
        ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
        ...(dto.price_credits !== undefined ? { priceCredits: dto.price_credits } : {}),
        ...(dto.result_count !== undefined ? { resultCount: dto.result_count } : {}),
        ...(dto.sort_order !== undefined ? { sortOrder: dto.sort_order } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    return { success: true, data: template };
  }

  async deleteAdmin(id: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.favorite.deleteMany({ where: { templateId: id } });
      await tx.template.delete({ where: { id } });
    });

    return { success: true };
  }

  private async getCategoryOrderByName() {
    const categories = await this.prisma.templateCategory.findMany({
      select: { name: true, sortOrder: true },
    });

    return new Map(categories.map((category) => [category.name, category.sortOrder]));
  }
}
