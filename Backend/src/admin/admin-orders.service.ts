import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class AdminOrdersService {
  async listOrders(params: { page: number; pageSize: number }) {
    return { success: true, data: this.emptyPaginated(params.page, params.pageSize) };
  }

  async getOrderDetail(_orderId: string) {
    throw new NotFoundException("Order not found");
  }

  async processOrderRefund(_orderId: string) {
    return { success: true, data: { refunded: false, reason: "订单系统未接入" } };
  }

  async getOrderStatistics() {
    return {
      success: true,
      data: {
        total_orders: 0,
        total_amount: 0,
        total_credits: 0,
        success_count: 0,
        failed_count: 0,
        refund_count: 0,
        date_breakdown: [],
      },
    };
  }

  async listRedemptionCodeUsages(_codeId: string, params: { page: number; pageSize: number }) {
    return { success: true, data: this.emptyPaginated(params.page, params.pageSize) };
  }

  async getRedemptionStatistics() {
    return {
      success: true,
      data: {
        total_codes: 0,
        active_codes: 0,
        expired_codes: 0,
        total_credits_issued: 0,
        total_credits_redeemed: 0,
      },
    };
  }

  private emptyPaginated(page: number, pageSize: number) {
    return {
      items: [],
      total: 0,
      page,
      page_size: pageSize,
      total_pages: 1,
      has_next: false,
      has_prev: page > 1,
    };
  }
}
