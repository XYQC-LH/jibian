import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminGuard } from "../auth/admin.guard";
import { AssetsService } from "../assets/assets.service";
import { CreateUploadUrlDto } from "../assets/dto/create-upload-url.dto";

@Controller("v1/admin/assets")
@UseGuards(AdminGuard)
export class AdminAssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Post("upload-url")
  createUploadUrl(@Req() req: Request, @Body() dto: CreateUploadUrlDto) {
    const admin = req.admin as { id: string; username: string };
    return this.assets.createUploadUrl(admin.id, dto);
  }
}
