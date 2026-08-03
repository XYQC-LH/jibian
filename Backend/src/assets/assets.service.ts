import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { Response as ExpressResponse } from "express";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { AigcLabelContext, AigcLabelService } from "./aigc-label.service";
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
    private readonly aigcLabel: AigcLabelService,
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

  async assertUploaded(storageKey: string) {
    const publicUrl = this.getPublicUrl(storageKey);
    if (!/^https?:\/\//i.test(publicUrl)) {
      return;
    }
    if (publicUrl.includes("/api/assets/mock/")) {
      return;
    }

    let response: globalThis.Response;
    try {
      response = await fetch(publicUrl, { headers: { Range: "bytes=0-0" } });
    } catch {
      throw new BadRequestException("Input asset is not uploaded or reachable");
    }

    response.body?.cancel().catch(() => undefined);
    if (!response.ok) {
      throw new BadRequestException("Input asset is not uploaded or reachable");
    }
  }

  async materializeRemoteAsset(
    assetId: string,
    ownerUserId: string,
    signal?: AbortSignal,
    labelContext?: AigcLabelContext,
  ) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || !/^https?:\/\//i.test(asset.storageKey)) {
      return asset;
    }

    const response = await fetch(asset.storageKey, { signal });
    if (!response.ok) {
      throw new ServiceUnavailableException(`下载生成结果失败: HTTP ${response.status}`);
    }

    let contentType = response.headers.get("content-type") || "image/png";
    let imageBuffer: Buffer<ArrayBufferLike> = Buffer.from(await response.arrayBuffer());

    if (asset.assetType === "generated_image" && labelContext) {
      const labelResult = await this.aigcLabel.applyLabels(imageBuffer, contentType, labelContext);
      imageBuffer = labelResult.buffer;
      contentType = labelResult.contentType;
    }

    const storageKey = this.buildStorageKey(asset.assetType, ownerUserId, contentType);
    const uploadUrl = this.assetUrls.createUploadUrl(storageKey);
    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: imageBuffer as unknown as BodyInit,
      signal,
    });
    if (!upload.ok) {
      throw new ServiceUnavailableException(`保存生成结果失败: HTTP ${upload.status}`);
    }

    return this.prisma.asset.update({
      where: { id: asset.id },
      data: { ownerUserId, storageKey },
    });
  }

  serveMockAsset(path: string, res: ExpressResponse) {
    const storageKey = this.assetUrls.getMockAssetStorageKey(path);
    const assetPath = this.resolveMockAssetPath(storageKey);

    return res.sendFile(assetPath);
  }

  private resolveMockAssetPath(storageKey: string) {
    let relativePath = "assets/design/close-up-face.webp";
    if (storageKey.startsWith("assets/design/")) {
      relativePath = storageKey;
    } else {
      const fallbackKey = Object.keys(mockAssetFallbacks).find((prefix) => storageKey.startsWith(prefix));
      if (fallbackKey) {
        relativePath = mockAssetFallbacks[fallbackKey];
      }
    }

    const bundledPath = join(process.cwd(), relativePath);
    if (existsSync(bundledPath)) {
      return bundledPath;
    }

    return join(process.cwd(), "..", "Frontend-Wechat", relativePath);
  }

  private buildStorageKey(assetType: string, ownerSegment: string, contentType?: string) {
    return `${assetType}/${ownerSegment}/${Date.now()}-${randomUUID()}${this.resolveExtension(contentType)}`;
  }

  private resolveExtension(contentType?: string) {
    const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
    return contentTypeExtensions[normalized] ?? ".bin";
  }
}
