import { Controller, Get, Query } from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";

@Controller("v1/admin/users")
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query("page") page = "1", @Query("page_size") pageSize = "50") {
    return this.users.list(Number(page), Number(pageSize));
  }
}
