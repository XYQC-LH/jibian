import { Controller, Get, NotFoundException, Param, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AssetsService } from "./assets.service";

@Controller("assets")
export class AssetDownloadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  @UseGuards(UserAuthGuard)
  @Get(":assetId/download")
  async download(
    @CurrentUser() userId: string,
    @Param("assetId") assetId: string,
    @Res() res: Response,
  ) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset || !this.canUserDownloadAsset(asset, userId)) {
      throw new NotFoundException("Asset not found");
    }

    return res.redirect(302, this.assets.getPublicUrl(asset.storageKey));
  }

  private canUserDownloadAsset(asset: { ownerUserId: string | null; storageKey: string }, userId: string) {
    if (asset.ownerUserId === userId) return true;
    if (asset.ownerUserId) return false;
    return asset.storageKey.startsWith("assets/design/") || asset.storageKey.startsWith("template_cover/");
  }
}
