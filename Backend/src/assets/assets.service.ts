import { BadRequestException, Injectable } from "@nestjs/common";
import { Response } from "express";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { AssetUrlService } from "./asset-url.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";

const mockAssetFallbacks: Record<string, string> = {
  "mock/generated": "assets/design/close-up-face.webp",
  "input_image": "assets/design/close-up-face.webp",
};

const contentTypeExtensions: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetUrls: AssetUrlService,
  ) {}

  async createUploadUrl(userId: string | undefined, dto: CreateUploadUrlDto) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const storageKey = this.buildStorageKey(dto.asset_type, userId, dto.content_type);
    const asset = await this.prisma.asset.create({
      data: {
        ownerUserId: userId,
        assetType: dto.asset_type,
        storageKey,
      },
    });

    return {
      asset_id: asset.id,
      storage_key: storageKey,
      upload_url: this.assetUrls.createUploadUrl(storageKey),
    };
  }

  async createUploadUrlForAdmin(dto: CreateUploadUrlDto) {
    const storageKey = this.buildStorageKey(dto.asset_type, "admin", dto.content_type);
    const asset = await this.prisma.asset.create({
      data: {
        ownerUserId: null,
        assetType: dto.asset_type,
        storageKey,
      },
    });

    return {
      asset_id: asset.id,
      storage_key: storageKey,
      upload_url: this.assetUrls.createPublicUploadUrl(storageKey),
    };
  }

  getPublicUrl(storageKey: string) {
    return this.assetUrls.getPublicUrl(storageKey);
  }

  serveMockAsset(path: string, res: Response) {
    const storageKey = this.assetUrls.getMockAssetStorageKey(path);
    const assetPath = this.resolveMockAssetPath(storageKey);

    return res.sendFile(join(process.cwd(), "..", "wechat", assetPath));
  }

  private resolveMockAssetPath(storageKey: string) {
    if (storageKey.startsWith("assets/design/")) {
      return storageKey;
    }

    const fallbackKey = Object.keys(mockAssetFallbacks).find((prefix) => storageKey.startsWith(prefix));
    if (fallbackKey) {
      return mockAssetFallbacks[fallbackKey];
    }

    return "assets/design/close-up-face.webp";
  }

  private buildStorageKey(assetType: string, ownerSegment: string, contentType?: string) {
    return `${assetType}/${ownerSegment}/${Date.now()}${this.resolveExtension(contentType)}`;
  }

  private resolveExtension(contentType?: string) {
    const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
    return contentTypeExtensions[normalized] ?? ".bin";
  }
}
