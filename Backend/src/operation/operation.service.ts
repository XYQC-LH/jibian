import { BadRequestException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { toPublicTemplateId } from "../templates/local-template-ids";

const OPERATION_HOME_BANNERS_KEY = "operation.home_banners";
const MAX_HOME_BANNERS = 10;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type BannerStatus = "active" | "inactive";

export type OperationHomeBanner = {
  id: string;
  title: string;
  image_asset_id: string;
  image_url: string;
  template_id: string;
  sort_order: number;
  status: BannerStatus;
};

export type OperationConfig = {
  home_banners: OperationHomeBanner[];
};

@Injectable()
export class OperationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async getAdminConfig(): Promise<OperationConfig> {
    const config = await this.readConfig();
    return this.resolveBannerImageUrls(config);
  }

  async updateAdminConfig(input: Record<string, unknown>): Promise<OperationConfig> {
    const config = this.normalizeConfig(input);
    await this.prisma.setting.upsert({
      where: { key: OPERATION_HOME_BANNERS_KEY },
      update: { value: JSON.stringify(config) },
      create: { key: OPERATION_HOME_BANNERS_KEY, value: JSON.stringify(config) },
    });
    return this.resolveBannerImageUrls(config);
  }

  async getPublicHomeConfig(): Promise<OperationConfig> {
    const config = await this.getAdminConfig();
    return {
      home_banners: config.home_banners
        .filter((banner) => banner.status === "active" && banner.image_url && banner.template_id)
        .map((banner) => ({
          ...banner,
          template_id: toPublicTemplateId(banner.template_id),
        })),
    };
  }

  private async readConfig(): Promise<OperationConfig> {
    const row = await this.prisma.setting.findUnique({ where: { key: OPERATION_HOME_BANNERS_KEY } });
    if (!row?.value) {
      return { home_banners: [] };
    }

    try {
      return this.normalizeConfig(JSON.parse(row.value));
    } catch {
      return { home_banners: [] };
    }
  }

  private normalizeConfig(input: Record<string, unknown>): OperationConfig {
    const rawBanners = input.home_banners;
    if (rawBanners === undefined) {
      return { home_banners: [] };
    }
    if (!Array.isArray(rawBanners)) {
      throw new BadRequestException("home_banners must be an array");
    }
    if (rawBanners.length > MAX_HOME_BANNERS) {
      throw new BadRequestException(`home_banners cannot exceed ${MAX_HOME_BANNERS} items`);
    }

    return {
      home_banners: rawBanners
        .map((item, index) => this.normalizeBanner(item, index))
        .sort((a, b) => a.sort_order - b.sort_order),
    };
  }

  private normalizeBanner(item: unknown, index: number): OperationHomeBanner {
    if (!item || typeof item !== "object") {
      throw new BadRequestException(`home_banners[${index}] must be an object`);
    }

    const record = item as Record<string, unknown>;
    const imageAssetId = this.readText(record, "image_asset_id", "imageAssetId");
    const imageUrl = this.readText(record, "image_url", "imageUrl");
    const templateId = this.readText(record, "template_id", "templateId");

    if (!imageAssetId && !imageUrl) {
      throw new BadRequestException(`home_banners[${index}].image_asset_id is required`);
    }
    if (!templateId) {
      throw new BadRequestException(`home_banners[${index}].template_id is required`);
    }

    return {
      id: this.readText(record, "id") || randomUUID(),
      title: this.readText(record, "title").slice(0, 80) || `首页轮播 ${index + 1}`,
      image_asset_id: imageAssetId,
      image_url: imageUrl,
      template_id: templateId,
      sort_order: this.readInteger(record, index + 1, "sort_order", "sortOrder"),
      status: this.readText(record, "status") === "inactive" ? "inactive" : "active",
    };
  }

  private async resolveBannerImageUrls(config: OperationConfig): Promise<OperationConfig> {
    const assetIds = Array.from(
      new Set(config.home_banners.map((banner) => banner.image_asset_id).filter((id) => UUID_PATTERN.test(id))),
    );
    if (assetIds.length === 0) {
      return config;
    }

    const assets = await this.prisma.asset.findMany({
      where: { id: { in: assetIds } },
      select: { id: true, storageKey: true },
    });
    const urlByAssetId = new Map(assets.map((asset) => [asset.id, this.assets.getPublicUrl(asset.storageKey)]));

    return {
      home_banners: config.home_banners.map((banner) => ({
        ...banner,
        image_url: urlByAssetId.get(banner.image_asset_id) || banner.image_url,
      })),
    };
  }

  private readText(record: Record<string, unknown>, ...keys: string[]) {
    const value = keys.map((key) => record[key]).find((candidate) => candidate !== undefined);
    return String(value ?? "").trim();
  }

  private readInteger(record: Record<string, unknown>, fallback: number, ...keys: string[]) {
    const value = keys.map((key) => record[key]).find((candidate) => candidate !== undefined);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }
}
