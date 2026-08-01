import { Controller, Get, Param, Query } from "@nestjs/common";
import { AdminTasksService } from "./admin-tasks.service";

@Controller("v1/admin/tasks")
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
}
