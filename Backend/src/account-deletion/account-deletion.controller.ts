import { Controller, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { AccountDeletionService } from "./account-deletion.service";

@UseGuards(UserAuthGuard)
@Controller("account")
export class AccountDeletionController {
  constructor(private readonly accountDeletion: AccountDeletionService) {}

  @Post("deletion-requests")
  requestDeletion(@CurrentUser() userId: string) {
    return this.accountDeletion.requestDeletion(userId);
  }
}
