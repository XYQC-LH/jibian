import { BadRequestException, Injectable } from "@nestjs/common";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateTemplateCoverUploadUrlDto } from "./dto/create-cover-upload-url.dto";
import { CreateTemplateIngestDto } from "./dto/create-template-ingest.dto";

@Injectable()
export class TemplateIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async listCategories() {
    const categories = await this.prisma.templateCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });

    return {
      success: true,
      data: {
        items: categories.map((category) => ({
          id: category.id,
          name: category.name,
          display_name: category.displayName,
          sort_order: category.sortOrder,
        })),
        total: categories.length,
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
      this.prisma.asset.findUnique({ where: { id: dto.cover_asset_id } }),
      this.prisma.template.aggregate({
        where: { category },
        _max: { sortOrder: true },
      }),
    ]);

    if (!existingCategory) {
      throw new BadRequestException("Category does not exist");
    }
    if (!coverAsset) {
      throw new BadRequestException("Cover asset not found");
    }
    if (coverAsset.assetType !== "template_cover") {
      throw new BadRequestException("Cover asset must be template_cover");
    }

    try {
      await this.assets.assertUploaded(coverAsset.storageKey);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException("Cover asset is not uploaded or reachable");
      }
      throw error;
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
    });

    return {
      success: true,
      data: {
        id: template.id,
        name: template.name,
        category: template.category,
        cover_asset_id: template.coverAssetId,
        prompt: template.prompt,
        price_credits: template.priceCredits,
        result_count: template.resultCount,
        sort_order: template.sortOrder,
        status: template.status,
      },
    };
  }
}
