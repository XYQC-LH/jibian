import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AdminOrdersService } from "./admin-orders.service";

@Controller("v1/admin/orders")
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  listOrders(
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
    @Query("status") status?: string,
    @Query("user_email") userEmail?: string,
    @Query("payment_method") paymentMethod?: string,
    @Query("start_date") startDate?: string,
    @Query("end_date") endDate?: string,
  ) {
    return this.orders.listOrders({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      userEmail,
      paymentMethod,
      startDate,
      endDate,
    });
  }

  @Get("statistics/summary")
  getOrderStatistics(@Query("days") days = "30") {
    return this.orders.getOrderStatistics(Number(days));
  }

  @Get(":orderId")
  getOrderDetail(@Param("orderId") orderId: string) {
    return this.orders.getOrderDetail(orderId);
  }

  @Post(":orderId/refund")
  processOrderRefund(@Param("orderId") orderId: string, @Body() body: { reason?: string }) {
    return this.orders.processOrderRefund(orderId, body?.reason);
  }
}

@Controller("v1/admin/redemption-codes")
@UseGuards(AdminGuard)
export class AdminRedemptionStatsController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get("statistics")
  getRedemptionStatistics() {
    return this.orders.getRedemptionStatistics();
  }

  @Get(":codeId/usages")
  listRedemptionCodeUsages(
    @Param("codeId") codeId: string,
    @Query("page") page = "1",
    @Query("page_size") pageSize = "20",
  ) {
    return this.orders.listRedemptionCodeUsages(codeId, {
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }
}
