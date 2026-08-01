import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { AdminGuard } from "../auth/admin.guard";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
};

type UploadedMulterFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

// multipart 已把文件传到后端，这里直接落盘本地（UPLOAD_DIR，默认 ./uploads）并创建 Asset 记录；
// mock/dev 下 getPublicUrl 返回本地 mock URL，部署时可配 ASSET_PUBLIC_BASE_URL 指向静态目录。
@Controller("v1")
@UseGuards(AdminGuard)
export class AdminUploadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
    private readonly config: ConfigService,
  ) {}

  @Post("files/admin/upload-cover")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadCover(@UploadedFile() file?: UploadedMulterFile) {
    return this.saveUploadedFile(file, "template_cover");
  }

  @Post("assets/upload")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  uploadAsset(@UploadedFile() file?: UploadedMulterFile, @Body("asset_type") assetType?: string) {
    return this.saveUploadedFile(file, this.sanitizeAssetType(assetType));
  }

  private async saveUploadedFile(file: UploadedMulterFile | undefined, assetType: string) {
    if (!file?.buffer) {
      throw new BadRequestException("缺少 multipart 文件字段 file");
    }

    const storageKey = `${assetType}/${Date.now()}-${Math.random().toString(16).slice(2, 10)}${this.resolveExtension(file)}`;
    const uploadDir = this.config.get<string>("UPLOAD_DIR")?.trim() || "./uploads";
    const targetPath = join(uploadDir, storageKey);

    await mkdir(join(targetPath, ".."), { recursive: true });
    await writeFile(targetPath, file.buffer);

    const asset = await this.prisma.asset.create({
      data: { ownerUserId: null, assetType, storageKey },
    });

    return {
      success: true,
      data: {
        id: asset.id,
        url: this.assets.getPublicUrl(storageKey),
        filename: file.originalname,
      },
    };
  }

  private sanitizeAssetType(value: string | undefined) {
    const cleaned = (value ?? "").replace(/[^a-z0-9_-]/gi, "_").trim();
    return cleaned || "uploaded_file";
  }

  private resolveExtension(file: UploadedMulterFile) {
    const fromName = extname(file.originalname || "");
    if (fromName) return fromName.toLowerCase();
    return MIME_EXTENSIONS[file.mimetype] ?? ".bin";
  }
}
