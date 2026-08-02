import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminUsersService } from "./admin-users.service";

type BanBody = { is_active?: boolean };
type AdminNoteBody = { admin_note?: string };
type CreditsBody = { delta?: number };

@Controller("v1/admin/users")
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query("page") page = "1", @Query("page_size") pageSize = "50") {
    return this.users.list(Number(page), Number(pageSize));
  }

  @Post(":userId/ban")
  ban(@Param("userId") userId: string, @Body() body: BanBody) {
    return this.users.ban(userId, body.is_active);
  }

  @Patch(":userId/admin-note")
  updateAdminNote(@Param("userId") userId: string, @Body() body: AdminNoteBody) {
    return this.users.updateAdminNote(userId, body.admin_note);
  }

  @Post(":userId/credits")
  adjustCredits(@Param("userId") userId: string, @Body() body: CreditsBody) {
    return this.users.adjustCredits(userId, body.delta);
  }

  @Delete(":userId")
  remove(@Param("userId") userId: string) {
    return this.users.remove(userId);
  }
}
