import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { CreditsService } from "./credits.service";

@UseGuards(UserAuthGuard)
@Controller()
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get("credits/balance")
  balance(@CurrentUser() userId: string) {
    return this.credits.getBalance(userId);
  }

  @Get("credits/ledger")
  ledger(@CurrentUser() userId: string) {
    return this.credits.listLedger(userId);
  }

  @Post("redeem-codes/redeem")
  redeem(@CurrentUser() userId: string, @Body("code") code: string) {
    return this.credits.redeem(userId, code);
  }
}
