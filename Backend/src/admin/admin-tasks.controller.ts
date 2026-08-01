import { Controller, Delete, Get, Param, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminTasksService } from "./admin-tasks.service";

@Controller("v1/admin/tasks")
@UseGuards(AdminGuard)
export class AdminTasksController {
  constructor(private readonly tasks: AdminTasksService) {}

  @Get()
  list(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "50",
    @Query("status") status?: string,
    @Query("user") user?: string,
  ) {
    return this.tasks.list({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      user,
    });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.tasks.get(id);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.tasks.remove(id);
  }
}
