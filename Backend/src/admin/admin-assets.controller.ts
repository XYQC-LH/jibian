import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AssetsService } from "../assets/assets.service";
import { CreateUploadUrlDto } from "../assets/dto/create-upload-url.dto";
import { PrismaService } from "../prisma/prisma.service";

@Controller("v1/admin/assets")
@UseGuards(AdminGuard)
export class AdminAssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("upload-url")
  createUploadUrl(@Body() dto: CreateUploadUrlDto) {
    return this.assets.createUploadUrlForAdmin(dto);
  }

  @Get(":assetId/resolve-link")
  async resolveLink(
    @Param("assetId") assetId: string,
    @Query("download") download?: string,
  ) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    let url = this.assets.getPublicUrl(asset.storageKey);
    if (download === "true") {
      url = url.includes("?")
        ? `${url}&response-content-disposition=attachment`
        : `${url}?response-content-disposition=attachment`;
    }
    return { success: true, data: { url } };
  }
}
