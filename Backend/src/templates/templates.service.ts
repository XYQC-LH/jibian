import { Injectable } from "@nestjs/common";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { toPublicTemplateId } from "./local-template-ids";
import { UpdateTemplateDto } from "./dto/update-template.dto";

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async listPublished() {
    const templates = await this.prisma.template.findMany({
      where: { status: "published" },
      orderBy: { sortOrder: "asc" },
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
    });

    return templates.map((template) => ({
      id: toPublicTemplateId(template.id),
      name: template.name,
      category: template.category,
      cover_asset_id: template.coverAssetId,
      cover_url: template.coverAsset ? this.assets.getPublicUrl(template.coverAsset.storageKey) : null,
      price_credits: template.priceCredits,
      result_count: template.resultCount,
      sort_order: template.sortOrder,
      status: template.status,
    }));
  }

  async listAdmin() {
    const templates = await this.prisma.template.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return { success: true, data: templates };
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
}
