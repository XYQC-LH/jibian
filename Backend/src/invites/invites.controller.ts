import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { InvitesService } from "./invites.service";

@UseGuards(UserAuthGuard)
@Controller("invites")
export class InvitesController {
  constructor(private readonly invites: InvitesService) {}

  @Get("me")
  me(@CurrentUser() userId: string) {
    return this.invites.getMine(userId);
  }

  @Post("bind")
  bind(@CurrentUser() userId: string, @Body("invite_code") inviteCode: string) {
    return this.invites.bindByCode(userId, inviteCode);
  }
}
