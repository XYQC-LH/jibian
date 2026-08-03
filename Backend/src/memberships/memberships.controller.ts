import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { MembershipsService } from "./memberships.service";

@Controller()
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get("memberships/plans")
  plans() {
    return this.memberships.listPlans();
  }

  @UseGuards(UserAuthGuard)
  @Get("memberships/me")
  me(@CurrentUser() userId: string) {
    return this.memberships.getMe(userId);
  }

  @UseGuards(UserAuthGuard)
  @Post("memberships/wechat/contracts/pre-sign")
  preSign(
    @CurrentUser() userId: string,
    @Body("plan_id") planId: string,
  ) {
    return this.memberships.createWechatPreSign(userId, planId);
  }

  @UseGuards(UserAuthGuard)
  @Post("memberships/me/cancel")
  cancel(@CurrentUser() userId: string) {
    return this.memberships.cancelMine(userId);
  }

  @Post("memberships/wechat/contracts/notify")
  contractNotify(@Body() body: unknown, @Req() req: Request & { rawBody?: Buffer }) {
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(body);
    return this.memberships.handleContractNotify(body, req.headers, rawBody);
  }

  @Post("memberships/wechat/transactions/notify")
  transactionNotify(@Body() body: unknown, @Req() req: Request & { rawBody?: Buffer }) {
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(body);
    return this.memberships.handleTransactionNotify(body, req.headers, rawBody);
  }
}
