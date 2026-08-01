import { BadRequestException, Injectable } from "@nestjs/common";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicTemplateId, toTemplateUuid } from "../templates/local-template-ids";

@Injectable()
export class FavoritesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async list(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const favorites = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { template: { include: { coverAsset: true } } },
    });

    return favorites.map((favorite) => ({
      id: favorite.id,
      template_id: toPublicTemplateId(favorite.templateId),
      created_at: favorite.createdAt,
      template: {
        id: toPublicTemplateId(favorite.template.id),
        name: favorite.template.name,
        category: favorite.template.category,
        cover_asset_id: favorite.template.coverAssetId,
        cover_storage_key: favorite.template.coverAsset?.storageKey ?? null,
        cover_url: favorite.template.coverAsset ? this.assets.getPublicUrl(favorite.template.coverAsset.storageKey) : null,
        price_credits: favorite.template.priceCredits,
        result_count: favorite.template.resultCount,
        sort_order: favorite.template.sortOrder,
        status: favorite.template.status,
      },
    }));
  }

  async add(userId: string | undefined, templateId: string) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const templateUuid = toTemplateUuid(templateId);
    const favorite = await this.prisma.favorite.upsert({
      where: { userId_templateId: { userId, templateId: templateUuid } },
      update: {},
      create: { userId, templateId: templateUuid },
    });

    return { id: favorite.id };
  }

  async remove(userId: string | undefined, templateId: string) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    await this.prisma.favorite.deleteMany({ where: { userId, templateId: toTemplateUuid(templateId) } });
    return { ok: true };
  }
}
