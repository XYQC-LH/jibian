import { Controller, Delete, Get, Param, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { UserCreationsService } from "./user-creations.service";

@UseGuards(UserAuthGuard)
@Controller("user-creations")
export class UserCreationsController {
  constructor(private readonly userCreations: UserCreationsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.userCreations.listForUser(userId);
  }

  @Get(":id")
  get(@CurrentUser() userId: string, @Param("id") id: string) {
    return this.userCreations.getForUser(userId, id);
  }

  @Delete(":id")
  remove(@CurrentUser() userId: string, @Param("id") id: string) {
    return this.userCreations.deleteForUser(userId, id);
  }
}
