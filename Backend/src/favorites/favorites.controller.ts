import { Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/current-user.decorator";
import { UserAuthGuard } from "../auth/user-auth.guard";
import { FavoritesService } from "./favorites.service";

@UseGuards(UserAuthGuard)
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.favorites.list(userId);
  }

  @Post(":templateId")
  add(@CurrentUser() userId: string, @Param("templateId") templateId: string) {
    return this.favorites.add(userId, templateId);
  }

  @Delete(":templateId")
  remove(@CurrentUser() userId: string, @Param("templateId") templateId: string) {
    return this.favorites.remove(userId, templateId);
  }
}
