import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { AssetsService } from "./assets.service";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";

@Controller("assets")
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get("mock/*path")
  serveMockAsset(@Param("path") path: string | string[], @Res() res: Response) {
    return this.assets.serveMockAsset(Array.isArray(path) ? path.join("/") : path, res);
  }

  @UseGuards(UserAuthGuard)
  @Post("upload-url")
  createUploadUrl(@CurrentUser() userId: string, @Body() dto: CreateUploadUrlDto) {
    return this.assets.createUploadUrl(userId, dto);
  }
}
