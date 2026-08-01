import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { AssetsService } from "./assets.service";

@Controller("assets")
export class AssetDownloadController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  @Get(":assetId/download")
  async download(@Param("assetId") assetId: string, @Res() res: Response) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    return res.redirect(302, this.assets.getPublicUrl(asset.storageKey));
  }
}
