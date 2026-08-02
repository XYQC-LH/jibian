import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { PaymentsService } from "./payments.service";

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("payments/packages")
  packages() {
    return { success: true, data: this.payments.listPackages() };
  }

  @Get("payments/wechat/status")
  wechatStatus() {
    return { success: true, data: this.payments.getWechatPayStatus() };
  }

  @Post("payments/wechat/notify")
  notify(@Body() body: unknown, @Req() req: Request & { rawBody?: Buffer }) {
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(body);
    return this.payments.handleWechatNotify(body, req.headers, rawBody);
  }

  @UseGuards(UserAuthGuard)
  @Post("payments/wechat/orders")
  createWechatOrder(
    @CurrentUser() userId: string,
    @Body("package_id") packageId: string,
  ) {
    return this.payments.createWechatOrder(userId, packageId);
  }

  @UseGuards(UserAuthGuard)
  @Get("payments/wechat/orders/:outTradeNo")
  getWechatOrder(
    @CurrentUser() userId: string,
    @Param("outTradeNo") outTradeNo: string,
  ) {
    return this.payments.getWechatOrderForUser(userId, outTradeNo);
  }
}
