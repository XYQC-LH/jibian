import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { UsersService } from "./users.service";

@UseGuards(UserAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("me")
  me(@CurrentUser() userId: string) {
    return this.users.getMe(userId);
  }

  @Post("phone-bind")
  phoneBind(@CurrentUser() userId: string, @Body() body: { phone?: string; code?: string }) {
    return this.users.bindPhone(userId, body);
  }
}
