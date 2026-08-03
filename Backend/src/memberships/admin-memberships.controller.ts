import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { MembershipsService } from "./memberships.service";

@Controller("v1/admin")
@UseGuards(AdminGuard)
export class AdminMembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get("memberships")
  listMemberships() {
    return this.memberships.adminListMemberships();
  }

  @Get("memberships/:id")
  getMembership(@Param("id") id: string) {
    return this.memberships.adminGetMembership(id);
  }

  @Post("memberships/:id/cancel")
  cancelMembership(@Param("id") id: string) {
    return this.memberships.adminCancelMembership(id);
  }

  @Post("membership-orders/:orderId/refund")
  refundOrder(@Param("orderId") orderId: string, @Body() body: { reason?: string }) {
    return this.memberships.adminRefundOrder(orderId, body?.reason);
  }
}
