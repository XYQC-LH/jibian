import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import {
  AdminTemplateCategoriesService,
  TemplateCategoryInput,
} from "./admin-template-categories.service";

@Controller("v1/admin/template-categories")
@UseGuards(AdminGuard)
export class AdminTemplateCategoriesController {
  constructor(private readonly categories: AdminTemplateCategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  create(@Body() input: TemplateCategoryInput) {
    return this.categories.create(input);
  }

  @Put(":id")
  update(@Param("id") id: string, @Body() input: TemplateCategoryInput) {
    return this.categories.update(id, input);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.categories.remove(id);
  }

  @Post("reorder")
  reorder(@Body("items") items: Array<{ id: string; order: number }>) {
    return this.categories.reorder(items);
  }
}
